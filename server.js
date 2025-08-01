require('dotenv').config()
const { app } = require('./index')
const fs = require('fs')
const path = require('path')
const updateTables = require('./src/db/tablesUpdate').updateTables

const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 7111
const LOG_DIR = process.env.LOG_DIR || 'logs'
const LOG_FILE = process.env.LOG_FILE || 'app.log'
const Platform_OS = process.env.Platform_OS || 'Windows'

// Initialize database
try {
  updateTables()
} catch (err) {
  console.log('Database initialization error:', err)
}

function setupLogging() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }

  const logFile = path.join(LOG_DIR, LOG_FILE)
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })

  console.log = (...args) => {
    const message = `${new Date().toISOString()} [INFO]: ${args.join(' ')}\n`
    process.stdout.write(message)
    logStream.write(message)
  }

  console.error = (...args) => {
    const message = `${new Date().toISOString()} [ERROR]: ${args.join(' ')}\n`
    process.stderr.write(message)
    logStream.write(message)
  }
}

if (Platform_OS === 'Windows') {
  setupLogging()
}

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`🚀 Network Scheme L2 server is running at ${address}`)
  console.log(`📊 API endpoints available at ${address}/`)
  console.log(`📁 Data directory: ${path.join(process.cwd(), 'data')}`)
})
