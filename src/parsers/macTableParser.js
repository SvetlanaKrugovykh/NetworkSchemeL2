/**
 * MAC address table parser for various network equipment formats
 * Supports L2 network topology analysis with source/transit detection
 */
class MacTableParser {
  
  /**
   * Parse D-Link MAC address table format
   * Example format:
   * Command: show fdb
   * VLAN ID  MAC Address         Port        Type
   * ------- ----------------- ----------- ------------
   * 1        00-11-22-33-44-55   1          Dynamic
   * 100      AA-BB-CC-DD-EE-FF   5          Static
   */
  static parseDlinkMacTable(content, deviceInfo = null) {
    const lines = content.split('\n').map(line => line.trim())
    const macEntries = []
    
    let parsingTable = false
    
    for (const line of lines) {
      // Start parsing after the header separator
      if (line.includes('-------')) {
        parsingTable = true
        continue
      }
      
      if (!parsingTable || !line || line.startsWith('Command:')) {
        continue
      }
      
      // Parse the MAC table entry
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const vlanId = parseInt(parts[0])
        const macAddress = this.normalizeMacAddress(parts[1])
        const port = parts[2]
        const type = parts[3]
        
        if (this.isValidMacAddress(macAddress) && !isNaN(vlanId)) {
          macEntries.push({
            vlan_id: vlanId,
            mac_address: macAddress,
            port: port,
            learning_method: type.toLowerCase(),
            vendor: this.getMacVendor(macAddress),
            device_info: deviceInfo,
            raw_line: line,
            // Initialize topology fields - will be calculated by TopologyAnalyzer
            is_source: null,
            hop_count: null
          })
        }
      }
    }
    
