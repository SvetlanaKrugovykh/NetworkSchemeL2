const fs = require('fs').promises
const path = require('path')
const DLinkConfigParser = require('../parsers/dlinkConfigParser')
const MacTableParser = require('../parsers/macTableParser')
const DeviceModel = require('../models/deviceModel')
const VlanModel = require('../models/vlanModel')
const pool = require('../db/pool')

class ImportService {
  /**
   * Import device configuration from file
   */
  static async importDeviceConfig(filePath) {
    try {
      console.log(`Importing device config from: ${filePath}`)
      
      const configText = await fs.readFile(filePath, 'utf8')
      const fileName = path.basename(filePath, '.cfg')
      const deviceIp = fileName // assume filename = device IP
      
      // Determine device type by configuration content
      let deviceType = 'unknown'
      let parsedData = null
      
      if (configText.includes('DGS-') && configText.includes('D-Link')) {
        deviceType = 'dlink'
        const parser = new DLinkConfigParser()
        parsedData = parser.parse(configText, deviceIp)
      } else if (configText.includes('epon') || configText.includes('OLT')) {
        deviceType = 'olt'
        // TODO: Add OLT parser
        console.log('OLT parser not implemented yet')
        return null
      }
      
      if (!parsedData) {
        throw new Error(`Unable to parse config for device ${deviceIp}`)
      }
      
      // Start transaction
      const client = await pool.connect()
      
      try {
        await client.query('BEGIN')
        
        // Create or update device
        let device = await DeviceModel.findByIp(deviceIp)
        if (device) {
          device = await DeviceModel.update(device.id, {
            hostname: parsedData.device.hostname,
            device_type: deviceType,
            model: parsedData.device.model
          })
        } else {
          device = await DeviceModel.create({
            hostname: parsedData.device.hostname,
            ip_address: deviceIp,
            device_type: deviceType,
            model: parsedData.device.model,
            location: 'Unknown'
          })
        }
        
        // Save configuration
        await this.saveDeviceConfiguration(device.id, configText, 'imported')
        
        // Create ports
        await this.importPorts(device.id, parsedData.ports, client)
        
        // Create VLANs
        await this.importVlans(parsedData.vlans, client)
        
        // Create device-VLAN relationships
        await this.importDeviceVlans(device.id, parsedData.deviceVlans, client)
        
        await client.query('COMMIT')
        
        console.log(`Successfully imported config for device ${deviceIp} (ID: ${device.id})`)
        return device
        
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
      
    } catch (error) {
      console.error(`Error importing config ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Import device MAC table
   */
  static async importMacTable(filePath) {
    try {
      console.log(`Importing MAC table from: ${filePath}`)
      
      const macTableText = await fs.readFile(filePath, 'utf8')
      const fileName = path.basename(filePath)
      const deviceIp = fileName // assume filename = device IP
      
      // Find device in database
      const device = await DeviceModel.findByIp(deviceIp)
      if (!device) {
        throw new Error(`Device with IP ${deviceIp} not found in database`)
      }
      
      // Parse MAC table
      const macEntries = MacTableParser.parseAuto(macTableText, deviceIp)
      
      // Получаем порты устройства для сопоставления
      const deviceWithPorts = await DeviceModel.findWithPorts(device.id)
      const portMap = {}
      deviceWithPorts.ports.forEach(port => {
        portMap[port.port_number] = port.id
      })
      
      // Импортируем MAC записи
      let importedCount = 0
      for (const macEntry of macEntries) {
        const portId = portMap[macEntry.port_number]
        if (!portId) {
          console.warn(`Port ${macEntry.port_number} not found for device ${deviceIp}`)
          continue
        }
        
        await this.saveMacAddress({
          mac_address: macEntry.mac_address,
          ip_address: null, // IP будет добавлен отдельно
          device_id: device.id,
          port_id: portId,
          vlan_id: macEntry.vlan_id,
          client_type: MacTableParser.detectDeviceType(macEntry.mac_address),
          description: null,
          status: macEntry.status,
          last_seen: macEntry.last_seen
        })
        
        importedCount++
      }
      
      console.log(`Successfully imported ${importedCount} MAC addresses for device ${deviceIp}`)
      return { device, importedCount }
      
    } catch (error) {
      console.error(`Error importing MAC table ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Импорт всех файлов из директории
   */
  static async importFromDirectory(directoryPath) {
    try {
      const configsDir = path.join(directoryPath, 'configs')
      const macsDir = path.join(directoryPath, 'macs')
      
      const results = {
        devices: [],
        macTables: [],
        errors: []
      }
      
      // Импорт конфигураций
      try {
        const configFiles = await fs.readdir(configsDir)
        for (const file of configFiles) {
          if (file.endsWith('.cfg')) {
            try {
              const device = await this.importDeviceConfig(path.join(configsDir, file))
              if (device) {
                results.devices.push(device)
              }
            } catch (error) {
              results.errors.push({ file, error: error.message })
            }
          }
        }
      } catch (error) {
        console.warn(`Configs directory not found: ${configsDir}`)
      }
      
      // Импорт MAC таблиц
      try {
        const macFiles = await fs.readdir(macsDir)
        for (const file of macFiles) {
          try {
            const result = await this.importMacTable(path.join(macsDir, file))
            results.macTables.push(result)
          } catch (error) {
            results.errors.push({ file, error: error.message })
          }
        }
      } catch (error) {
        console.warn(`MACs directory not found: ${macsDir}`)
      }
      
      return results
      
    } catch (error) {
      console.error(`Error importing from directory ${directoryPath}:`, error)
      throw error
    }
  }

  // Вспомогательные методы

  static async importPorts(deviceId, ports, client) {
    for (const portData of ports) {
      const query = `
        INSERT INTO device_ports (device_id, port_number, port_name, port_type, description, status, speed, duplex)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (device_id, port_number) DO UPDATE SET
          port_name = EXCLUDED.port_name,
          port_type = EXCLUDED.port_type,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          speed = EXCLUDED.speed,
          duplex = EXCLUDED.duplex
      `
      
      await client.query(query, [
        deviceId,
        portData.port_number,
        portData.port_name,
        portData.port_type,
        portData.description,
        portData.status,
        portData.speed,
        portData.duplex
      ])
    }
  }

  static async importVlans(vlans, client) {
    for (const vlanData of vlans) {
      const query = `
        INSERT INTO vlans (vlan_id, name, description, type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (vlan_id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          type = EXCLUDED.type
      `
      
      await client.query(query, [
        vlanData.vlan_id,
        vlanData.name,
        vlanData.description,
        vlanData.type
      ])
    }
  }

  static async importDeviceVlans(deviceId, deviceVlans, client) {
    // Сначала получаем порты устройства
    const portsQuery = 'SELECT id, port_number FROM device_ports WHERE device_id = $1'
    const portsResult = await client.query(portsQuery, [deviceId])
    const portMap = {}
    portsResult.rows.forEach(port => {
      portMap[port.port_number] = port.id
    })

    for (const deviceVlanData of deviceVlans) {
      const portId = portMap[deviceVlanData.port_number]
      if (!portId) {
        console.warn(`Port ${deviceVlanData.port_number} not found for device ${deviceId}`)
        continue
      }

      const query = `
        INSERT INTO device_vlans (device_id, port_id, vlan_id, mode, native_vlan, qinq_enabled, outer_vlan, inner_vlan)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (device_id, port_id, vlan_id, mode) DO UPDATE SET
          native_vlan = EXCLUDED.native_vlan,
          qinq_enabled = EXCLUDED.qinq_enabled,
          outer_vlan = EXCLUDED.outer_vlan,
          inner_vlan = EXCLUDED.inner_vlan
      `
      
      await client.query(query, [
        deviceId,
        portId,
        deviceVlanData.vlan_id,
        deviceVlanData.mode,
        deviceVlanData.native_vlan,
        deviceVlanData.qinq_enabled || false,
        deviceVlanData.outer_vlan || null,
        deviceVlanData.inner_vlan || null
      ])
    }
  }

  static async saveDeviceConfiguration(deviceId, configText, createdBy) {
    const crypto = require('crypto')
    const configHash = crypto.createHash('sha256').update(configText).digest('hex')
    
    const query = `
      INSERT INTO device_configurations (device_id, config_text, config_hash, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `
    
    const result = await pool.query(query, [deviceId, configText, configHash, createdBy])
    return result.rows[0]
  }

  static async saveMacAddress(macData) {
    const query = `
      INSERT INTO mac_addresses (mac_address, ip_address, device_id, port_id, vlan_id, client_type, description, status, last_seen)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (mac_address, device_id, vlan_id) DO UPDATE SET
        port_id = EXCLUDED.port_id,
        status = EXCLUDED.status,
        last_seen = EXCLUDED.last_seen,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    
    const result = await pool.query(query, [
      macData.mac_address,
      macData.ip_address,
      macData.device_id,
      macData.port_id,
      macData.vlan_id,
      macData.client_type,
      macData.description,
      macData.status,
      macData.last_seen
    ])
    
    return result.rows[0]
  }
}

module.exports = ImportService
