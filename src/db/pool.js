const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  user: process.env.DB_USER || process.env.LANG_DB_USER,
  host: process.env.DB_HOST || process.env.LANG_DB_HOST,
  database: process.env.DB_NAME || process.env.LANG_DB_NAME,
  password: process.env.DB_PASSWORD || process.env.LANG_DB_PASSWORD,
  port: process.env.DB_PORT || process.env.LANG_DB_PORT,
})

module.exports = pool