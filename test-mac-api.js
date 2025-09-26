// Простой тест для проверки MAC адресов
require('dotenv').config();

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 7111;
const BASE_URL = `http://${HOST}:${PORT}`;

const testMac = '11:22:33:44:55:66';
const normalizedMac = testMac.replace(/[:-]/g, '').toLowerCase();

console.log('🔍 Тестируем поиск MAC адреса:');
console.log('Исходный MAC:', testMac);
console.log('Нормализованный:', normalizedMac);
console.log('Сервер:', BASE_URL);

// Тест через fetch API
fetch(`${BASE_URL}/api/macs/${normalizedMac}`)
  .then(response => response.json())
  .then(data => {
    console.log('📊 Результат поиска:', data);
    if (data.success && data.data.length > 0) {
      console.log('✅ MAC найден:', data.data);
    } else {
      console.log('❌ MAC не найден');

      // Попробуем найти частичное совпадение
      const partialMac = normalizedMac.substring(0, 6);
      console.log('🔍 Пробуем частичный поиск:', partialMac);

      return fetch(`${BASE_URL}/api/macs/${partialMac}`);
    }
  })
  .then(response => {
    if (response) {
      return response.json();
    }
  })
  .then(data => {
    if (data) {
      console.log('📊 Результат частичного поиска:', data);
    }
  })
  .catch(error => {
    console.error('❌ Ошибка:', error.message);
  });
