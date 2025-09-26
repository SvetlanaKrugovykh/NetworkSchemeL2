const pool = require('./src/db/pool')

async function testConnection() {
  try {
    console.log('Testing database connection...')
    const result = await pool.query('SELECT NOW()')
    console.log('✅ Database connection successful:', result.rows[0])
    
    const deviceCount = await pool.query('SELECT COUNT(*) FROM devices')
    console.log('📊 Devices in database:', deviceCount.rows[0].count)
    
    const macCount = await pool.query('SELECT COUNT(*) FROM mac_addresses')
    console.log('📊 MAC addresses in database:', macCount.rows[0].count)
    
    const vlanCount = await pool.query('SELECT COUNT(*) FROM vlans')
    console.log('📊 VLANs in database:', vlanCount.rows[0].count)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    console.error('Error details:', error)
    process.exit(1)
  }
}

testConnection()