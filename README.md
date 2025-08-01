# Network Scheme L2

System for L2 network topology analysis, VLAN scheme generation, and network equipment configuration automation.

## Features

- 📊 Parsing configurations of  switches and OLT devices
- 🏷️ Import and analysis of MAC tables
- 🌐 VLAN topology construction
- 📋 HTML VLAN path scheme generation
- 🔍 API for network data operations
- 📈 Web interface for visualization

## Project Structure

```
├── data/                    # Data
│   ├── configs/            # Device configurations
│   ├── macs/              # MAC tables
│   └── generated/         # Generated files
├── src/
│   ├── controllers/       # API controllers
│   ├── db/               # Database
│   ├── models/           # Data models
│   ├── parsers/          # Configuration parsers
│   ├── routes/           # API routes
│   └── services/         # Business logic
├── logs/                 # Logs
├── package.json
├── server.js            # Main server file
└── README.md
```

## Installation and Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Database configuration

Create a PostgreSQL database and configure the `.env` file:

```env
# Database configuration
LANG_DB_USER=postgres
LANG_DB_HOST=localhost
LANG_DB_NAME=netscheme_l2
LANG_DB_PASSWORD=your_password
LANG_DB_PORT=5432

# Server configuration
HOST=127.0.0.1
PORT=7111

# Logging
LOG_DIR=logs
LOG_FILE=netscheme.log
```

### 3. Database initialization

Database schema is created automatically on first startup.

### 4. Start server

```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

## Usage

### 1. Adding data

Place files in appropriate directories:

- **Device configurations**: `data/configs/192.168.x.x.cfg`
- **MAC tables**: `data/macs/192.168.x.x`

### 2. Data import

```bash
curl -X POST http://localhost:7111/api/import
```

Or via web interface: `http://localhost:7111/`

### 3. API endpoints

- `GET /api/devices` - list of all devices
- `GET /api/devices/:id` - device information
- `GET /api/vlans` - list of all VLANs
- `GET /api/vlans/:vlanId/topology` - VLAN topology
- `GET /api/vlans/:vlanId/macs` - MAC addresses in VLAN
- `GET /api/vlans/:vlanId/scheme` - HTML VLAN scheme

### 4. Scheme generation

To get HTML VLAN scheme:
```
http://localhost:7111/api/vlans/13/scheme
```

## Supported Formats

### Device Configurations

- ** switches**: `show config effective` format
- **OLT devices**: Cisco-like format configurations (in development)

### MAC Tables

- ** format**: `VID VLAN Name MAC Address Port Type Status`
- **Cisco-like format**: `Vlan Mac Address Type Ports`

## Examples

### Data import and VLAN viewing

```javascript
// Import all data from data/ directory
const response = await fetch('/api/import', { method: 'POST' });

// Get VLAN list
const vlans = await fetch('/api/vlans').then(r => r.json());

// Get VLAN 13 topology
const topology = await fetch('/api/vlans/13/topology').then(r => r.json());
```

### Programmatic configuration parsing

```javascript
const DLinkConfigParser = require('./src/parsers/dlinkConfigParser');
const fs = require('fs');

const configText = fs.readFileSync('data/configs/192.168.1.1.cfg', 'utf8');
const parser = new DLinkConfigParser();
const result = parser.parse(configText, '192.168.1.1');

console.log('Device:', result.device);
console.log('VLANs:', result.vlans.length);
console.log('Ports:', result.ports.length);
```

## Database Structure

### Main Tables

- **devices** - network devices
- **device_ports** - device ports
- **vlans** - VLAN configuration
- **device_vlans** - device-VLAN-port relationships
- **mac_addresses** - MAC addresses
- **device_configurations** - configuration history

## Development Roadmap

### Stage 1 (Current)

- ✅  configuration parsers
- ✅ MAC table import
- ✅ Basic HTML scheme generation
- ✅ REST API

### Stage 2

- 🔄 OLT configuration parser
- 🔄 Web interface
- 🔄 Interactive schemes
- 🔄 MAC/IP search

### Stage 3

- 📋 Configuration generation from templates
- 🔧 Template system
- ✅ Configuration validation
- 🔄 Automatic deployment

## Testing

```bash
# Test parsers
node test-parsers.js

# Run tests (when added)
npm test
```

## License

ISC

## Support

For questions and suggestions, create issues in the repository.
