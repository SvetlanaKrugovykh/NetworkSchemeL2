const Fastify = require('fastify')
const IPAccessControl = require('./src/middleware/ipAccessControl')

const app = Fastify({
  trustProxy: true,
  logger: true
})

// Initialize IP access control
const ipControl = new IPAccessControl()

// Register IP access control middleware
app.addHook('preHandler', ipControl.middleware())

// Register routes
app.register(require('./src/routes/networkRoutes'))

module.exports = { app }