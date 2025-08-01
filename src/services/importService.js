const DlinkConfigParser = require('../parsers/dlinkConfigParser')
const MacTableParser = require('../parsers/macTableParser')
const TopologyAnalyzer = require('./topologyAnalyzer')
const DeviceModel = require('../models/deviceModel')
const VlanModel = require('../models/vlanModel')
const pool = require('../db/pool')

/**
 * Import service for network configurations and MAC tables
 * Handles L2 topology analysis with source/transit detection
 */
class ImportService {
  
  /**
   * Import D-Link switch configuration
   * @param {string} configText - Configuration text
   * @param {string} deviceIp - Device IP address
   */
  static async importDlinkConfig(configText, deviceIp) {
    try {
      const parsedConfig = DlinkConfigParser.parseConfig(configText)
      
      // Create or update device
      const deviceId = await DeviceModel.createOrUpdate({
        ip_address: deviceIp,
        hostname: parsedConfig.deviceInfo.hostname || `dlink-${deviceIp}`,
        device_type: parsedConfig.deviceInfo.model || 'D-Link Switch',
        description: `Imported from configuration on ${new Date().toISOString()}`,
        mac_address: parsedConfig.deviceInfo.systemMac || null,
        serial_number: parsedConfig.deviceInfo.serialNumber || null,
        firmware_version: parsedConfig.deviceInfo.firmwareVersion || null,
        hardware_version: parsedConfig.deviceInfo.hardwareVersion || null
      })
      
      console.log(`Device imported/updated: ${deviceIp} (ID: ${deviceId})`)
      
      // Import VLANs
      for (const vlan of parsedConfig.vlans) {
        await VlanModel.createOrUpdate({
          vlan_id: vlan.vlan_id,
          name: vlan.name,
          description: vlan.description || `VLAN ${vlan.vlan_id}`,
          type: vlan.type || 'ethernet'
        })
        
        console.log(`VLAN imported: ${vlan.vlan_id} (${vlan.name})`)
      }
      
      // Import ports and VLAN assignments
      for (const port of parsedConfig.ports) {
        // Create port
        const portResult = await pool.query(`
          INSERT INTO device_ports (device_id, port_number, port_name, port_type, description, admin_state, oper_state)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (device_id, port_number) 
          DO UPDATE SET 
            port_name = EXCLUDED.port_name,
            port_type = EXCLUDED.port_type,
            description = EXCLUDED.description,
            admin_state = EXCLUDED.admin_state,
            oper_state = EXCLUDED.oper_state
          RETURNING id
        `, [
          deviceId,
          port.port_number,
          port.name || `port${port.port_number}`,
          port.type || 'ethernet',
          port.description || null,
          port.admin_state || 'up',
          port.oper_state || 'unknown'
        ])
        
        const portId = portResult.rows[0].id
        
        // Import VLAN assignments for this port
        if (port.vlans && port.vlans.length > 0) {
          for (const vlanAssignment of port.vlans) {
            await pool.query(`
              INSERT INTO device_vlans (device_id, port_id, vlan_id, mode, native_vlan, qinq_enabled)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (device_id, port_id, vlan_id)
              DO UPDATE SET 
                mode = EXCLUDED.mode,
                native_vlan = EXCLUDED.native_vlan,
                qinq_enabled = EXCLUDED.qinq_enabled
            `, [
              deviceId,
              portId,
              vlanAssignment.vlan_id,
              vlanAssignment.mode || 'tagged',
              vlanAssignment.native || false,
              vlanAssignment.qinq || false
            ])
          }
        }
        
        console.log(`Port imported: ${port.port_number} with ${port.vlans?.length || 0} VLAN assignments`)
      }
      
      return {
        success: true,
        device_id: deviceId,
        message: `Successfully imported configuration for ${deviceIp}`,
        stats: {
          vlans_imported: parsedConfig.vlans.length,
          ports_imported: parsedConfig.ports.length,
          device_info: parsedConfig.deviceInfo
        }
      }
      
    } catch (error) {
      console.error('Error importing D-Link configuration:', error)
      return {
        success: false,
        error: error.message,
        message: `Failed to import configuration for ${deviceIp}`
      }
    }
  }
  
