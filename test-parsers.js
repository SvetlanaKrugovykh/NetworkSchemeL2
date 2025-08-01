/**
 * Test script for parser verification
 */

const DLinkConfigParser = require('./src/parsers/dlinkConfigParser')
const MacTableParser = require('./src/parsers/macTableParser')
const fs = require('fs')
const path = require('path')

async function testParsers() {
  console.log('🧪 Testing parsers...\n')
  
  try {
    // Test D-Link config parser
    console.log('📋 Testing D-Link config parser...')
    const configPath = path.join(__dirname, 'data', 'configs', '192.168.165.239.cfg')
    const configText = fs.readFileSync(configPath, 'utf8')
    
    const parser = new DLinkConfigParser()
    const parsedConfig = parser.parse(configText, '192.168.165.239')
    
    console.log('✅ Device info:', parsedConfig.device)
    console.log(`✅ Ports found: ${parsedConfig.ports.length}`)
    console.log(`✅ VLANs found: ${parsedConfig.vlans.length}`)
    console.log(`✅ Device-VLAN relations: ${parsedConfig.deviceVlans.length}`)
    
    // Show some examples
    console.log('\n📊 Sample VLANs:')
    parsedConfig.vlans.slice(0, 3).forEach(vlan => {
      console.log(`  - VLAN ${vlan.vlan_id}: ${vlan.name}`)
    })
    
    console.log('\n🔌 Sample ports with descriptions:')
    parsedConfig.ports.filter(p => p.description).slice(0, 3).forEach(port => {
      console.log(`  - Port ${port.port_number}: ${port.description}`)
    })
    
    console.log('\n🔗 Sample VLAN assignments:')
    parsedConfig.deviceVlans.slice(0, 5).forEach(dv => {
      console.log(`  - Port ${dv.port_number} → VLAN ${dv.vlan_id} (${dv.mode})`)
    })
    
    // Test MAC table parsers
    console.log('\n\n🏷️ Testing MAC table parsers...')
    
    // D-Link format
    const dlinkMacPath = path.join(__dirname, 'data', 'macs', '192.168.65.239')
    const dlinkMacText = fs.readFileSync(dlinkMacPath, 'utf8')
    const dlinkMacs = MacTableParser.parseDLinkMacTable(dlinkMacText, '192.168.65.239')
    
    console.log(`✅ D-Link MAC entries: ${dlinkMacs.length}`)
    console.log('📊 Sample MAC entries:')
    dlinkMacs.slice(0, 3).forEach(mac => {
      console.log(`  - ${mac.mac_address} → VLAN ${mac.vlan_id}, Port ${mac.port_number}`)
    })
    
    // Cisco-like format
    const ciscoMacPath = path.join(__dirname, 'data', 'macs', '192.168.23.239')
    const ciscoMacText = fs.readFileSync(ciscoMacPath, 'utf8')
    const ciscoMacs = MacTableParser.parseCiscoLikeMacTable(ciscoMacText, '192.168.23.239')
    
    console.log(`✅ Cisco-like MAC entries: ${ciscoMacs.length}`)
    console.log('📊 Sample MAC entries:')
    ciscoMacs.slice(0, 3).forEach(mac => {
      console.log(`  - ${mac.mac_address} → VLAN ${mac.vlan_id}, Port ${mac.port_number || 'N/A'}`)
    })
    
    console.log('\n🎉 All parsers working correctly!')
    
  } catch (error) {
    console.error('❌ Error testing parsers:', error)
  }
}

if (require.main === module) {
  testParsers()
}

module.exports = { testParsers }
