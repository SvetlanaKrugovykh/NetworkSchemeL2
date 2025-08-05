/**
 * OLT (Optical Line Terminal) configuration parser
 * Supports EPON interfaces and subscriber access ports
 */

class OltConfigParser {
  constructor() {
    this.deviceInfo = {
      model: null,
      firmware: null,
      hostname: null,
      ip: null,
      type: 'OLT'
    }
    this.ports = []
    this.vlans = []
    this.deviceVlans = []
    this.eponPorts = []
    this.subscribers = []
  }

  /**
   * Main configuration parsing method
   * @param {string} configText - configuration text
   * @param {string} deviceIp - device IP address
   * @returns {Object} - parsed data
   */
  parse(configText, deviceIp) {
    this.deviceInfo.ip = deviceIp
    const lines = configText.split('\n').map(line => line.trim())
    
    this.parseDeviceInfo(lines)
    this.parsePorts(lines)
    this.parseVlans(lines)
    this.parseEponInterfaces(lines)
    
    return {
      device: this.deviceInfo,
      ports: this.ports,
      vlans: this.vlans,
      deviceVlans: this.deviceVlans,
      eponPorts: this.eponPorts,
      subscribers: this.subscribers
    }
  }

  /**
   * Parse device information from OLT config
   */
  parseDeviceInfo(lines) {
    for (const line of lines) {
      // Hostname
      if (line.startsWith('hostname ')) {
        this.deviceInfo.hostname = line.replace('hostname ', '').trim()
      }
      
      // Version info
      if (line.includes('version ') && line.includes('build')) {
        const match = line.match(/version\s+(\S+)\s+build\s+(\S+)/)
        if (match) {
          this.deviceInfo.firmware = `${match[1]} build ${match[2]}`
        }
      }
      
      // Model detection from hostname or context
      if (line.includes('OLT') || this.deviceInfo.hostname?.includes('OLT')) {
        this.deviceInfo.model = 'OLT_EPON'
      }
    }
    
    if (!this.deviceInfo.hostname) {
      this.deviceInfo.hostname = `OLT_${this.deviceInfo.ip?.replace(/\./g, '_')}`
    }
  }