  /**
   * Import MAC address table with topology analysis
   * @param {string} macTableText - MAC table text
   * @param {string} deviceIp - Device IP address
   * @param {string} format - Format hint ('dlink', 'cisco', 'auto')
   */
  static async importMacTable(macTableText, deviceIp, format = 'auto') {
    try {
      // Get device information
      const deviceResult = await pool.query(
        'SELECT id, hostname, device_type FROM devices WHERE ip_address = $1',
        [deviceIp]
      )
      
      if (deviceResult.rows.length === 0) {
        throw new Error(`Device not found: ${deviceIp}. Please import device configuration first.`)
      }
      
      const device = deviceResult.rows[0]
      
      // Get port mappings for enhanced parsing
      const portMappings = await this.getPortMappings(device.id)
      
      // Parse MAC table entries
      let macEntries
      if (format === 'dlink') {
        macEntries = MacTableParser.parseDlinkMacTable(macTableText, device)
      } else if (format === 'cisco') {
        macEntries = MacTableParser.parseCiscoMacTable(macTableText, device)
      } else {
        macEntries = MacTableParser.parseWithTopologyContext(macTableText, {
          deviceInfo: device,
          portMappings
        })
      }
      
      if (macEntries.length === 0) {
        return {
          success: false,
          message: 'No MAC entries found in the provided table',
          stats: { entries_processed: 0, entries_imported: 0 }
        }
      }
      
      let importedCount = 0
      const failedEntries = []
      
      // Import MAC entries with enhanced error handling
      for (const entry of macEntries) {
        try {
          // Find port ID by port number/name
          const portId = await this.resolvePortId(device.id, entry.port, portMappings)
          
          if (!portId) {
            failedEntries.push({
              mac: entry.mac_address,
              reason: `Port not found: ${entry.port}`
            })
            continue
          }
          
          // Insert MAC address entry
          await pool.query(`
            INSERT INTO mac_addresses (
              mac_address, vlan_id, device_id, port_id, 
              ip_address, description, client_type, 
              learning_method, last_seen, is_source, hop_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (mac_address, device_id, port_id, vlan_id)
            DO UPDATE SET 
              learning_method = EXCLUDED.learning_method,
              last_seen = EXCLUDED.last_seen,
              description = COALESCE(EXCLUDED.description, mac_addresses.description),
              client_type = COALESCE(EXCLUDED.client_type, mac_addresses.client_type)
          `, [
            entry.mac_address,
            entry.vlan_id,
            device.id,
            portId,
            null, // IP address - to be resolved later
            entry.description || null,
            entry.client_type || this.detectClientType(entry.mac_address, entry.vendor),
            entry.learning_method || 'dynamic',
            new Date(),
            entry.is_source, // Will be null initially, analyzed later
            entry.hop_count // Will be null initially, calculated later
          ])
          
          importedCount++
          
        } catch (entryError) {
          console.error(`Error importing MAC entry ${entry.mac_address}:`, entryError)
          failedEntries.push({
            mac: entry.mac_address,
            reason: entryError.message
          })
        }
      }
      
      // Perform topology analysis for all imported VLANs
      const uniqueVlans = [...new Set(macEntries.map(e => e.vlan_id))]
      const topologyResults = []
      
      for (const vlanId of uniqueVlans) {
        try {
          const topology = await TopologyAnalyzer.analyzeVlanTopology(vlanId)
          topologyResults.push({
            vlan_id: vlanId,
            analysis_complete: true,
            mac_sources_identified: topology.filter(t => 
              t.locations.some(l => l.is_source)
            ).length
          })
        } catch (analysisError) {
          console.error(`Topology analysis failed for VLAN ${vlanId}:`, analysisError)
          topologyResults.push({
            vlan_id: vlanId,
            analysis_complete: false,
            error: analysisError.message
          })
        }
      }
      
      return {
        success: true,
        message: `Successfully imported MAC table for ${deviceIp}`,
        stats: {
          entries_processed: macEntries.length,
          entries_imported: importedCount,
          entries_failed: failedEntries.length,
          vlans_analyzed: uniqueVlans.length,
          device_ip: deviceIp,
          device_hostname: device.hostname
        },
        topology_analysis: topologyResults,
        failed_entries: failedEntries.length > 0 ? failedEntries : undefined
      }
      
    } catch (error) {
      console.error('Error importing MAC table:', error)
      return {
        success: false,
        error: error.message,
        message: `Failed to import MAC table for ${deviceIp}`
      }
    }
  }
  
