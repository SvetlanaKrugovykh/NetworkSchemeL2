const Fastify = require('fastify')

const app = Fastify({
  trustProxy: true,
  logger: true
})

// Register routes
app.register(require('./src/routes/networkRoutes'))

module.exports = { app }