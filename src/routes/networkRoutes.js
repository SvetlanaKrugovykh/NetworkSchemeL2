const NetworkController = require('../controllers/networkController')

async function networkRoutes(fastify, options) {
  // Static files (web interface)
  fastify.register(require('@fastify/static'), {
    root: require('path').join(process.cwd(), 'public'),
    prefix: '/',
    index: ['index.html']
  })
  
  // Data import
  fastify.post('/api/import', NetworkController.importData)
  
  // Devices
  fastify.get('/api/devices', NetworkController.getDevices)
  fastify.get('/api/devices/:id', NetworkController.getDevice)
  
  // VLANs
  fastify.get('/api/vlans', NetworkController.getVlans)
  fastify.get('/api/vlans/:vlanId/topology', NetworkController.getVlanTopology)
  fastify.get('/api/vlans/:vlanId/macs', NetworkController.getVlanMacs)
  
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