    return macEntries
  }
  
  /**
   * Parse OLT MAC address table format (Cisco-style but with different port formats)
   * Example format:
   * Mac Address Table (Total 780)
   * ------------------------------------------
   * Vlan    Mac Address       Type       Ports
   * ----    -----------       ----       -----
   * 75      0021.a0f7.78d6    DYNAMIC    tg0/6
   * 23      0055.b11e.2a01    DYNAMIC    tg0/6
   */
  static parseOltMacTable(content, deviceInfo = null) {
    const lines = content.split('\n').map(line => line.trim())
    const macEntries = []
    
    let parsingTable = false
    
    for (const line of lines) {
      // Skip control characters and --More-- lines
      if (line.includes('--More--') || line.includes('CTRL+C') || 
          line.includes('[K') || line.includes('[1A') ||
          line.startsWith('[') || line.length === 0) {
        continue
      }
      
      // Start parsing after the header separator
      if (line.includes('----') || line.includes('--')) {
        parsingTable = true
        continue
      }
      
      if (!parsingTable || line.includes('Mac Address Table') || 
          line.includes('Vlan') || line.includes('VID')) {
        continue
      }
      
      // Parse the MAC table entry - handle both formats
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const vlanId = parseInt(parts[0])
        const macAddress = this.normalizeMacAddress(parts[1])
        const type = parts[2]
        const port = parts[3]
        
        if (this.isValidMacAddress(macAddress) && !isNaN(vlanId)) {
          macEntries.push({
            vlan_id: vlanId,
            mac_address: macAddress,
            port: port,
            learning_method: type.toLowerCase(),
            vendor: this.getMacVendor(macAddress),
            device_info: deviceInfo,
            raw_line: line,
            // Initialize topology fields - will be calculated by TopologyAnalyzer
            is_source: null,
            hop_count: null
          })
        }
      }
    }
    
    return macEntries
  }
  
  /**
   * Parse D-Link switch MAC address table format
   * Example format:
   * Command: show fdb
   * VID  VLAN Name                        MAC Address       Port Type
   * ---- -------------------------------- ----------------- ---- ---------------
   * 1    default                          C0-A0-BB-D4-D7-D1 CPU  Self
   * 80   80                               00-14-A9-26-5C-31 25   Dynamic
   */
  static parseDlinkSwitchMacTable(content, deviceInfo = null) {
    const lines = content.split('\n').map(line => line.trim())
    const macEntries = []
    
    let parsingTable = false
    
    for (const line of lines) {
      // Skip control characters and quit prompts
      if (line.includes('CTRL+C') || line.includes('[K') || 
          line.includes('Quit') || line.includes('[1m') ||
          line.startsWith('[') || line.length === 0) {
        continue
      }
      
      // Start parsing after the header separator
      if (line.includes('---- ') && line.includes('-')) {
        parsingTable = true
        continue
      }
      
      if (!parsingTable || line.includes('Command:') || line.includes('VID') || 
          line.includes('VLAN Name')) {
        continue
      }
      
      // Parse the MAC table entry - D-Link format
      const parts = line.split(/\s+/)
      if (parts.length >= 5) {
        const vlanId = parseInt(parts[0])
        const vlanName = parts[1] // Skip VLAN name  
        const macAddress = this.normalizeMacAddress(parts[2])
        const port = parts[3]
        const type = parts[4] || 'Dynamic'
        
        // Skip CPU/Self entries
        if (port === 'CPU' || type === 'Self') {
          continue
        }
        
        if (this.isValidMacAddress(macAddress) && !isNaN(vlanId)) {
          macEntries.push({
            vlan_id: vlanId,
            mac_address: macAddress,
            port: port,
            learning_method: type.toLowerCase(),
            vendor: this.getMacVendor(macAddress),
            device_info: deviceInfo,
            raw_line: line,
            // Initialize topology fields - will be calculated by TopologyAnalyzer
            is_source: null,
            hop_count: null
          })
        }
      }
    }
    
    return macEntries
  }
  
  /**
   * Auto-detect MAC table format and parse accordingly
   */
  static parseGenericMacTable(content, deviceInfo = null) {
    const lines = content.split('\n')
    
    // Check for OLT format indicators (with total count and specific headers)
    if (content.includes('Mac Address Table (Total') || 
        (content.includes('Vlan') && content.includes('Mac Address') && 
         content.includes('Type') && content.includes('Ports') &&
         lines.some(line => line.includes('xxxx.xxxx.xxxx') || /\d{4}\.\d{4}\.\d{4}/.test(line)))) {
      return this.parseOltMacTable(content, deviceInfo)
    }
    
    // Check for D-Link switch format indicators
    if (content.includes('Command: show fdb') && content.includes('VID')) {
      return this.parseDlinkSwitchMacTable(content, deviceInfo)
    }
    
    // Check for standard D-Link format indicators
    if (content.includes('Command: show fdb') || 
        lines.some(line => line.includes('Type') && line.includes('Port') && line.includes('MAC Address'))) {
      return this.parseDlinkMacTable(content, deviceInfo)
    }
    
    // Check for Cisco format indicators
    if (lines.some(line => line.includes('VLAN') && line.includes('MAC Address') && line.includes('Ports'))) {
      return this.parseOltMacTable(content, deviceInfo)
    }
    
    // Try formats in order of specificity
    let result = this.parseOltMacTable(content, deviceInfo)
    if (result.length > 0) {
      return result
    }
    
    result = this.parseDlinkSwitchMacTable(content, deviceInfo)
    if (result.length > 0) {
      return result
    }
    
    return this.parseDlinkMacTable(content, deviceInfo)
  }
  
  /**
   * Parse MAC table with enhanced context for topology analysis
   * @param {string} content - Raw MAC table content
   * @param {Object} context - Additional context (device info, port mappings, etc.)
   */
  static parseWithTopologyContext(content, context = {}) {
    const entries = this.parseGenericMacTable(content, context.deviceInfo)
    
    // Enhance entries with port context if available
    if (context.portMappings) {
      entries.forEach(entry => {
        const portInfo = context.portMappings[entry.port]
        if (portInfo) {
          entry.port_type = portInfo.type
          entry.port_description = portInfo.description
          entry.port_mode = portInfo.mode
          entry.native_vlan = portInfo.native_vlan
        }
      })
    }
    
    return entries
  }
  
  /**
   * Normalize MAC address to standard format (lowercase with colons)
   * Supports multiple input formats: xx:xx:xx:xx:xx:xx, xx-xx-xx-xx-xx-xx, xxxx.xxxx.xxxx
   */
  static normalizeMacAddress(macStr) {
    if (!macStr) return null
    
    // Remove all separators and convert to lowercase
    const cleanMac = macStr.replace(/[-:\.]/g, '').toLowerCase()
    
    // Validate length (should be 12 hex characters)
    if (cleanMac.length !== 12 || !/^[0-9a-f]{12}$/.test(cleanMac)) {
      return null
    }
    
    // Add colons every 2 characters
    return cleanMac.match(/.{2}/g).join(':')
  }
  
  /**
   * Validate MAC address format
   */
  static isValidMacAddress(macStr) {
    if (!macStr) return false
    
    const macPattern = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i
    return macPattern.test(macStr)
  }
  
  /**
   * Extract vendor information from MAC address (OUI lookup)
   */
  static getMacVendor(macAddress) {
    if (!this.isValidMacAddress(macAddress)) {
      return null
    }
    
    const oui = macAddress.split(':').slice(0, 3).join(':').toUpperCase()
    
    // Extended OUI mappings for network equipment identification
    const ouiMap = {
      '00:11:22': 'D-Link',
      '00:17:9A': 'D-Link',
      '00:1B:11': 'D-Link',
      '00:1C:F0': 'D-Link',
      '00:50:56': 'VMware',
      '08:00:27': 'Oracle VirtualBox',
      '52:54:00': 'QEMU/KVM',
      '00:0C:29': 'VMware',
      '00:15:5D': 'Microsoft Hyper-V',
      '00:1B:21': 'Intel',
      '00:23:24': 'Dell',
      '00:25:90': 'Cisco',
      '00:26:0A': 'Cisco',
      '00:0F:34': 'Cisco',
      '00:1A:30': 'Cisco',
      '70:72:CF': 'Cisco',
      '00:04:96': 'Cisco',
      '00:30:96': 'Cisco',
      '00:08:2F': 'Cisco',
      '00:60:5C': 'Cisco',
      '00:90:0B': 'Cisco',
      '00:A0:24': 'Cisco',
      '00:E0:1E': 'Cisco',
      '40:55:39': 'Cisco',
      '00:1D:71': 'Huawei',
      '00:25:9E': 'Huawei',
      '4C:54:99': 'Huawei',
      '00:E0:FC': 'Huawei',
      '00:46:70': 'Huawei',
      '28:6E:D4': 'Huawei',
      '6C:92:BF': 'Huawei',
      '00:03:0F': 'HP',
      '00:08:02': 'HP',
      '00:0B:CD': 'HP',
      '00:11:85': 'HP',
      '00:13:21': 'HP',
      '00:15:60': 'HP',
      '00:16:35': 'HP',
      '00:17:A4': 'HP',
      '00:18:71': 'HP',
      '00:19:BB': 'HP',
      '00:1A:4B': 'HP',
      '00:1B:78': 'HP',
      '00:1C:C4': 'HP',
      '00:1E:0B': 'HP',
      '00:1F:29': 'HP',
      '00:21:5A': 'HP',
      '00:22:64': 'HP',
      '00:23:7D': 'HP',
      '00:24:81': 'HP',
      '00:25:B3': 'HP'
    }
    
    return ouiMap[oui] || 'Unknown'
  }
  
  /**
   * Analyze MAC address patterns to help identify device types
   * @param {Array} macEntries - Array of MAC entries
   */
  static analyzeMacPatterns(macEntries) {
    const analysis = {
      total_macs: macEntries.length,
      unique_macs: new Set(macEntries.map(e => e.mac_address)).size,
      vendors: {},
      vlans: {},
      ports: {},
      learning_methods: {}
    }
    
    macEntries.forEach(entry => {
      // Count vendors
      const vendor = entry.vendor || 'Unknown'
      analysis.vendors[vendor] = (analysis.vendors[vendor] || 0) + 1
      
      // Count VLANs
      analysis.vlans[entry.vlan_id] = (analysis.vlans[entry.vlan_id] || 0) + 1
      
      // Count ports
      analysis.ports[entry.port] = (analysis.ports[entry.port] || 0) + 1
      
      // Count learning methods
      const method = entry.learning_method || 'unknown'
      analysis.learning_methods[method] = (analysis.learning_methods[method] || 0) + 1
    })
    
    return analysis
  }
}

module.exports = MacTableParser
