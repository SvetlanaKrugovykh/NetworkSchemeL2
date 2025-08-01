const pool = require('./pool')
const fs = require('fs')
const path = require('path')

async function updateTables() {
  try {
    console.log('Updating database schema...')

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