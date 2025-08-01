/**
 * Парсер MAC таблиц для различных типов устройств
 */

class MacTableParser {
  /**
   * Парсинг MAC таблицы D-Link коммутатора
   * @param {string} macTableText - текст MAC таблицы
   * @param {string} deviceIp - IP адрес устройства
   * @returns {Array} - массив MAC записей
   */
  static parseDLinkMacTable(macTableText, deviceIp) {
    const macEntries = []
    const lines = macTableText.split('\n').map(line => line.trim())
    
    for (const line of lines) {
      // Формат D-Link: VID  VLAN Name  MAC Address  Port  Type  Status
      const match = line.match(/^\s*(\d+)\s+(\S+)\s+([0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2})\s+(\d+)\s+(\w+)\s+(\w+)/)
      
      if (match) {
        const [, vlanId, vlanName, macAddress, portNumber, type, status] = match
        
        macEntries.push({
          mac_address: this.normalizeMacAddress(macAddress),
          vlan_id: parseInt(vlanId),
          port_number: parseInt(portNumber),
          device_ip: deviceIp,
          status: type.toLowerCase(), // Dynamic/Static
          last_seen: new Date(),
          client_type: null, // будет определяться позже
          description: null
        })
      }
    }
    
    return macEntries
  }

  /**
   * Парсинг MAC таблицы для устройств с форматом Cisco-like
   * @param {string} macTableText - текст MAC таблицы  
   * @param {string} deviceIp - IP адрес устройства
   * @returns {Array} - массив MAC записей
   */
  static parseCiscoLikeMacTable(macTableText, deviceIp) {
    const macEntries = []
    const lines = macTableText.split('\n').map(line => line.trim())
    
    for (const line of lines) {
      // Формат: Vlan Mac Address Type Ports
      const match = line.match(/^\s*(\d+)\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\w+)\s+(.+)/)
      
      if (match) {
        const [, vlanId, macAddress, type, ports] = match
        
        // Извлекаем номер порта из строки портов
        const portMatch = ports.match(/(\d+)/)
        const portNumber = portMatch ? parseInt(portMatch[1]) : null
        
        macEntries.push({
          mac_address: this.normalizeMacAddress(macAddress),
          vlan_id: parseInt(vlanId),
          port_number: portNumber,
          device_ip: deviceIp,
          status: type.toLowerCase(),
          last_seen: new Date(),
          client_type: null,
          description: null
        })
      }
    }
    
    return macEntries
  }

  /**
   * Автоматическое определение формата и парсинг
   * @param {string} macTableText - текст MAC таблицы
   * @param {string} deviceIp - IP адрес устройства
   * @returns {Array} - массив MAC записей
   */
  static parseAuto(macTableText, deviceIp) {
    // Определяем формат по характерным признакам
    if (macTableText.includes('VID') && macTableText.includes('VLAN Name')) {
      return this.parseDLinkMacTable(macTableText, deviceIp)
    } else if (macTableText.includes('Mac Address Table')) {
      return this.parseCiscoLikeMacTable(macTableText, deviceIp)
    } else {
      console.warn(`Unknown MAC table format for device ${deviceIp}`)
      return []
    }
  }

  /**
   * Нормализация MAC адреса к стандартному формату
   * @param {string} macAddress - MAC адрес в любом формате
   * @returns {string} - нормализованный MAC адрес
   */
  static normalizeMacAddress(macAddress) {
    // Удаляем все разделители и приводим к нижнему регистру
    const cleanMac = macAddress.replace(/[-:\.]/g, '').toLowerCase()
    
    // Проверяем корректность длины
    if (cleanMac.length !== 12) {
      throw new Error(`Invalid MAC address: ${macAddress}`)
    }
    
    // Возвращаем в формате xx:xx:xx:xx:xx:xx
    return cleanMac.match(/.{2}/g).join(':')
  }

  /**
   * Определение типа клиента по MAC адресу (на основе OUI)
   * @param {string} macAddress - MAC адрес
   * @returns {string} - тип устройства
   */
  static detectDeviceType(macAddress) {
    const oui = macAddress.substring(0, 8).replace(/:/g, '').toLowerCase()
    
    // Известные OUI производителей
    const ouiDatabase = {
      // Роутеры/коммутаторы
      '001122': 'network_device',
      '000e38': 'network_device', // D-Link
      '001cf0': 'network_device', // D-Link
      
      // Компьютеры/ноутбуки
      '001e58': 'computer', // Dell
      '0021cc': 'computer', // HP
      '002564': 'computer', // Apple
      
      // IP камеры
      '001788': 'camera',
      '9ceb': 'camera',
      
      // По умолчанию
      default: 'unknown'
    }
    
    return ouiDatabase[oui] || ouiDatabase.default
  }
}

module.exports = MacTableParser
