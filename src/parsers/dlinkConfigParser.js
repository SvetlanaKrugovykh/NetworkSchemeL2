/**
 * D-Link switch configuration parser
 */

class DLinkConfigParser {
  constructor() {
    this.deviceInfo = {
      model: null,
      firmware: null,
      hostname: null,
      ip: null
    }
    this.ports = []
    this.vlans = []
    this.deviceVlans = []
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
    
    return {
      device: this.deviceInfo,
      ports: this.ports,
      vlans: this.vlans,
      deviceVlans: this.deviceVlans
    }
  }

  /**
   * Parse device information
   */
  parseDeviceInfo(lines) {
    for (const line of lines) {
      // Device model
      if (line.includes('DGS-') && line.includes('Gigabit Ethernet Switch')) {
        const match = line.match(/(DGS-\S+)/i)
        if (match) {
          this.deviceInfo.model = match[1]
        }
      }
      
      // Firmware version
      if (line.includes('Firmware: Build')) {
        const match = line.match(/Build\s+(\S+)/)
        if (match) {
          this.deviceInfo.firmware = match[1]
        }
      }
    }
    
    this.deviceInfo.hostname = `DLink_${this.deviceInfo.ip?.replace(/\./g, '_')}`
  }

  /**
   * Parse ports
   */
  parsePorts(lines) {
    const portNumbers = new Set()
    
    for (const line of lines) {
      // Port descriptions
      const descMatch = line.match(/config ports (\d+(?:-\d+)?) description (.+)/)
      if (descMatch) {
        const portRange = descMatch[1]
        const description = descMatch[2]
        
        const ports = this.parsePortRange(portRange)
        ports.forEach(portNum => {
          portNumbers.add(portNum)
          let port = this.ports.find(p => p.port_number === portNum)
          if (!port) {
            port = {
              port_number: portNum,
              port_name: `Port${portNum}`,
              port_type: portNum >= 21 && portNum <= 24 ? 'fiber' : 'ethernet',
              description: description,
              status: 'up',
              speed: 'auto',
              duplex: 'auto'
            }
            this.ports.push(port)
          } else {
            port.description = description
          }
        })
      }
      
      // Port configuration
      const portConfigMatch = line.match(/config ports (\d+(?:-\d+)?) (\w+)\s+(.+)/)
      if (portConfigMatch) {
        const portRange = portConfigMatch[1]
        const parameter = portConfigMatch[2]
        const value = portConfigMatch[3]
        
        const ports = this.parsePortRange(portRange)
        ports.forEach(portNum => {
          portNumbers.add(portNum)
          let port = this.ports.find(p => p.port_number === portNum)
          if (!port) {
            port = {
              port_number: portNum,
              port_name: `Port${portNum}`,
              port_type: portNum >= 21 && portNum <= 24 ? 'fiber' : 'ethernet',
              description: '',
              status: 'up',
              speed: 'auto',
              duplex: 'auto'
            }
            this.ports.push(port)
          }
          
          switch (parameter) {
            case 'speed':
              port.speed = value
              break
            case 'state':
              port.status = value === 'enable' ? 'up' : 'down'
              break
          }
        })
      }
    }
    
    // Add ports that were not explicitly configured
    for (let i = 1; i <= 28; i++) {
      if (!portNumbers.has(i)) {
        this.ports.push({
          port_number: i,
          port_name: `Port${i}`,
          port_type: i >= 21 && i <= 24 ? 'fiber' : 'ethernet',
          description: '',
          status: 'up',
          speed: 'auto',
          duplex: 'auto'
        })
      }
    }
    
    this.ports.sort((a, b) => a.port_number - b.port_number)
  }

  /**
   * Parse VLAN configuration
   */
  parseVlans(lines) {
    const vlanMap = new Map()
    
    for (const line of lines) {
      // Create VLAN
      const createVlanMatch = line.match(/create vlan (\d+) tag (\d+)/)
      if (createVlanMatch) {
        const vlanId = parseInt(createVlanMatch[2])
        vlanMap.set(vlanId, {
          vlan_id: vlanId,
          name: `VLAN${vlanId}`,
          description: `VLAN ${vlanId}`,
          type: 'standard'
        })
      }
      
      // Add ports to VLAN (tagged)
      const taggedMatch = line.match(/config vlan (\w+|\d+) add tagged ([0-9,-]+)/)
      if (taggedMatch) {
        const vlanName = taggedMatch[1]
        const portRange = taggedMatch[2]
        
        const vlanId = vlanName === 'default' ? 1 : parseInt(vlanName)
        if (!vlanMap.has(vlanId)) {
          vlanMap.set(vlanId, {
            vlan_id: vlanId,
            name: vlanName === 'default' ? 'default' : `VLAN${vlanId}`,
            description: `VLAN ${vlanId}`,
            type: 'standard'
          })
        }
        
        const ports = this.parsePortRange(portRange)
        ports.forEach(portNum => {
          this.deviceVlans.push({
            port_number: portNum,
            vlan_id: vlanId,
            mode: 'tagged',
            native_vlan: false
          })
        })
      }
      
      // Add ports to VLAN (untagged)
      const untaggedMatch = line.match(/config vlan (\w+|\d+) add untagged ([0-9,-]+)/)
      if (untaggedMatch) {
        const vlanName = untaggedMatch[1]
        const portRange = untaggedMatch[2]
        
        const vlanId = vlanName === 'default' ? 1 : parseInt(vlanName)
        if (!vlanMap.has(vlanId)) {
          vlanMap.set(vlanId, {
            vlan_id: vlanId,
            name: vlanName === 'default' ? 'default' : `VLAN${vlanId}`,
            description: `VLAN ${vlanId}`,
            type: 'standard'
          })
        }
        
        const ports = this.parsePortRange(portRange)
        ports.forEach(portNum => {
          this.deviceVlans.push({
            port_number: portNum,
            vlan_id: vlanId,
            mode: 'untagged',
            native_vlan: true
          })
        })
      }
    }
    
    this.vlans = Array.from(vlanMap.values())
  }

  /**
   * Parse port range (e.g., "1-4,6,8-10")
   */
  parsePortRange(rangeStr) {
    const ports = []
    const parts = rangeStr.split(',')
    
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(x => parseInt(x))
        for (let i = start; i <= end; i++) {
          ports.push(i)
        }
      } else {
        const port = parseInt(trimmed)
        if (!isNaN(port)) {
          ports.push(port)
        }
      }
    }
    
    return ports
  }
}

module.exports = DLinkConfigParser
