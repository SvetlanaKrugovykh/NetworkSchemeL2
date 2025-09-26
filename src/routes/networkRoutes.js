const NetworkController = require('../controllers/networkController')

async function networkRoutes(fastify, options) {
  // Register multipart plugin for file uploads
  fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  })

  // Static files (web interface)
  fastify.register(require('@fastify/static'), {
    root: require('path').join(process.cwd(), 'public'),
    prefix: '/',
    index: ['index.html']
  })

  // API info endpoint
  fastify.get('/api', async (request, reply) => {
    return {
      message: 'Network Scheme L2 API',
      version: '1.0.0',
      endpoints: {
        upload: 'POST /api/upload',
        import: 'POST /api/import',
        clearDatabase: 'POST /api/database/clear',
        fullReload: 'POST /api/database/reload',
        devices: 'GET /api/devices',
        device: 'GET /api/devices/:id',
        devicePorts: 'GET /api/devices/:id/ports',
        deviceVlans: 'GET /api/devices/:id/vlans',
        vlans: 'GET /api/vlans',
        vlanTopology: 'GET /api/vlans/:vlanId/topology',
        vlanMacs: 'GET /api/vlans/:vlanId/macs',
        vlanScheme: 'GET /api/vlans/:vlanId/scheme',
        macStats: 'GET /api/stats/macs'
      }
    }
  })

  // File upload endpoint
  fastify.post('/api/upload', NetworkController.uploadFiles)

  // Data import
  fastify.post('/api/import', NetworkController.importData)
  fastify.post('/api/import/directory', NetworkController.importData)

  // Database management
  fastify.post('/api/database/clear', NetworkController.clearDatabase)
  fastify.post('/api/database/reload', NetworkController.fullReload)

  // Devices
  fastify.get('/api/devices', NetworkController.getDevices)
  fastify.get('/api/devices/:id', NetworkController.getDevice)
  fastify.get('/api/devices/:id/ports', NetworkController.getDevicePorts)
  fastify.get('/api/devices/:id/vlans', NetworkController.getDeviceVlans)

  // VLANs
  fastify.get('/api/vlans', NetworkController.getVlans)
  fastify.get('/api/vlans/:vlanId/topology', NetworkController.getVlanTopology)
  fastify.get('/api/vlans/:vlanId/macs', NetworkController.getVlanMacs)

  // Statistics
  fastify.get('/api/stats/macs', NetworkController.getMacStats)
  fastify.get('/api/stats', NetworkController.getStats)

  // HTML scheme generation
  fastify.get('/api/vlans/:vlanId/scheme', NetworkController.generateVlanScheme)

  // Static files for schemes
  fastify.register(require('@fastify/static'), {
    root: require('path').join(process.cwd(), 'data', 'generated'),
    prefix: '/schemes/',
    index: false,
    decorateReply: false
  })
}

module.exports = networkRoutes
