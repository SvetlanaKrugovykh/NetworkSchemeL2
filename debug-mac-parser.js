const MacTableParser = require('./src/parsers/macTableParser')
const fs = require('fs')

async function testMacParsing() {
  console.log('Testing MAC table parsing for 192_168_156_110.mac')

  try {
    const content = fs.readFileSync('data/macs/192_168_156_110.mac', 'utf8')
    console.log('File content length:', content.length)
    console.log('First 500 characters:')
    console.log(content.substring(0, 500))
    console.log('\n=== Parsing MAC table ===')

    // Test format detection
    console.log('Format detection:')
    console.log('- Contains "Command: show fdb":', content.includes('Command: show fdb'))
    console.log('- Contains "VID":', content.includes('VID'))
    console.log('- Contains "VLAN Name":', content.includes('VLAN Name'))
    console.log('- Contains "Mac Address Table (Total":', content.includes('Mac Address Table (Total'))

    const deviceInfo = {
      ip_address: '192.168.1.10',
      hostname: 'test-device'
    }

    // Test specific parsers
    console.log('\n=== Testing parseDlinkMacTable directly ===')
    const dlinkResult = await MacTableParser.parseDlinkMacTable(content, deviceInfo)
    console.log('D-Link parser result:', dlinkResult.length, 'entries')

    console.log('\n=== Testing parseGenericMacTable ===')
    const result = await MacTableParser.parseGenericMacTable(content, deviceInfo)
    console.log('Generic parser result:', result.length, 'entries')

    if (result.length > 0) {
      console.log('First 5 entries:')
      result.slice(0, 5).forEach((entry, index) => {
        console.log(`${index + 1}:`, entry)
      })

      // Check unique ports
      const uniquePorts = [...new Set(result.map(entry => entry.port))]
      console.log('Unique ports found:', uniquePorts)
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

testMacParsing()
