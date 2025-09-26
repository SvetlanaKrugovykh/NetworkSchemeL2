-- Удаление устаревшей таблицы device_vlans
-- Все данные о связях устройств и VLAN теперь берутся из mac_addresses

DROP TABLE IF EXISTS device_vlans CASCADE;

DROP SEQUENCE IF EXISTS device_vlans_id_seq CASCADE;

-- Обновляем схему БД - удаляем старые индексы если они есть
DROP INDEX IF EXISTS idx_device_vlans_device;

DROP INDEX IF EXISTS idx_device_vlans_vlan;

-- Теперь все данные о том, какие устройства в каких VLAN участвуют,
-- получаются из таблицы mac_addresses