  /**
   * Get port mappings for a device
   * @param {number} deviceId - Device ID
   */
  static async getPortMappings(deviceId) {
    const result = await pool.query(`
      SELECT 
        dp.id,
        dp.port_number,
        dp.port_name,
        dp.port_type,
        dp.description,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'vlan_id', dv.vlan_id,
              'mode', dv.mode,
              'native_vlan', dv.native_vlan
            )
          )
          FROM device_vlans dv 
          WHERE dv.port_id = dp.id),
          '[]'::json
        ) as vlans
      FROM device_ports dp
      WHERE dp.device_id = $1
    `, [deviceId])
    
    const mappings = {}
    
    result.rows.forEach(port => {
      // Map by port number
      mappings[port.port_number.toString()] = {
        id: port.id,
        type: port.port_type,
        description: port.description,
        vlans: port.vlans,
        // Determine port mode based on VLAN configuration
        mode: this.determinePortMode(port.vlans),
        native_vlan: this.getNativeVlan(port.vlans)
      }
      
      // Also map by port name if available
      if (port.port_name && port.port_name !== port.port_number.toString()) {
        mappings[port.port_name] = mappings[port.port_number.toString()]
      }
    })
    
    return mappings
  }
  
  /**
   * Resolve port ID from port identifier
   * @param {number} deviceId - Device ID
   * @param {string} portIdentifier - Port number or name
   * @param {Object} portMappings - Pre-loaded port mappings
   */
  static async resolvePortId(deviceId, portIdentifier, portMappings = null) {
    if (portMappings && portMappings[portIdentifier]) {
      return portMappings[portIdentifier].id
    }
    
    // Fallback to database query
    const result = await pool.query(`
      SELECT id FROM device_ports 
      WHERE device_id = $1 AND (port_number = $2 OR port_name = $3)
      LIMIT 1
    `, [deviceId, parseInt(portIdentifier) || 0, portIdentifier])
    
    return result.rows.length > 0 ? result.rows[0].id : null
  }
  
  /**
   * Determine port mode based on VLAN configuration
   * @param {Array} vlans - VLAN configurations
   */
  static determinePortMode(vlans) {
    if (!vlans || vlans.length === 0) {
      return 'unknown'
    }
    
    const hasUntagged = vlans.some(v => v.mode === 'untagged' || v.native_vlan)
    const hasTagged = vlans.some(v => v.mode === 'tagged')
    
    if (hasUntagged && hasTagged) {
      return 'hybrid'
    } else if (hasUntagged) {
      return 'access'
    } else if (hasTagged) {
      return 'trunk'
    }
    
    return 'unknown'
  }
  
  /**
   * Get native VLAN from port configuration
   * @param {Array} vlans - VLAN configurations
   */
  static getNativeVlan(vlans) {
    if (!vlans || vlans.length === 0) {
      return null
    }
    
    const nativeVlan = vlans.find(v => v.native_vlan || v.mode === 'untagged')
    return nativeVlan ? nativeVlan.vlan_id : null
  }
  
  /**
   * Detect client type from MAC address and vendor
   * @param {string} macAddress - MAC address
   * @param {string} vendor - Vendor name
   */
  static detectClientType(macAddress, vendor) {
    if (!vendor || vendor === 'Unknown') {
      return 'unknown'
    }
    
    const vendorLower = vendor.toLowerCase()
    
    // Network infrastructure
    if (['cisco', 'd-link', 'huawei', 'hp', 'juniper', 'aruba'].some(v => vendorLower.includes(v))) {
      return 'network_device'
    }
    
    // Virtualization
    if (['vmware', 'virtualbox', 'qemu', 'hyper-v'].some(v => vendorLower.includes(v))) {
      return 'virtual_machine'
    }
    
    // Computing devices
    if (['intel', 'dell', 'apple', 'lenovo', 'asus'].some(v => vendorLower.includes(v))) {
      return 'computer'
    }
    
    return 'device'
  }
  
  /**
   * Get import statistics for a device
   * @param {string} deviceIp - Device IP address
   */
  static async getImportStats(deviceIp) {
    const result = await pool.query(`
      SELECT 
        d.id,
        d.hostname,
        d.device_type,
        (SELECT COUNT(*) FROM device_ports WHERE device_id = d.id) as total_ports,
        (SELECT COUNT(DISTINCT vlan_id) FROM device_vlans WHERE device_id = d.id) as total_vlans,
        (SELECT COUNT(*) FROM mac_addresses WHERE device_id = d.id) as total_macs,
        (SELECT COUNT(*) FROM mac_addresses WHERE device_id = d.id AND is_source = true) as source_macs,
        (SELECT COUNT(*) FROM mac_addresses WHERE device_id = d.id AND is_source = false) as transit_macs
      FROM devices d
      WHERE d.ip_address = $1
    `, [deviceIp])
    
    if (result.rows.length === 0) {
      return null
    }
    
    return result.rows[0]
  }
}

module.exports = ImportService
