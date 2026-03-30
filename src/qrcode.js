/**
 * LiveFlow Pro - QR Code Generator
 *
 * Generates a QR code for the server URL and prints it
 * to the VS Code Output Channel so developers can quickly
 * open the site on a mobile device via LAN.
 */

'use strict';

const qrcode = require('qrcode-terminal');

/**
 * Generate and log a QR code for the given URL.
 * @param {string} url      The LAN URL to encode
 * @param {object} logger   Logger instance
 */
function generateQRCode(url, logger) {
  return new Promise((resolve) => {
    logger.info('');
    logger.info('─────────────────────────────────────────');
    logger.info('  📱 Scan QR code to open on mobile:');
    logger.info(`  URL: ${url}`);
    logger.info('─────────────────────────────────────────');

    qrcode.generate(url, { small: true }, (qr) => {
      // Print each line of the QR code to the output channel
      const lines = qr.split('\n');
      for (const line of lines) {
        logger.info(line);
      }
      logger.info('─────────────────────────────────────────');
      logger.info('');
      resolve();
    });
  });
}

module.exports = { generateQRCode };
