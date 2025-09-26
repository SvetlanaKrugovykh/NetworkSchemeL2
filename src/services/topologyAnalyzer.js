const pool = require('../db/pool')

/**
 * Network topology analyzer - determines source vs transit MAC locations
 * 
 * DEVICE-SPECIFIC LOGIC:
 * - OLT devices: EPON interfaces (epon0/1:1...epon0/8:64) are subscriber access ports
 * - Switches: Access/untagged ports are rare but when present - likely sources
 * - General: Ports with fewer MAC addresses are typically closer to source
 * 
 * LIMITATIONS: 
 * - Real hop count calculation requires SNMP integration
 * - Currently uses basic heuristics: OLT EPON ports > access ports > MAC count patterns
 * - For accurate topology mapping, integrate with SNMP service for:
 *   * CDP/LLDP neighbor discovery
 *   * STP root path analysis  
 *   * Link state monitoring
 *   * Routing table analysis
 */
class TopologyAnalyzer {
  
  /**
   * Analyze MAC address locations and determine sources
   * @param {string} macAddress - MAC address to analyze
   * @param {number} vlanId - VLAN ID to analyze within
   */
  static async analyzeMacLocation(macAddress, vlanId) {
    const query = `
      SELECT 
        ma.id,
        ma.mac_address,
        ma.device_id,
        ma.port_id,
        ma.vlan_id,
        d.ip_address as device_ip,
        d.hostname as device_hostname,
        dp.port_number,
        dp.port_type,
        NULL as port_mode,
        NULL as native_vlan,
        (SELECT COUNT(*) FROM mac_addresses ma2 
         WHERE ma2.device_id = ma.device_id AND ma2.port_id = ma.port_id 
         AND ma2.vlan_id = ma.vlan_id) as port_mac_count
      FROM mac_addresses ma
      JOIN devices d ON ma.device_id = d.id
      LEFT JOIN device_ports dp ON ma.port_id = dp.id
      WHERE ma.mac_address = $1 AND ma.vlan_id = $2
      ORDER BY port_mac_count ASC, d.ip_address
    `
    
    const result = await pool.query(query, [macAddress, vlanId])
    
    if (result.rows.length === 0) {
      return []
    }
    
    // Determine source location using enhanced heuristics
    const locations = result.rows
    let sourceLocation = null
    
    // Priority 1: Subscriber access ports (OLT EPON interfaces, switch access ports)
    const accessPorts = locations.filter(loc => this.isSubscriberAccessPort(loc))
    
    if (accessPorts.length > 0) {
      // If multiple access ports, choose the one with fewer MAC addresses
      sourceLocation = accessPorts.sort((a, b) => a.port_mac_count - b.port_mac_count)[0]
    } else {
      // Priority 2: Port with fewest MAC addresses (likely closest to source)
      sourceLocation = locations[0] // Already sorted by port_mac_count ASC
    }
    
    // Update database with source/transit information
    await this.updateMacLocationTypes(locations, sourceLocation)
    
    return locations.map(loc => ({
      ...loc,
      is_source: loc.id === sourceLocation.id,
      // Distance calculation removed - requires SNMP topology data
      hop_count: loc.id === sourceLocation.id ? 0 : null
    }))
  }
  
  /**
   * Update MAC address records with source/transit flags
   */
  static async updateMacLocationTypes(locations, sourceLocation) {
    for (const location of locations) {
      const isSource = location.id === sourceLocation.id
      // For now, set hop_count to null for transit locations
      // Real hop count requires SNMP data (CDP/LLDP neighbors, STP paths)
      const hopCount = isSource ? 0 : null
      
      await pool.query(`
        UPDATE mac_addresses 
        SET is_source = $1, hop_count = $2 
        WHERE id = $3
      `, [isSource, hopCount, location.id])
    }
  }
  
  /**
   * Calculate network distance (placeholder for SNMP-based analysis)
   * TODO: Implement real topology discovery using:
   * - SNMP CDP/LLDP neighbor discovery  
   * - STP root path cost analysis
   * - Routing table analysis
   * - Physical link state monitoring
   */
  static calculateNetworkDistance(location, sourceLocation) {
    // Placeholder - real implementation needs SNMP service integration
    // For now, return null to indicate unknown distance
    return null
  }
  
