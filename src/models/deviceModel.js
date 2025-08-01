const pool = require('../db/pool')

class DeviceModel {
  /**
   * Create new device
   */
  static async create(deviceData) {
    const {
      hostname,
      ip_address,
      device_type,
      model,
      location,
      status = 'active'
    } = deviceData

    const query = `
      INSERT INTO devices (hostname, ip_address, device_type, model, location, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `
    
    const result = await pool.query(query, [
      hostname, ip_address, device_type, model, location, status
    ])
    
    return result.rows[0]
  }

  /**
   * Find device by IP
   */
  static async findByIp(ipAddress) {
    const query = 'SELECT * FROM devices WHERE ip_address = $1'
    const result = await pool.query(query, [ipAddress])
    return result.rows[0]
  }

  /**
   * Получение всех устройств
   */
  static async findAll() {
    const query = 'SELECT * FROM devices ORDER BY ip_address'
    const result = await pool.query(query)
    return result.rows
  }

  /**
   * Обновление устройства
   */
  static async update(id, updateData) {
    const fields = []
    const values = []
    let paramCount = 1

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`)
        values.push(updateData[key])
        paramCount++
      }
    })

    if (fields.length === 0) {
      throw new Error('No fields to update')
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const query = `
      UPDATE devices 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await pool.query(query, values)
    return result.rows[0]
  }

  /**
   * Удаление устройства
   */
  static async delete(id) {
    const query = 'DELETE FROM devices WHERE id = $1 RETURNING *'
    const result = await pool.query(query, [id])
    return result.rows[0]
  }

  /**
   * Получение устройства с портами
   */
  static async findWithPorts(id) {
    const deviceQuery = 'SELECT * FROM devices WHERE id = $1'
    const deviceResult = await pool.query(deviceQuery, [id])
    
    if (deviceResult.rows.length === 0) {
      return null
    }

    const device = deviceResult.rows[0]

    const portsQuery = `
      SELECT * FROM device_ports 
      WHERE device_id = $1 
      ORDER BY port_number
    `
    const portsResult = await pool.query(portsQuery, [id])

    device.ports = portsResult.rows
    return device
  }

  /**
   * Получение устройства с VLAN конфигурацией
   */
  static async findWithVlans(id) {
    const device = await this.findWithPorts(id)
    if (!device) return null

    const vlansQuery = `
      SELECT dv.*, v.name as vlan_name, v.description as vlan_description,
             dp.port_number, dp.port_name
      FROM device_vlans dv
      JOIN vlans v ON dv.vlan_id = v.vlan_id
      JOIN device_ports dp ON dv.port_id = dp.id
      WHERE dv.device_id = $1
      ORDER BY v.vlan_id, dp.port_number
    `
    const vlansResult = await pool.query(vlansQuery, [id])

    device.vlans = vlansResult.rows
    return device
  }
}

module.exports = DeviceModel
