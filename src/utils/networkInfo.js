/**
 * Live Server Pro - Network Info
 *
 * Detects the machine's LAN IP address for browser sync /
 * QR code sharing, so developers can open the site on
 * other devices on the same network.
 */

'use strict';

const os = require('os');

/**
 * Get the primary LAN (non-loopback IPv4) address.
 * Returns the first external IPv4 address found, or null.
 *
 * @returns {string|null} LAN IP address (e.g. '192.168.1.42')
 */
function getLANAddress() {
  const interfaces = os.networkInterfaces();

  for (const ifaceName of Object.keys(interfaces)) {
    const addresses = interfaces[ifaceName];
    for (const addr of addresses) {
      // IPv4 only, skip loopback and link-local (169.254.x.x)
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&
        !addr.address.startsWith('169.254.')
      ) {
        return addr.address;
      }
    }
  }

  return null;
}

/**
 * Get all LAN addresses (for multi-NIC machines).
 * @returns {string[]}
 */
function getAllLANAddresses() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const ifaceName of Object.keys(interfaces)) {
    const addresses = interfaces[ifaceName];
    for (const addr of addresses) {
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&
        !addr.address.startsWith('169.254.')
      ) {
        results.push(addr.address);
      }
    }
  }

  return results;
}

module.exports = { getLANAddress, getAllLANAddresses };
