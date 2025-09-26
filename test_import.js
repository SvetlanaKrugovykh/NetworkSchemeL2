const ImportService = require('./src/services/importService')
const fs = require('fs')

async function testImport() {
  try {
    console.log('Testing import of single MAC table file...')

    // Test with D-Link switch format
    const fileName = '192_168_156_10.mac'
    const deviceIp = '192.168.156.10' // Convert filename to IP
    const filePath = `./data/macs/${fileName}`
    const macTableText = fs.readFileSync(filePath, 'utf8')

    console.log('First few lines of MAC table:')
    console.log(macTableText.split('\n').slice(0, 10).join('\n'))
    console.log('\n')

    // Import the MAC table with correct IP address
    const result = await ImportService.importMacTable(macTableText, deviceIp)

    console.log('Import result:', JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('Error during test import:', error)
  }
}

testImport()
