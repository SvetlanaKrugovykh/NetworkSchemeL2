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
   * Get all VLANs
   */
  static async findAll() {
    const query = 'SELECT * FROM vlans ORDER BY vlan_id'
    const result = await pool.query(query)
    return result.rows
  }

  /**
   * Add VLAN to device/port
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
      inner_vlan_id = null
    } = deviceVlanData

    const query = `
      INSERT INTO device_vlans (device_id, port_id, vlan_id, mode, native_vlan, qinq_enabled, outer_vlan, inner_vlan_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (device_id, port_id, vlan_id, mode) DO UPDATE SET
        native_vlan = EXCLUDED.native_vlan,
        qinq_enabled = EXCLUDED.qinq_enabled,
        outer_vlan = EXCLUDED.outer_vlan,
        inner_vlan_id = EXCLUDED.inner_vlan_id
      RETURNING *
    `
    
    const result = await pool.query(query, [
      device_id, port_id, vlan_id, mode, native_vlan, qinq_enabled, outer_vlan, inner_vlan
    ])
    
    return result.rows[0]
  }

  /**
   * Get VLAN topology (which devices and ports participate in VLAN)
   */
  static async getTopology(vlanId) {
    const query = `
      SELECT DISTINCT
        d.id as device_id,
        d.hostname,
        d.ip_address,
        d.device_type,
        dp.id as port_id,
        dp.port_number,
        dp.port_name,
        dp.description as port_description,
        'access' as mode,
        ma.vlan_id as native_vlan,
        false as qinq_enabled,
        null as outer_vlan,
        null as inner_vlan_id,
        v.name as vlan_name,
        v.description as vlan_description,
        COUNT(ma.mac_address) as mac_count
      FROM mac_addresses ma
      JOIN devices d ON ma.device_id = d.id
      JOIN device_ports dp ON ma.port_id = dp.id
      JOIN vlans v ON ma.vlan_id = v.vlan_id
      WHERE ma.vlan_id = $1
      GROUP BY d.id, d.hostname, d.ip_address, d.device_type, 
               dp.id, dp.port_number, dp.port_name, dp.description,
               ma.vlan_id, v.name, v.description
      ORDER BY d.ip_address, dp.port_number
    `
    
    const result = await pool.query(query, [vlanId])
    return result.rows
  }

  /**
   * Find VLAN path through devices
   */
  static async findVlanPath(vlanId) {
    const topology = await this.getTopology(vlanId)
    
    // Group by devices
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
        inner_vlan_id: item.inner_vlan_id,
        mac_count: item.mac_count
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
   * Get MAC addresses in VLAN
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
   * Delete VLAN
   */
  static async delete(vlanId) {
    const query = 'DELETE FROM vlans WHERE vlan_id = $1 RETURNING *'
    const result = await pool.query(query, [vlanId])
    return result.rows[0]
  }
}

module.exports = VlanModel
