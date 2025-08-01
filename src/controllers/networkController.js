const ImportService = require('../services/importService')
const DeviceModel = require('../models/deviceModel')
const VlanModel = require('../models/vlanModel')
const path = require('path')

class NetworkController {
  /**
   * Импорт данных из директории data
   */
  static async importData(request, reply) {
    try {
      const dataDir = path.join(process.cwd(), 'data')
      const results = await ImportService.importFromDirectory(dataDir)
      
      reply.send({
        success: true,
        message: 'Data import completed',
        results: {
          devicesImported: results.devices.length,
          macTablesImported: results.macTables.length,
          errors: results.errors
        }
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Получение списка всех устройств
   */
  static async getDevices(request, reply) {
    try {
      const devices = await DeviceModel.findAll()
      reply.send({
        success: true,
        data: devices
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Получение информации об устройстве с портами и VLAN
   */
  static async getDevice(request, reply) {
    try {
      const { id } = request.params
      const device = await DeviceModel.findWithVlans(parseInt(id))
      
      if (!device) {
        return reply.code(404).send({
          success: false,
          error: 'Device not found'
        })
      }
      
      reply.send({
        success: true,
        data: device
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Получение списка всех VLAN
   */
  static async getVlans(request, reply) {
    try {
      const vlans = await VlanModel.findAll()
      reply.send({
        success: true,
        data: vlans
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Получение топологии VLAN
   */
  static async getVlanTopology(request, reply) {
    try {
      const { vlanId } = request.params
      const topology = await VlanModel.findVlanPath(parseInt(vlanId))
      
      reply.send({
        success: true,
        data: topology
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Получение MAC адресов в VLAN
   */
  static async getVlanMacs(request, reply) {
    try {
      const { vlanId } = request.params
      const macAddresses = await VlanModel.getMacAddresses(parseInt(vlanId))
      
      reply.send({
        success: true,
        data: macAddresses
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Генерация HTML схемы для VLAN
   */
  static async generateVlanScheme(request, reply) {
    try {
      const { vlanId } = request.params
      const topology = await VlanModel.findVlanPath(parseInt(vlanId))
      const macAddresses = await VlanModel.getMacAddresses(parseInt(vlanId))
      
      // Генерируем HTML
      const html = this.generateVlanHTML(topology, macAddresses)
      
      reply.type('text/html').send(html)
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Генерация HTML схемы VLAN
   */
  static generateVlanHTML(topology, macAddresses) {
    const macByDevice = {}
    macAddresses.forEach(mac => {
      if (!macByDevice[mac.device_ip]) {
        macByDevice[mac.device_ip] = []
      }
      macByDevice[mac.device_ip].push(mac)
    })

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VLAN ${topology.vlan_id} Topology</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background-color: #f5f5f5;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white; 
            border-radius: 10px;
        }
        .device { 
            border: 2px solid #333; 
            margin: 20px 0; 
            padding: 15px; 
            border-radius: 10px; 
            background: #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .device-header { 
            background: #4a90e2; 
            color: white; 
            padding: 10px; 
            margin: -15px -15px 15px -15px; 
            border-radius: 8px 8px 0 0;
            font-weight: bold;
        }
        .ports { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 15px; 
            margin-top: 15px;
        }
        .port { 
            border: 1px solid #ddd; 
            padding: 10px; 
            border-radius: 5px; 
            background: #f9f9f9;
        }
        .port-header { 
            font-weight: bold; 
            color: #333; 
            border-bottom: 1px solid #ddd; 
            padding-bottom: 5px; 
            margin-bottom: 10px;
        }
        .vlan-mode { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 3px; 
            font-size: 0.8em; 
            margin: 2px;
        }
        .tagged { 
            background: #e3f2fd; 
            color: #1976d2; 
            border: 1px solid #1976d2;
        }
        .untagged { 
            background: #f3e5f5; 
            color: #7b1fa2; 
            border: 1px solid #7b1fa2;
        }
        .mac-addresses { 
            margin-top: 15px;
        }
        .mac-item { 
            background: #e8f5e8; 
            padding: 5px 10px; 
            margin: 2px 0; 
            border-radius: 3px; 
            font-family: monospace; 
            font-size: 0.9em;
            border-left: 3px solid #4caf50;
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
            margin: 20px 0;
        }
        .stat-item { 
            text-align: center; 
            padding: 15px; 
            background: linear-gradient(135deg, #f093fb, #f5576c); 
            color: white; 
            border-radius: 10px;
        }
        .stat-number { 
            font-size: 2em; 
            font-weight: bold;
        }
        .stat-label { 
            font-size: 0.9em; 
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VLAN ${topology.vlan_id} - ${topology.vlan_name}</h1>
            <p>${topology.vlan_description}</p>
        </div>
        
        <div class="stats">
            <div class="stat-item">
                <div class="stat-number">${topology.devices.length}</div>
                <div class="stat-label">Devices</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${topology.devices.reduce((sum, d) => sum + d.ports.length, 0)}</div>
                <div class="stat-label">Ports</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${macAddresses.length}</div>
                <div class="stat-label">MAC Addresses</div>
            </div>
        </div>
`

    topology.devices.forEach(device => {
      const deviceMacs = macByDevice[device.ip_address] || []
      
      html += `
        <div class="device">
            <div class="device-header">
                ${device.hostname} (${device.ip_address}) - ${device.device_type.toUpperCase()}
            </div>
            
            <div class="ports">
`
      
      device.ports.forEach(port => {
        const portMacs = deviceMacs.filter(mac => mac.port_number === port.port_number)
        
        html += `
                <div class="port">
                    <div class="port-header">
                        Port ${port.port_number}${port.port_name ? ` (${port.port_name})` : ''}
                    </div>
                    ${port.port_description ? `<div><strong>Description:</strong> ${port.port_description}</div>` : ''}
                    <div>
                        <span class="vlan-mode ${port.mode}">${port.mode.toUpperCase()}</span>
                        ${port.native_vlan ? '<span class="vlan-mode untagged">NATIVE</span>' : ''}
                        ${port.qinq_enabled ? '<span class="vlan-mode tagged">QinQ</span>' : ''}
                    </div>
                    
                    ${portMacs.length > 0 ? `
                    <div class="mac-addresses">
                        <strong>MAC Addresses (${portMacs.length}):</strong>
                        ${portMacs.map(mac => `
                            <div class="mac-item">
                                ${mac.mac_address}
                                ${mac.ip_address ? ` → ${mac.ip_address}` : ''}
                                ${mac.client_type ? ` [${mac.client_type}]` : ''}
                                ${mac.description ? ` - ${mac.description}` : ''}
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
`
      })
      
      html += `
            </div>
        </div>
`
    })

    html += `
    </div>
</body>
</html>`

    return html
  }
}

module.exports = NetworkController
