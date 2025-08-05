const ImportService = require('./src/services/importService')
const fs = require('fs')
const path = require('path')

async function importAllMacFiles() {
  try {
    const macsDir = './data/macs'
    const files = fs.readdirSync(macsDir).filter(file => file.endsWith('.mac'))
    
    console.log(`Found ${files.length} MAC table files to import...`)
    
    let totalImported = 0
    let totalErrors = 0
    const results = []
    
    for (const file of files) {
      console.log(`\nImporting ${file}...`)
      
      const filePath = path.join(macsDir, file)
      const macTableText = fs.readFileSync(filePath, 'utf8')
      
      // Extract IP from filename (192_168_156_10.mac -> 192.168.156.10)
      const deviceIp = file.replace(/\.mac$/, '').replace(/_/g, '.')
      
      const result = await ImportService.importMacTable(macTableText, deviceIp)
      results.push({ file, deviceIp, result })
      
      if (result.success) {
        totalImported += result.stats.entries_imported
        console.log(`✓ ${result.stats.entries_imported} entries imported`)
      } else {
        totalErrors++
        console.log(`✗ Error: ${result.message}`)
      }
    }
    
    console.log(`\n=== FINAL SUMMARY ===`)
    console.log(`Files processed: ${files.length}`)
    console.log(`Total MAC entries imported: ${totalImported}`)
    console.log(`Files with errors: ${totalErrors}`)
    
    // Show unique VLANs found
    const allVlans = new Set()
    results.forEach(r => {
      if (r.result.success && r.result.topology_analysis) {
        r.result.topology_analysis.forEach(vlan => allVlans.add(vlan.vlan_id))
      }
    })
    
    console.log(`\nUnique VLANs found: ${Array.from(allVlans).sort((a, b) => a - b).join(', ')}`)
    console.log(`Total VLANs: ${allVlans.size}`)
    
  } catch (error) {
    console.error('Error during mass import:', error)
  }
}

importAllMacFiles()
