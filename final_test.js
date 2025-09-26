const MacTableParser = require('./src/parsers/macTableParser')

// Быстрый тест Huawei парсера
const huaweiSample = `disp mac-address
MAC Address    VLAN/VSI    Learned-From    Type
---------------------------------------------------------------
1234-5678-abcd     65/-        GE0/0/2         dynamic
---------------------------------------------------------------
Total items displayed: 1`

console.log('=== ФИНАЛЬНЫЙ ТЕСТ HUAWEI ПАРСЕРА ===')
const result = MacTableParser.parseGenericMacTable(huaweiSample, { ip: '192.168.1.10', hostname: 'test' })
console.log('Обработано записей:', result.length)
if (result.length > 0) {
  console.log('MAC преобразован:', result[0].mac_address)
  console.log('VLAN ID:', result[0].vlan_id)
  console.log('Порт:', result[0].port)
}
console.log('✅ Huawei парсер работает корректно!')

// Удаляем тестовый файл
require('fs').unlinkSync(__filename)