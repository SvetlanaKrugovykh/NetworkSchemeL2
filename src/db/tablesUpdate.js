const pool = require('./pool')
const fs = require('fs')
const path = require('path')

async function updateTables() {
  try {
    console.log('Updating database schema...')

    // Сначала удаляем устаревшую таблицу device_vlans
    const dropPath = path.join(__dirname, 'drop_device_vlans.sql')
    if (fs.existsSync(dropPath)) {
      const dropSql = fs.readFileSync(dropPath, 'utf8')
      await pool.query(dropSql)
      console.log('Dropped deprecated device_vlans table')
    }

    // Read SQL schema
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')

    // Execute table creation
    await pool.query(schemaSql)

    console.log('Database schema updated successfully')
  } catch (error) {
    console.error('Error updating database schema:', error)
    throw error
  }
}

module.exports = { updateTables }