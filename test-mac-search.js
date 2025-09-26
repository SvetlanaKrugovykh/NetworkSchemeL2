const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'netscheme_l2',
  password: 'admin',
  port: 5432,
});

async function testMacSearch() {
  try {
    // Получаем несколько MAC адресов из базы
    console.log('🔍 Проверка формата MAC адресов в базе данных...\n');
    
    const macSample = await pool.query('SELECT DISTINCT mac_address FROM mac_addresses LIMIT 5');
    console.log('Примеры MAC адресов в базе:');
    macSample.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.mac_address}`);
    });
    
    // Тестируем поиск с первым MAC адресом
    if (macSample.rows.length > 0) {
      const testMac = macSample.rows[0].mac_address;
      console.log(`\n🔎 Тестируем поиск MAC: ${testMac}`);
      
      // Нормализуем MAC адрес как в коде
      const normalizedMac = testMac.replace(/[:-]/g, '').toLowerCase();
      console.log(`Нормализованный MAC: ${normalizedMac}`);
      
      // Проверяем поиск
      const searchQuery = `
        SELECT
          ma.mac_address,
          ma.vlan_id,
          ma.vlan_mode,
          d.ip_address as device_ip,
          d.hostname as device_hostname,
          dp.port_name
        FROM mac_addresses ma
        JOIN devices d ON ma.device_id = d.id
        JOIN device_ports dp ON ma.port_id = dp.id
        WHERE LOWER(REPLACE(REPLACE(ma.mac_address, ':', ''), '-', '')) = $1
        LIMIT 3
      `;
      
      const searchResult = await pool.query(searchQuery, [normalizedMac]);
      console.log(`\n📊 Результат поиска: найдено ${searchResult.rows.length} записей`);
      
      if (searchResult.rows.length > 0) {
        searchResult.rows.forEach((row, index) => {
          console.log(`\nЗапись ${index + 1}:`);
          console.log(`  MAC: ${row.mac_address}`);
          console.log(`  Устройство: ${row.device_ip} (${row.device_hostname})`);
          console.log(`  Порт: ${row.port_name}`);
          console.log(`  VLAN: ${row.vlan_id}`);
        });
      } else {
        console.log('❌ MAC не найден при поиске!');
        
        // Проверим прямой поиск
        const directSearch = await pool.query('SELECT * FROM mac_addresses WHERE mac_address = $1 LIMIT 1', [testMac]);
        console.log(`\n🔍 Прямой поиск: найдено ${directSearch.rows.length} записей`);
      }
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

testMacSearch();