  /**
   * Determine if port is likely a subscriber access port
   * @param {Object} location - Location data with device and port info
   */
  static isSubscriberAccessPort(location) {
    const deviceHostname = (location.device_hostname || '').toLowerCase()
    const deviceType = (location.device_type || '').toLowerCase()
    const portNumber = location.port_number || ''
    const portType = (location.port_type || '').toLowerCase()
    
    // OLT EPON interfaces (e.g., epon0/1:1, epon-0/8:64)
    if (deviceType.includes('olt') || deviceHostname.includes('olt')) {
      if (portType.includes('epon') || /epon[\d\-\/:]/.test(portNumber)) {
        return true
      }
    }
    
    // Switch access ports (rare but when present)
    if (location.port_mode === 'access' || location.port_mode === 'untagged') {
      return true
    }
    
    return false
  }
  
  /**
   * Analyze complete VLAN topology
   * @param {number} vlanId - VLAN ID to analyze
   */
  static async analyzeVlanTopology(vlanId) {
    // Get all unique MAC addresses in this VLAN
    const macQuery = `
      SELECT DISTINCT mac_address 
      FROM mac_addresses 
      WHERE vlan_id = $1
    `
    const macResult = await pool.query(macQuery, [vlanId])
    
    const topologyData = []
    
    // Analyze each MAC address
    for (const macRow of macResult.rows) {
      const macAnalysis = await this.analyzeMacLocation(macRow.mac_address, vlanId)
      topologyData.push({
        mac_address: macRow.mac_address,
        locations: macAnalysis
      })
    }
    
    return topologyData
  }
  
  /**
   * Get VLAN topology with source/transit classification
   * @param {number} vlanId - VLAN ID
   */
  static async getVlanTopologyWithPath(vlanId) {
    const query = `
      SELECT 
        d.id as device_id,
        d.hostname,
        d.ip_address,
        d.device_type,
        dp.id as port_id,
        dp.port_number,
        dp.port_name,
        dp.description as port_description,
        v.name as vlan_name,
        v.description as vlan_description,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'mac_address', ma.mac_address,
              'ip_address', ma.ip_address,
              'description', ma.description,
              'client_type', ma.client_type,
              'is_source', ma.is_source,
              'hop_count', ma.hop_count,
              'last_seen', ma.last_seen
            )
          )
          FROM mac_addresses ma 
          WHERE ma.device_id = d.id 
            AND ma.port_id = dp.id 
            AND ma.vlan_id = $1),
          '[]'::json
        ) as mac_addresses
      FROM mac_addresses ma
      JOIN devices d ON ma.device_id = d.id
      JOIN device_ports dp ON ma.port_id = dp.id
      JOIN vlans v ON ma.vlan_id = v.vlan_id
      WHERE ma.vlan_id = $1
      GROUP BY d.id, d.hostname, d.ip_address, d.device_type, dp.id, dp.port_number, dp.port_name, dp.description, v.name, v.description
      ORDER BY d.ip_address, dp.port_number
    `

    const result = await pool.query(query, [vlanId])

    // Group by devices
    const deviceMap = {}

    result.rows.forEach(row => {
      if (!deviceMap[row.device_id]) {
        deviceMap[row.device_id] = {
          device_id: row.device_id,
          hostname: row.hostname,
          ip_address: row.ip_address,
          device_type: row.device_type,
          ports: []
        }
      }

      deviceMap[row.device_id].ports.push({
        port_id: row.port_id,
        port_number: row.port_number,
        port_name: row.port_name,
        port_description: row.port_description,
        mac_addresses: row.mac_addresses || []
      })
    })
    
    return {
      vlan_id: vlanId,
      vlan_name: result.rows[0]?.vlan_name || `VLAN${vlanId}`,
      vlan_description: result.rows[0]?.vlan_description || '',
      devices: Object.values(deviceMap)
    }
  }
}

module.exports = TopologyAnalyzer
