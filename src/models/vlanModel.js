const pool = require('../db/pool')

class VlanModel {
  /**
   * Create new VLAN
   */
  static async create(vlanData) {
    const {
      vlan_id,
      name,
      description,
      type = 'standard'
    } = vlanData

    const query = `
      INSERT INTO vlans (vlan_id, name, description, type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (vlan_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        type = EXCLUDED.type
      RETURNING *
    `
    
    const result = await pool.query(query, [vlan_id, name, description, type])
    return result.rows[0]
  }

  /**
   * Find VLAN by ID
   */
  static async findById(vlanId) {
    const query = 'SELECT * FROM vlans WHERE vlan_id = $1'
    const result = await pool.query(query, [vlanId])
    return result.rows[0]
  }

  /**
   * Получение всех VLAN
   */
  static async findAll() {
    const query = 'SELECT * FROM vlans ORDER BY vlan_id'
    const result = await pool.query(query)
    return result.rows
  }

  /**
   * Добавление VLAN к устройству/порту
   */
  static async addToDevice(deviceVlanData) {
    const {
      device_id,
      port_id,
      vlan_id,
      mode,
      native_vlan = false,
      qinq_enabled = false,
      outer_vlan = null,
      inner_vlan = null
    } = deviceVlanData

    const query = `
      INSERT INTO device_vlans (device_id, port_id, vlan_id, mode, native_vlan, qinq_enabled, outer_vlan, inner_vlan)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (device_id, port_id, vlan_id, mode) DO UPDATE SET
        native_vlan = EXCLUDED.native_vlan,
        qinq_enabled = EXCLUDED.qinq_enabled,
        outer_vlan = EXCLUDED.outer_vlan,
        inner_vlan = EXCLUDED.inner_vlan
      RETURNING *
    `
    
    const result = await pool.query(query, [
      device_id, port_id, vlan_id, mode, native_vlan, qinq_enabled, outer_vlan, inner_vlan
    ])
    
    return result.rows[0]
  }

  /**
   * Получение топологии VLAN (какие устройства и порты участвуют в VLAN)
   */
  static async getTopology(vlanId) {
    const query = `
      SELECT 
        d.id as device_id,
        d.hostname,
        d.ip_address,
        d.device_type,
        dp.id as port_id,
        dp.port_number,
        dp.port_name,
        dp.description as port_description,
        dv.mode,
        dv.native_vlan,
        dv.qinq_enabled,
        dv.outer_vlan,
        dv.inner_vlan,
        v.name as vlan_name,
        v.description as vlan_description
      FROM device_vlans dv
      JOIN devices d ON dv.device_id = d.id
      JOIN device_ports dp ON dv.port_id = dp.id
      JOIN vlans v ON dv.vlan_id = v.vlan_id
      WHERE dv.vlan_id = $1
      ORDER BY d.ip_address, dp.port_number
    `
    
    const result = await pool.query(query, [vlanId])
    return result.rows
  }

  /**
   * Поиск пути VLAN через устройства
   */
  static async findVlanPath(vlanId) {
    const topology = await this.getTopology(vlanId)
    
    // Группируем по устройствам
    const deviceMap = {}
    topology.forEach(item => {
      if (!deviceMap[item.device_id]) {
        deviceMap[item.device_id] = {
          device_id: item.device_id,
          hostname: item.hostname,
          ip_address: item.ip_address,
          device_type: item.device_type,
          ports: []
        }
      }
      
      deviceMap[item.device_id].ports.push({
        port_id: item.port_id,
        port_number: item.port_number,
        port_name: item.port_name,
        port_description: item.port_description,
        mode: item.mode,
        native_vlan: item.native_vlan,
        qinq_enabled: item.qinq_enabled,
        outer_vlan: item.outer_vlan,
        inner_vlan: item.inner_vlan
      })
    })
    
    return {
      vlan_id: vlanId,
      vlan_name: topology[0]?.vlan_name || `VLAN${vlanId}`,
      vlan_description: topology[0]?.vlan_description || '',
      devices: Object.values(deviceMap)
    }
  }

  /**
   * Получение MAC адресов в VLAN
   */
  static async getMacAddresses(vlanId) {
    const query = `
      SELECT 
        ma.*,
        d.hostname,
        d.ip_address as device_ip,
        dp.port_number,
        dp.port_name
      FROM mac_addresses ma
      LEFT JOIN devices d ON ma.device_id = d.id
      LEFT JOIN device_ports dp ON ma.port_id = dp.id
      WHERE ma.vlan_id = $1
      ORDER BY ma.mac_address
    `
    
    const result = await pool.query(query, [vlanId])
    return result.rows
  }

  /**
   * Удаление VLAN
   */
  static async delete(vlanId) {
    const query = 'DELETE FROM vlans WHERE vlan_id = $1 RETURNING *'
    const result = await pool.query(query, [vlanId])
    return result.rows[0]
  }
}

module.exports = VlanModel
