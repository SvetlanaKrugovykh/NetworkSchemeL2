-- Network Scheme L2 Database Schema

-- Devices (switches, OLT)
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR(255),
    ip_address INET UNIQUE NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'dlink', 'olt', 'other'
    model VARCHAR(100),
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device ports
CREATE TABLE IF NOT EXISTS device_ports (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    port_number INTEGER NOT NULL,
    port_name VARCHAR(50),
    port_type VARCHAR(20), -- 'ethernet', 'fiber', 'epon'
    description TEXT,
    status VARCHAR(20) DEFAULT 'up',
    speed VARCHAR(20),
    duplex VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, port_number)
);

-- VLAN configuration
CREATE TABLE IF NOT EXISTS vlans (
    id SERIAL PRIMARY KEY,
    vlan_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'qinq', 'voice'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VLAN on devices and ports
CREATE TABLE IF NOT EXISTS device_vlans (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    port_id INTEGER REFERENCES device_ports(id) ON DELETE CASCADE,
    vlan_id INTEGER REFERENCES vlans(vlan_id),
    mode VARCHAR(20) NOT NULL, -- 'access', 'trunk', 'tagged', 'untagged'
    native_vlan BOOLEAN DEFAULT FALSE,
    qinq_enabled BOOLEAN DEFAULT FALSE,
    outer_vlan INTEGER,
    inner_vlan INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, port_id, vlan_id, mode)
);

-- MAC addresses
CREATE TABLE IF NOT EXISTS mac_addresses (
    id SERIAL PRIMARY KEY,
    mac_address MACADDR NOT NULL,
    ip_address INET,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    port_id INTEGER REFERENCES device_ports(id) ON DELETE SET NULL,
    vlan_id INTEGER REFERENCES vlans(vlan_id),
    client_type VARCHAR(50), -- 'client', 'device', 'server'
    description TEXT,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'static', 'dynamic'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device configurations (history)
CREATE TABLE IF NOT EXISTS device_configurations (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    config_text TEXT NOT NULL,
    config_hash VARCHAR(64) NOT NULL,
    config_type VARCHAR(50) DEFAULT 'running', -- 'running', 'startup', 'backup'
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_mac ON mac_addresses(mac_address);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_ip ON mac_addresses(ip_address);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_vlan ON mac_addresses(vlan_id);
CREATE INDEX IF NOT EXISTS idx_device_vlans_device ON device_vlans(device_id);
CREATE INDEX IF NOT EXISTS idx_device_vlans_vlan ON device_vlans(vlan_id);
