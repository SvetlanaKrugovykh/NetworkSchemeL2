const net = require('net')

/**
 * IP Access Control Middleware
 * Checks if client IP is in the allowed list from environment variable
 */
class IPAccessControl {
  constructor() {
    this.allowedIPs = this.parseAllowedIPs()
    console.log('🔒 IP Access Control initialized:', this.allowedIPs.length > 0 ? 'ENABLED' : 'DISABLED')
    if (this.allowedIPs.length > 0) {
      console.log('✅ Allowed IPs/Networks:', this.allowedIPs.map(ip => ip.original).join(', '))
    }
  }

  /**
   * Parse ALLOWED_IPS from environment variable
   */
  parseAllowedIPs() {
    const allowedIPs = process.env.ALLOWED_IPS
    if (!allowedIPs || allowedIPs.trim() === '') {
      return [] // Empty = allow all
    }

    return allowedIPs.split(',').map(ip => {
      const trimmed = ip.trim()
      if (trimmed.includes('/')) {
        // CIDR notation (e.g., 192.168.1.0/24)
        const [network, prefixLength] = trimmed.split('/')
        return {
          type: 'cidr',
          network: network,
          prefixLength: parseInt(prefixLength),
          original: trimmed
        }
      } else {
        // Single IP
        return {
          type: 'single',
          ip: trimmed,
          original: trimmed
        }
      }
    })
  }

  /**
   * Check if IP is in CIDR range
   */
  isIPInCIDR(ip, network, prefixLength) {
    try {
      const isIPv6 = ip.includes(':')
      const isNetworkIPv6 = network.includes(':')
      
      if (isIPv6 !== isNetworkIPv6) {
        return false // Different IP versions
      }

      if (isIPv6) {
        // IPv6 CIDR check (simplified)
        return ip.startsWith(network.split(':').slice(0, Math.floor(prefixLength / 16)).join(':'))
      } else {
        // IPv4 CIDR check
        const ipInt = this.ipToInt(ip)
        const networkInt = this.ipToInt(network)
        const mask = (-1 << (32 - prefixLength)) >>> 0
        
        return (ipInt & mask) === (networkInt & mask)
      }
    } catch (error) {
      console.error('❌ Error checking CIDR:', error.message)
      return false
    }
  }

  /**
   * Convert IPv4 to integer
   */
  ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
  }

  /**
   * Check if client IP is allowed
   */
  isAllowed(clientIP) {
    // If no restrictions configured, allow all
    if (this.allowedIPs.length === 0) {
      return true
    }

    // Normalize IPv6 loopback
    if (clientIP === '::1') {
      clientIP = '127.0.0.1'
    }

    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    if (clientIP.startsWith('::ffff:')) {
      clientIP = clientIP.substring(7)
    }

    for (const allowedIP of this.allowedIPs) {
      if (allowedIP.type === 'single') {
        if (clientIP === allowedIP.ip || 
            (allowedIP.ip === '127.0.0.1' && clientIP === '::1')) {
          return true
        }
      } else if (allowedIP.type === 'cidr') {
        if (this.isIPInCIDR(clientIP, allowedIP.network, allowedIP.prefixLength)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Fastify middleware function
   */
  middleware() {
    return async (request, reply) => {
      const clientIP = request.ip || request.connection.remoteAddress || request.headers['x-forwarded-for']
      
      if (!this.isAllowed(clientIP)) {
        console.warn(`🚫 Access denied for IP: ${clientIP}`)
        reply.code(403).send({
          error: 'Access denied',
          message: 'Your IP address is not allowed to access this service',
          ip: clientIP
        })
        return
      }

      // Log allowed access (optional, can be disabled for performance)
      if (process.env.LOG_ACCESS === 'true') {
        console.log(`✅ Access granted for IP: ${clientIP}`)
      }
    }
  }
}

module.exports = IPAccessControl