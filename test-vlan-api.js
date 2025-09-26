// Тест API для проверки MAC адресов в VLAN 18
const fetch = require('node-fetch').default || require('node-fetch');

async function testVlanAPI() {
  try {
    console.log('Тестирую API /api/vlans...');
    const response = await fetch('http://localhost:7111/api/vlans');
    const result = await response.json();

    if (result.success) {
      const vlan18 = result.data.find(vlan => vlan.vlan_id === 18);
      if (vlan18) {
        console.log('VLAN 18 найден:');
        console.log(`- VLAN ID: ${vlan18.vlan_id}`);
        console.log(`- Название: ${vlan18.name}`);
        console.log(`- MAC адресов: ${vlan18.mac_count}`);
        console.log(`- Устройств: ${vlan18.device_count}`);
        console.log(`- Описание: ${vlan18.description}`);
      } else {
        console.log('VLAN 18 не найден в API');
      }
    } else {
      console.log('Ошибка API:', result.message);
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

testVlanAPI();
