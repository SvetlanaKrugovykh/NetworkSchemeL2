const Fastify = require('fastify')

const app = Fastify({
  trustProxy: true,
  logger: true
})

// Register routes
app.register(require('./src/routes/networkRoutes'))

// Base route
app.get('/', async (request, reply) => {
  return {
    message: 'Network Scheme L2 API',
    version: '1.0.0',
    endpoints: {
      import: 'POST /api/import',
      devices: 'GET /api/devices',
      device: 'GET /api/devices/:id',
      vlans: 'GET /api/vlans',
      vlanTopology: 'GET /api/vlans/:vlanId/topology',
      vlanMacs: 'GET /api/vlans/:vlanId/macs',
      vlanScheme: 'GET /api/vlans/:vlanId/scheme'
    }
  }
})

module.exports = { app }