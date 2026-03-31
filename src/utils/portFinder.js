/**
 * Live Server Pro - Port Finder
 *
 * Detects an available port starting from the preferred port.
 * Uses the `detect-port` package for reliable port checking.
 */

'use strict';

const detectPort = require('detect-port');

/**
 * Find an available port, starting from the preferred port.
 * If the preferred port is in use, returns the next available one.
 *
 * @param {number} preferredPort
 * @returns {Promise<number>} Available port number
 */
async function findAvailablePort(preferredPort) {
  const port = await detectPort(preferredPort);
  return port;
}

/**
 * Check if a specific port is available.
 * @param {number} portNumber
 * @returns {Promise<boolean>}
 */
async function isPortAvailable(portNumber) {
  const available = await detectPort(portNumber);
  return available === portNumber;
}

module.exports = { findAvailablePort, isPortAvailable };
