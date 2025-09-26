const MacTableParser = require('./src/parsers/macTableParser')
const fs = require('fs')

// Test D-Link switch format
console.log('=== Testing D-Link Switch Format ===')
const dlinkContent = fs.readFileSync('./data/macs/192_168_156_10.mac', 'utf8')
console.log('First 10 lines of file:')
console.log(dlinkContent.split('\n').slice(0, 10).join('\n'))
console.log('\n')

const dlinkEntries = MacTableParser.parseGenericMacTable(dlinkContent)
console.log(`Parsed ${dlinkEntries.length} entries`)
console.log('First 5 entries:')
dlinkEntries.slice(0, 5).forEach((entry, idx) => {
  console.log(`${idx + 1}. VLAN: ${entry.vlan_id}, MAC: ${entry.mac_address}, Port: ${entry.port}`)
})

console.log('\n=== Testing OLT Format ===')
const oltContent = fs.readFileSync('./data/macs/192_168_165_191.mac', 'utf8')
console.log('First 10 lines of file:')
console.log(oltContent.split('\n').slice(0, 10).join('\n'))
console.log('\n')

const oltEntries = MacTableParser.parseGenericMacTable(oltContent)
console.log(`Parsed ${oltEntries.length} entries`)
console.log('First 5 entries:')
oltEntries.slice(0, 5).forEach((entry, idx) => {
  console.log(`${idx + 1}. VLAN: ${entry.vlan_id}, MAC: ${entry.mac_address}, Port: ${entry.port}`)
})

// Show all unique VLANs found
const allEntries = [...dlinkEntries, ...oltEntries]
const uniqueVlans = [...new Set(allEntries.map(e => e.vlan_id))].sort((a, b) => a - b)
console.log('\n=== All unique VLANs found ===')
console.log('VLANs:', uniqueVlans)
