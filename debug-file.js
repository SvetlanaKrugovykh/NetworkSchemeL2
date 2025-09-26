const fs = require('fs')

function debugMacFile() {
  try {
    const content = fs.readFileSync('data/macs/192_168_156_110.mac', 'utf8')
    const lines = content.split('\n')
    
    console.log('Total lines:', lines.length)
    console.log('\n=== First 15 lines ===')
    lines.slice(0, 15).forEach((line, index) => {
      console.log(`${index + 1}: "${line.trim()}" (length: ${line.length})`)
    })
    
    console.log('\n=== Looking for separators ===')
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.includes('----') || trimmed.includes('---')) {
        console.log(`Line ${index + 1}: "${trimmed}" (SEPARATOR FOUND)`)
      }
    })
    
    console.log('\n=== Looking for data lines ===')
    let foundSeparator = false
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.includes('----') || trimmed.includes('---')) {
        foundSeparator = true
        return
      }
      if (foundSeparator && trimmed && !trimmed.startsWith('Command:')) {
        const parts = trimmed.split(/\s+/)
        console.log(`Line ${index + 1}: "${trimmed}"`)
        console.log(`  Parts (${parts.length}):`, parts)
        if (parts.length >= 5) {
          console.log(`  VLAN: ${parts[0]}, MAC: ${parts[2]}, Port: ${parts[3]}, Type: ${parts[4]}`)
        }
      }
    })
    
  } catch (error) {
    console.error('Error:', error)
  }
}

debugMacFile()