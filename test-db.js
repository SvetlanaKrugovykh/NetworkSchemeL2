const pool = require('./src/db/pool')

async function testConnection() {
  try {
    console.log('Testing database connection...')
    const result = await pool.query('SELECT NOW()')
    console.log('✅ Database connection successful:', result.rows[0])

    const deviceCount = await pool.query('SELECT COUNT(*) FROM devices')
    console.log('📊 Devices in database:', deviceCount.rows[0].count)

    const portCount = await pool.query('SELECT COUNT(*) FROM device_ports')
    console.log('📊 Ports in database:', portCount.rows[0].count)

    const macCount = await pool.query('SELECT COUNT(*) FROM mac_addresses')
    console.log('📊 MAC addresses in database:', macCount.rows[0].count)

    const vlanCount = await pool.query('SELECT COUNT(*) FROM vlans')
    console.log('📊 VLANs in database:', vlanCount.rows[0].count)

    // Check port distribution per device
    const portsPerDevice = await pool.query(`
      SELECT
        d.ip_address,
        d.hostname,
        COUNT(dp.id) as port_count
      FROM devices d
      LEFT JOIN device_ports dp ON d.id = dp.device_id
      GROUP BY d.id, d.ip_address, d.hostname
      ORDER BY port_count DESC
    `)

    console.log('\n🔍 Ports per device:')
    portsPerDevice.rows.forEach(row => {
      console.log(`${row.ip_address} (${row.hostname || 'Unknown'}): ${row.port_count} ports`)
    })

    process.exit(0)
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    console.error('Error details:', error)
    process.exit(1)
  }
}

testConnection()