  /**
   * Parse physical ports (GigaEthernet, TGigaEthernet)
   */
  parsePorts(lines) {
    let currentInterface = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // GigaEthernet and TGigaEthernet interfaces
      const interfaceMatch = line.match(/^interface\s+((?:T?GigaEthernet|EPON)\d+\/\d+(?::\d+)?)/)
      if (interfaceMatch) {
        const interfaceName = interfaceMatch[1]
        
        // Skip EPON subscriber interfaces - they'll be handled separately
        if (interfaceName.includes(':')) {
          continue
        }
        
        currentInterface = {
          port_number: this.extractPortNumber(interfaceName),
          port_name: interfaceName,
          port_type: this.determinePortType(interfaceName),
          description: null,
          status: 'up',
          speed: this.determinePortSpeed(interfaceName),
          duplex: 'full',
          mode: null,
          vlans: [],
          native_vlan: null
        }
        this.ports.push(currentInterface)
        continue
      }
      
      // Parse interface configuration
      if (currentInterface && line.startsWith(' ')) {
        this.parseInterfaceConfig(line.trim(), currentInterface)
      } else if (!line.startsWith(' ')) {
        currentInterface = null
      }
    }
  }

  /**
   * Parse EPON interfaces and subscriber connections
   */
  parseEponInterfaces(lines) {
    let currentEponInterface = null
    let currentSubscriber = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // EPON port (e.g., EPON0/1)
      const eponPortMatch = line.match(/^interface\s+(EPON\d+\/\d+)$/)
      if (eponPortMatch) {
        const eponName = eponPortMatch[1]
        currentEponInterface = {
          port_name: eponName,
          port_number: this.extractPortNumber(eponName),
          port_type: 'EPON',
          subscribers: [],
          vlans: [],
          mode: 'trunk'
        }
        this.eponPorts.push(currentEponInterface)
        
        // Also add to regular ports list
        const eponPort = {
          port_number: this.extractPortNumber(eponName),
          port_name: eponName,
          port_type: 'EPON',
          description: 'EPON Port',
          status: 'up',
          speed: '1000M',
          duplex: 'full',
          mode: 'trunk',
          vlans: [],
          native_vlan: null
        }
        this.ports.push(eponPort)
        continue
      }
      
      // EPON subscriber interface (e.g., EPON0/1:1)
      const eponSubMatch = line.match(/^interface\s+(EPON\d+\/\d+:\d+)$/)
      if (eponSubMatch) {
        const subName = eponSubMatch[1]
        const [, portPart, subId] = subName.match(/(EPON\d+\/\d+):(\d+)/)
        
        currentSubscriber = {
          interface_name: subName,
          port_name: portPart,
          subscriber_id: parseInt(subId),
          description: null,
          mac_address: null,
          vlan: null,
          bandwidth_up: null,
          bandwidth_down: null,
          port_security: false
        }
        this.subscribers.push(currentSubscriber)
        
        // Add subscriber interface as access port
        const subPort = {
          port_number: this.extractPortNumber(subName),
          port_name: subName,
          port_type: 'EPON_ACCESS',
          description: 'Subscriber Access Port',
          status: 'up',
          speed: 'auto',
          duplex: 'auto',
          mode: 'access',
          vlans: [],
          native_vlan: null,
          is_subscriber_port: true,
          epon_parent: portPart,
          subscriber_id: parseInt(subId)
        }
        this.ports.push(subPort)
        continue
      }
      
      // Parse configuration inside interfaces
      if (line.startsWith(' ') && currentSubscriber) {
        this.parseSubscriberConfig(line.trim(), currentSubscriber)
      } else if (line.startsWith(' ') && currentEponInterface) {
        this.parseEponPortConfig(line.trim(), currentEponInterface)
      } else if (!line.startsWith(' ')) {
        currentSubscriber = null
        if (!eponPortMatch && !eponSubMatch) {
          currentEponInterface = null
        }
      }
    }
  }

  /**
   * Parse interface configuration parameters
   */
  parseInterfaceConfig(line, interfaceObj) {
    // Description
    if (line.startsWith('description ')) {
      interfaceObj.description = line.replace('description ', '').trim()
    }
    
    // Switchport mode
    if (line.includes('switchport mode ')) {
      const modeMatch = line.match(/switchport mode (\S+)/)
      if (modeMatch) {
        interfaceObj.mode = modeMatch[1]
      }
    }
    
    // VLAN configuration
    if (line.includes('switchport trunk vlan-allowed')) {
      const vlanMatch = line.match(/vlan-allowed\s+(.+)/)
      if (vlanMatch) {
        interfaceObj.vlans = this.parseVlanList(vlanMatch[1])
      }
    }
    
    // Native VLAN
    if (line.includes('switchport pvid')) {
      const pvidMatch = line.match(/pvid\s+(\d+)/)
      if (pvidMatch) {
        interfaceObj.native_vlan = parseInt(pvidMatch[1])
      }
    }
  }

  /**
   * Parse EPON port configuration
   */
  parseEponPortConfig(line, eponInterface) {
    // Bind ONU (subscriber device)
    if (line.includes('epon bind-onu mac')) {
      const bindMatch = line.match(/epon bind-onu mac\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\d+)/)
      if (bindMatch) {
        const macAddr = bindMatch[1]
        const onuId = parseInt(bindMatch[2])
        
        eponInterface.subscribers.push({
          mac_address: this.normalizeMacAddress(macAddr),
          onu_id: onuId,
          interface_name: `${eponInterface.port_name}:${onuId}`
        })
      }
    }
    
    // VLAN configuration for EPON port
    if (line.includes('switchport trunk vlan-allowed')) {
      const vlanMatch = line.match(/vlan-allowed\s+(.+)/)
      if (vlanMatch) {
        eponInterface.vlans = this.parseVlanList(vlanMatch[1])
      }
    }
  }

  /**
   * Parse subscriber interface configuration
   */
  parseSubscriberConfig(line, subscriber) {
    // Description
    if (line.startsWith('description ')) {
      subscriber.description = line.replace('description ', '').trim()
    }
    
    // VLAN configuration
    if (line.includes('epon onu port 1 ctc vlan mode tag')) {
      const vlanMatch = line.match(/vlan mode tag\s+(\d+)/)
      if (vlanMatch) {
        subscriber.vlan = parseInt(vlanMatch[1])
      }
    }
    
    // Bandwidth limits
    if (line.includes('epon sla upstream pir')) {
      const bwMatch = line.match(/pir\s+(\d+)/)
      if (bwMatch) {
        subscriber.bandwidth_up = parseInt(bwMatch[1])
      }
    }
    
    if (line.includes('epon sla downstream pir')) {
      const bwMatch = line.match(/pir\s+(\d+)/)
      if (bwMatch) {
        subscriber.bandwidth_down = parseInt(bwMatch[1])
      }
    }
    
    // Port security
    if (line.includes('switchport port-security')) {
      subscriber.port_security = true
    }
  }

  /**
   * Parse VLAN configuration
   */
  parseVlans(lines) {
    // OLT VLAN configuration is usually inherited from switch config
    // For now, extract VLANs from interface configurations
    const vlanSet = new Set()
    
    this.ports.forEach(port => {
      if (port.vlans) {
        port.vlans.forEach(vlan => vlanSet.add(vlan))
      }
      if (port.native_vlan) {
        vlanSet.add(port.native_vlan)
      }
    })
    
    this.subscribers.forEach(sub => {
      if (sub.vlan) {
        vlanSet.add(sub.vlan)
      }
    })
    
    vlanSet.forEach(vlanId => {
      this.vlans.push({
        vlan_id: vlanId,
        vlan_name: `VLAN${vlanId}`,
        description: `Auto-detected VLAN ${vlanId}`
      })
    })
  }

  /**
   * Extract port number from interface name
   */
  extractPortNumber(interfaceName) {
    // For EPON interfaces like EPON0/1:5, create unique number
    if (interfaceName.includes(':')) {
      const match = interfaceName.match(/EPON(\d+)\/(\d+):(\d+)/)
      if (match) {
        const slot = parseInt(match[1])
        const port = parseInt(match[2])
        const sub = parseInt(match[3])
        return 1000 + (slot * 100) + (port * 10) + sub // e.g., 1015 for EPON0/1:5
      }
    }
    
    // For regular EPON interfaces like EPON0/1
    const eponMatch = interfaceName.match(/EPON(\d+)\/(\d+)/)
    if (eponMatch) {
      const slot = parseInt(eponMatch[1])
      const port = parseInt(eponMatch[2])
      return 100 + (slot * 10) + port // e.g., 101 for EPON0/1
    }
    
    // For TGigaEthernet0/1
    const tgigMatch = interfaceName.match(/TGigaEthernet(\d+)\/(\d+)/)
    if (tgigMatch) {
      const slot = parseInt(tgigMatch[1])
      const port = parseInt(tgigMatch[2])
      return 50 + (slot * 10) + port // e.g., 51 for TGigaEthernet0/1
    }
    
    // For GigaEthernet0/1
    const gigMatch = interfaceName.match(/GigaEthernet(\d+)\/(\d+)/)
    if (gigMatch) {
      const slot = parseInt(gigMatch[1])
      const port = parseInt(gigMatch[2])
      return (slot * 10) + port // e.g., 1 for GigaEthernet0/1
    }
    
    return 1
  }

  /**
   * Determine port type from interface name
   */
  determinePortType(interfaceName) {
    if (interfaceName.startsWith('TGigaEthernet')) return 'fiber'
    if (interfaceName.startsWith('GigaEthernet')) return 'ethernet'
    if (interfaceName.startsWith('EPON') && interfaceName.includes(':')) return 'EPON_ACCESS'
    if (interfaceName.startsWith('EPON')) return 'EPON'
    return 'ethernet'
  }

  /**
   * Determine port speed from interface type
   */
  determinePortSpeed(interfaceName) {
    if (interfaceName.startsWith('TGigaEthernet')) return '10G'
    if (interfaceName.startsWith('GigaEthernet')) return '1G'
    if (interfaceName.startsWith('EPON')) return '1G'
    return 'auto'
  }

  /**
   * Parse VLAN list (e.g., "14,18,29,81,88" or "2-4094")
   */
  parseVlanList(vlanStr) {
    const vlans = []
    const parts = vlanStr.split(',')
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(x => parseInt(x.trim()))
        for (let i = start; i <= end; i++) {
          vlans.push(i)
        }
      } else {
        const vlan = parseInt(part.trim())
        if (!isNaN(vlan)) {
          vlans.push(vlan)
        }
      }
    }
    
    return vlans
  }

  /**
   * Normalize MAC address format
   */
  normalizeMacAddress(macStr) {
    if (!macStr) return null
    
    // Remove all separators and convert to lowercase
    const cleanMac = macStr.replace(/[-:\.]/g, '').toLowerCase()
    
    // Validate length
    if (cleanMac.length !== 12 || !/^[0-9a-f]{12}$/.test(cleanMac)) {
      return null
    }
    
    // Add colons every 2 characters
    return cleanMac.match(/.{2}/g).join(':')
  }
}

module.exports = OltConfigParser
