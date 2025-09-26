const fs = require('fs')
const path = require('path')

async function fixMacFiles() {
  const macDir = 'data/macs'
  const files = fs.readdirSync(macDir).filter(f => f.endsWith('.mac') && !f.includes('fixed'))
  
  console.log(`Found ${files.length} MAC files to check and fix`)
  
  for (const file of files) {
    const filePath = path.join(macDir, file)
    console.log(`\nChecking ${file}...`)
    
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split('\n')
      
      console.log(`  Original lines: ${lines.length}`)
      
      // If file has only 1 line, it needs fixing
      if (lines.length <= 2) {
        console.log(`  ⚠️  Fixing ${file} - single line detected`)
        
        // Read as lines using PowerShell method
        const { exec } = require('child_process')
        const cmd = `Get-Content "${filePath}" | Set-Content "${filePath}.temp" -Encoding UTF8`
        
        await new Promise((resolve, reject) => {
          exec(`powershell -Command "${cmd}"`, (error, stdout, stderr) => {
            if (error) reject(error)
            else resolve()
          })
        })
        
        // Replace original file
        if (fs.existsSync(`${filePath}.temp`)) {
          fs.renameSync(`${filePath}.temp`, filePath)
          
          // Verify fix
          const fixedContent = fs.readFileSync(filePath, 'utf8')
          const fixedLines = fixedContent.split('\n')
          console.log(`  ✅ Fixed! New lines: ${fixedLines.length}`)
        }
      } else {
        console.log(`  ✅ OK - ${lines.length} lines`)
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message)
    }
  }
  
  console.log('\n✅ MAC file fixing completed!')
}

fixMacFiles().catch(console.error)