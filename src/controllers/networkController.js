const ImportService = require('../services/importService')
const DeviceModel = require('../models/deviceModel')
const VlanModel = require('../models/vlanModel')
const path = require('path')

class NetworkController {
  /**
   * Import data from data directory
   */
  static async importData(request, reply) {
    try {
      const dataDir = path.join(process.cwd(), 'data')
      const results = await ImportService.importFromDirectory(dataDir)

      reply.send({
        success: true,
        message: 'Data import completed',
        results: {
          devicesImported: results.devices.length,
          macTablesImported: results.macTables.length,
          errors: results.errors
        }
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get list of all devices
   */
  static async getDevices(request, reply) {
    try {
      console.log('🔍 Getting devices...')
      const devices = await DeviceModel.findAll()
      console.log('✅ Found devices:', devices.length)
      reply.send({
        success: true,
        data: devices
      })
    } catch (error) {
      console.error('❌ Error in getDevices:', error)
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get device information with ports and VLANs
   */
  static async getDevice(request, reply) {
    try {
      const { id } = request.params
      const device = await DeviceModel.findWithVlans(parseInt(id))

      if (!device) {
        return reply.code(404).send({
          success: false,
          error: 'Device not found'
        })
      }

      reply.send({
        success: true,
        data: device
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get list of all VLANs
   */
  static async getVlans(request, reply) {
    try {
      const vlans = await VlanModel.findAll()
      reply.send({
        success: true,
        data: vlans
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get VLAN topology
   */
  static async getVlanTopology(request, reply) {
    try {
      const { vlanId } = request.params
      const topology = await VlanModel.findVlanPath(parseInt(vlanId))

      reply.send({
        success: true,
        data: topology
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get MAC addresses in VLAN
   */
  static async getVlanMacs(request, reply) {
    try {
      const { vlanId } = request.params
      const macAddresses = await VlanModel.getMacAddresses(parseInt(vlanId))

      reply.send({
        success: true,
        data: macAddresses
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Generate HTML scheme for VLAN
   */
  static async generateVlanScheme(request, reply) {
    try {
      const { vlanId } = request.params
      const topology = await VlanModel.findVlanPath(parseInt(vlanId))
      const macAddresses = await VlanModel.getMacAddresses(parseInt(vlanId))

      // Generate HTML
      const html = NetworkController.generateVlanHTML(topology, macAddresses)

      reply.type('text/html').send(html)
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Generate VLAN HTML scheme
   */
  static generateVlanHTML(topology, macAddresses) {
    const macByDevice = {}
    macAddresses.forEach(mac => {
      if (!macByDevice[mac.device_ip]) {
        macByDevice[mac.device_ip] = []
      }
      macByDevice[mac.device_ip].push(mac)
    })

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VLAN ${topology.vlan_id} Topology</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 10px;
        }
        .device {
            border: 2px solid #333;
            margin: 20px 0;
            padding: 15px;
            border-radius: 10px;
            background: #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .device-header {
            background: #4a90e2;
            color: white;
            padding: 10px;
            margin: -15px -15px 15px -15px;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
        }
        .ports {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .port {
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 5px;
            background: #f9f9f9;
        }
        .port-header {
            font-weight: bold;
            color: #333;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        .vlan-mode {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 0.8em;
            margin: 2px;
        }
        .tagged {
            background: #e3f2fd;
            color: #1976d2;
            border: 1px solid #1976d2;
        }
        .untagged {
            background: #f3e5f5;
            color: #7b1fa2;
            border: 1px solid #7b1fa2;
        }
        .mac-addresses {
            margin-top: 15px;
        }
        .mac-item {
            background: #e8f5e8;
            padding: 8px 12px;
            margin: 3px 0;
            border-radius: 4px;
            font-family: monospace;
            font-size: 1.1em;
            border-left: 3px solid #4caf50;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-item {
            text-align: center;
            padding: 15px;
            background: linear-gradient(135deg, #f093fb, #f5576c);
            color: white;
            border-radius: 10px;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VLAN ${topology.vlan_id} - ${topology.vlan_name}</h1>
            <p>${topology.vlan_description}</p>
        </div>

        <div class="stats">
            <div class="stat-item">
                <div class="stat-number">${topology.devices.length}</div>
                <div class="stat-label">Devices</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${topology.devices.reduce((sum, d) => sum + d.ports.length, 0)}</div>
                <div class="stat-label">Ports</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${macAddresses.length}</div>
                <div class="stat-label">MAC Addresses</div>
            </div>
        </div>
`

    topology.devices.forEach(device => {
      const deviceMacs = macByDevice[device.ip_address] || []

      html += `
        <div class="device">
            <div class="device-header">
                ${device.hostname} (${device.ip_address}) - ${device.device_type.toUpperCase()}
            </div>

            <div class="ports">
`

      device.ports.forEach(port => {
        const portMacs = deviceMacs.filter(mac => mac.port_number === port.port_number)

        html += `
                <div class="port">
                    <div class="port-header">
                        Port ${port.port_number}${port.port_name ? ` (${port.port_name})` : ''}
                    </div>
                    ${port.port_description ? `<div><strong>Description:</strong> ${port.port_description}</div>` : ''}
                    <div>
                        <span class="vlan-mode ${port.mode}">${port.mode.toUpperCase()}</span>
                        ${port.native_vlan ? '<span class="vlan-mode untagged">NATIVE</span>' : ''}
                        ${port.qinq_enabled ? '<span class="vlan-mode tagged">QinQ</span>' : ''}
                    </div>

                    ${portMacs.length > 0 ? `
                    <div class="mac-addresses">
                        <strong>MAC Addresses (${portMacs.length}):</strong>
                        ${portMacs.map(mac => `
                            <div class="mac-item">
                                ${mac.mac_address}
                                ${mac.ip_address ? ` → ${mac.ip_address}` : ''}
                                ${mac.client_type ? ` [${mac.client_type}]` : ''}
                                ${mac.description ? ` - ${mac.description}` : ''}
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
`
      })

      html += `
            </div>
        </div>
`
    })

    html += `
    </div>
</body>
</html>`

    return html
  }

  /**
   * Upload and import files
   */
  static async uploadFiles(request, reply) {
    try {
      const parts = request.parts()
      let deviceIp = null
      let configContent = null
      let macContent = null

      // Process multipart form data
      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'deviceIp') {
            deviceIp = part.value
          }
        } else if (part.type === 'file') {
          const content = await part.toBuffer()
          const text = content.toString('utf8')

          if (part.fieldname === 'configFile') {
            configContent = text
          } else if (part.fieldname === 'macFile') {
            macContent = text
          }
        }
      }

      if (!deviceIp) {
        return reply.code(400).send({
          success: false,
          error: 'Device IP is required'
        })
      }

      if (!configContent && !macContent) {
        return reply.code(400).send({
          success: false,
          error: 'At least one file is required'
        })
      }

      const results = {}

      // Import configuration if provided
      if (configContent) {
        try {
          results.config = await ImportService.importConfigAuto(configContent, deviceIp)
        } catch (error) {
          results.config = {
            success: false,
            error: error.message,
            message: `Failed to import configuration for ${deviceIp}`
          }
        }
      }

      // Import MAC table if provided
      if (macContent) {
        try {
          results.mac = await ImportService.importMacTable(macContent, deviceIp, 'auto')
        } catch (error) {
          results.mac = {
            success: false,
            error: error.message,
            message: `Failed to import MAC table for ${deviceIp}`
          }
        }
      }

      // Check if at least one import was successful
      const configSuccess = !results.config || results.config.success
      const macSuccess = !results.mac || results.mac.success

      reply.send({
        success: configSuccess && macSuccess,
        message: 'File upload and import completed',
        ...results
      })

    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get device ports
   */
  static async getDevicePorts(request, reply) {
    try {
      const { id } = request.params
      const pool = require('../db/pool')

      const result = await pool.query(`
        SELECT
          dp.id,
          dp.port_name,
          COUNT(DISTINCT ma.mac_address) as mac_count
        FROM device_ports dp
        LEFT JOIN mac_addresses ma ON dp.id = ma.port_id
        WHERE dp.device_id = $1
        GROUP BY dp.id, dp.port_name
        ORDER BY dp.port_name
      `, [id])

      reply.send({
        success: true,
        data: result.rows
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get device VLANs
   */
  static async getDeviceVlans(request, reply) {
    try {
      const { id } = request.params
      const pool = require('../db/pool')

      const result = await pool.query(`
        SELECT
          v.vlan_id,
          v.name,
          COUNT(DISTINCT ma.mac_address) as mac_count
        FROM vlans v
        JOIN mac_addresses ma ON v.vlan_id = ma.vlan_id
        WHERE ma.device_id = $1
        GROUP BY v.vlan_id, v.name
        ORDER BY v.vlan_id
      `, [id])

      reply.send({
        success: true,
        data: result.rows
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get MAC address statistics
   */
  static async getMacStats(request, reply) {
    try {
      const pool = require('../db/pool')

      // Get MAC count by VLAN (unique MAC addresses)
      const vlanStats = await pool.query(`
        SELECT vlan_id, COUNT(DISTINCT mac_address) as mac_count
        FROM mac_addresses
        GROUP BY vlan_id
        ORDER BY vlan_id
      `)

      // Get total MAC count
      const totalStats = await pool.query(`
        SELECT
          COUNT(*) as total_macs,
          COUNT(DISTINCT vlan_id) as vlans_with_macs,
          COUNT(DISTINCT device_id) as devices_with_macs
        FROM mac_addresses
      `)

      reply.send({
        success: true,
        data: {
          total: totalStats.rows[0],
          by_vlan: vlanStats.rows
        }
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Clear database tables
   */
  static async clearDatabase(request, reply) {
    try {
      const pool = require('../db/pool')

      // Delete data in correct order (considering foreign keys)
      await pool.query('DELETE FROM mac_addresses')
      await pool.query('DELETE FROM device_vlans')
      await pool.query('DELETE FROM device_ports')
      await pool.query('DELETE FROM device_configurations')
      await pool.query('DELETE FROM devices')
      await pool.query('DELETE FROM vlans')

      // Reset sequences
      await pool.query('ALTER SEQUENCE devices_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE device_ports_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE vlans_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE mac_addresses_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE device_vlans_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE device_configurations_id_seq RESTART WITH 1')

      reply.send({
        success: true,
        message: 'Database cleared successfully'
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Full reload: clear database and import fresh data
   */
  static async fullReload(request, reply) {
    try {
      const pool = require('../db/pool')

      // Clear database
      await pool.query('DELETE FROM mac_addresses')
      await pool.query('DELETE FROM device_vlans')
      await pool.query('DELETE FROM device_ports')
      await pool.query('DELETE FROM device_configurations')
      await pool.query('DELETE FROM devices')
      await pool.query('DELETE FROM vlans')

      // Reset sequences
      await pool.query('ALTER SEQUENCE devices_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE device_ports_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE vlans_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE mac_addresses_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE device_vlans_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE device_configurations_id_seq RESTART WITH 1')

      // Import new data
      const dataDir = path.join(process.cwd(), 'data')
      const results = await ImportService.importFromDirectory(dataDir)

      reply.send({
        success: true,
        message: 'Full reload completed successfully',
        results: {
          devicesImported: results.devices.length,
          macTablesImported: results.macTables.length,
          totalMacAddresses: results.totalMacEntries || 0,
          totalVlans: results.totalVlans || 0,
          errors: results.errors
        }
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get general statistics
   */
  static async getStats(request, reply) {
    try {
      const pool = require('../db/pool')

      const [devices, vlans, macs, ports] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM devices'),
        pool.query('SELECT COUNT(*) as count FROM vlans'),
        pool.query('SELECT COUNT(DISTINCT mac_address) as count FROM mac_addresses'),
        pool.query('SELECT COUNT(*) as count FROM device_ports')
      ])

      reply.send({
        success: true,
        data: {
          devices: parseInt(devices.rows[0].count),
          vlans: parseInt(vlans.rows[0].count),
          macs: parseInt(macs.rows[0].count),
          ports: parseInt(ports.rows[0].count)
        }
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Find MAC address in network
   */
  static async findMacAddress(request, reply) {
    try {
      const { macAddress } = request.params
      const pool = require('../db/pool')

      // Normalize MAC address (remove : and - symbols, convert to lowercase)
      let normalizedMac = macAddress.replace(/[:-\s]/g, '').toLowerCase()

      const query = `
        SELECT
          ma.mac_address,
          ma.vlan_id,
          d.ip_address as device_ip,
          d.hostname as device_hostname,
          dp.port_name
        FROM mac_addresses ma
        LEFT JOIN devices d ON ma.device_id = d.id
        LEFT JOIN device_ports dp ON ma.port_id = dp.id
        WHERE LOWER(REPLACE(REPLACE(ma.mac_address, ':', ''), '-', '')) = $1
        ORDER BY d.ip_address, dp.port_name
        LIMIT 10
      `

      const result = await pool.query(query, [normalizedMac])

      reply.send({
        success: true,
        data: result.rows,
        message: result.rows.length > 0 ? `Found ${result.rows.length} entries` : 'MAC address not found'
      })
    } catch (error) {
      console.error('❌ MAC search error:', error)
      reply.code(500).send({
        success: false,
        error: error.message,
        message: 'Error searching MAC address'
      })
    }
  }
}

module.exports = NetworkController
