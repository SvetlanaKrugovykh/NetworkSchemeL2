/**
 * MAC table parser for various device types
 */

class MacTableParser {
  /**
   * Parse D-Link switch MAC table
   * @param {string} macTableText - MAC table text
   * @param {string} deviceIp - device IP address
   * @returns {Array} - array of MAC entries
   */
  static parseDLinkMacTable(macTableText, deviceIp) {
    const macEntries = []
    const lines = macTableText.split('\n').map(line => line.trim())
    
    for (const line of lines) {
      // D-Link format: VID  VLAN Name  MAC Address  Port  Type  Status
      const match = line.match(/^\s*(\d+)\s+(\S+)\s+([0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2})\s+(\d+)\s+(\w+)\s+(\w+)/)
      
      if (match) {
        const [, vlanId, vlanName, macAddress, portNumber, type, status] = match
        
        macEntries.push({
          mac_address: this.normalizeMacAddress(macAddress),
          vlan_id: parseInt(vlanId),
          port_number: parseInt(portNumber),
          device_ip: deviceIp,
          status: type.toLowerCase(), // Dynamic/Static
          last_seen: new Date(),
          client_type: null, // will be determined later
          description: null
        })
      }
    }
    
    return macEntries
  }

  /**
   * Parse MAC table for Cisco-like format devices
   * @param {string} macTableText - MAC table text
   * @param {string} deviceIp - device IP address
   * @returns {Array} - array of MAC entries
   */
  static parseCiscoLikeMacTable(macTableText, deviceIp) {
    const macEntries = []
    const lines = macTableText.split('\n').map(line => line.trim())
    
    for (const line of lines) {
      // Format: Vlan Mac Address Type Ports
      const match = line.match(/^\s*(\d+)\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\w+)\s+(.+)/)
      
      if (match) {
        const [, vlanId, macAddress, type, ports] = match
        
        // Extract port number from ports string
        const portMatch = ports.match(/(\d+)/)
        const portNumber = portMatch ? parseInt(portMatch[1]) : null
        
        macEntries.push({
          mac_address: this.normalizeMacAddress(macAddress),
          vlan_id: parseInt(vlanId),
          port_number: portNumber,
          device_ip: deviceIp,
          status: type.toLowerCase(),
          last_seen: new Date(),
          client_type: null,
          description: null
        })
      }
    }
    
    return macEntries
  }

  /**
   * Automatic format detection and parsing
   * @param {string} macTableText - MAC table text
   * @param {string} deviceIp - device IP address
   * @returns {Array} - array of MAC entries
   */
  static parseAuto(macTableText, deviceIp) {
    // Determine format by characteristic features
    if (macTableText.includes('VID') && macTableText.includes('VLAN Name')) {
      return this.parseDLinkMacTable(macTableText, deviceIp)
    } else if (macTableText.includes('Mac Address Table')) {
      return this.parseCiscoLikeMacTable(macTableText, deviceIp)
    } else {
      console.warn(`Unknown MAC table format for device ${deviceIp}`)
      return []
    }
  }

  /**
   * Normalize MAC address to standard format
   * @param {string} macAddress - MAC address in any format
   * @returns {string} - normalized MAC address
   */
  static normalizeMacAddress(macAddress) {
    // Remove all separators and convert to lowercase
    const cleanMac = macAddress.replace(/[-:\.]/g, '').toLowerCase()
    
    // Check correct length
    if (cleanMac.length !== 12) {
      throw new Error(`Invalid MAC address: ${macAddress}`)
    }
    
    // Return in xx:xx:xx:xx:xx:xx format
    return cleanMac.match(/.{2}/g).join(':')
  }

  /**
   * Detect client type by MAC address (based on OUI)
   * @param {string} macAddress - MAC address
   * @returns {string} - device type
   */
  static detectDeviceType(macAddress) {
    const oui = macAddress.substring(0, 8).replace(/:/g, '').toLowerCase()
    
    // Known OUI manufacturers
    const ouiDatabase = {
      // Routers/switches
      '001122': 'network_device',
      '000e38': 'network_device', // D-Link
      '001cf0': 'network_device', // D-Link
      
      // Computers/laptops
      '001e58': 'computer', // Dell
      '0021cc': 'computer', // HP
      '002564': 'computer', // Apple
      
      // IP cameras
      '001788': 'camera',
      '9ceb': 'camera',
      
      // Default
      default: 'unknown'
    }
    
    return ouiDatabase[oui] || ouiDatabase.default
  }
}

module.exports = MacTableParser
