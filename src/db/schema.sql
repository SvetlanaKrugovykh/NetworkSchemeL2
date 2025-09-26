-- Network Scheme L2 Database Schema
-- Updated to handle real L2 network topology with MAC duplicates

-- Create tables only if they don't exist (preserves data)
-- No DROP commands to prevent data loss

-- Devices (switches, OLT)
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR(255),
    ip_address INET UNIQUE NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'dlink', 'olt', 'cisco', etc.
    model VARCHAR(100),
    firmware VARCHAR(100),
    location VARCHAR(255),
    description TEXT,
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
    port_type VARCHAR(20), -- 'ethernet', 'fiber', 'epon', 'epon_access'
    description TEXT,
    admin_state VARCHAR(20) DEFAULT 'up', -- 'up', 'down'
    oper_state VARCHAR(20) DEFAULT 'up', -- 'up', 'down', 'unknown'
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

-- MAC addresses - REDESIGNED to handle duplicates across network path
CREATE TABLE IF NOT EXISTS mac_addresses (
    id SERIAL PRIMARY KEY,
    mac_address MACADDR NOT NULL,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    port_id INTEGER REFERENCES device_ports(id) ON DELETE CASCADE,
    vlan_id INTEGER NOT NULL REFERENCES vlans(vlan_id) ON DELETE CASCADE,
    ip_address INET,
    learning_method VARCHAR(20) DEFAULT 'dynamic', -- 'dynamic', 'static', 'secure'
    client_type VARCHAR(50), -- 'computer', 'printer', 'phone', 'camera', 'server'
    description TEXT,
    location VARCHAR(255),
    is_source BOOLEAN DEFAULT false, -- TRUE if this is actual device location
    hop_count INTEGER DEFAULT 0, -- Distance from source (0 = source, 1+ = transit)
    vendor VARCHAR(100), -- MAC vendor (OUI)
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Allow same MAC on different devices/ports/vlans (L2 network reality)
    UNIQUE(mac_address, device_id, port_id, vlan_id)
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_device_ports_device ON device_ports(device_id);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_mac ON mac_addresses(mac_address);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_device ON mac_addresses(device_id);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_vlan ON mac_addresses(vlan_id);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_source ON mac_addresses(is_source);
CREATE INDEX IF NOT EXISTS idx_mac_addresses_ip ON mac_addresses(ip_address);

-- Insert default VLANs
INSERT INTO vlans (vlan_id, name, description, type) VALUES 
(1, 'default', 'Default VLAN', 'standard'),
(1002, 'management', 'Management VLAN', 'standard')
ON CONFLICT (vlan_id) DO NOTHING;

-- Triggers for updated_at (with safe creation)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mac_addresses_updated_at ON mac_addresses;
CREATE TRIGGER update_mac_addresses_updated_at BEFORE UPDATE ON mac_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
