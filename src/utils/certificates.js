/**
 * Live Server Pro - Self-Signed Certificate Generator
 *
 * Generates a self-signed TLS certificate for HTTPS mode.
 * Uses the `selfsigned` npm package for programmatic cert creation.
 */

'use strict';

const selfsigned = require('selfsigned');

/**
 * Generate a self-signed certificate.
 * @returns {Promise<{cert: string, key: string}>}
 */
async function generateCertificates() {
  return new Promise((resolve, reject) => {
    const attrs = [
      { name: 'commonName', value: 'localhost' },
      { name: 'organizationName', value: 'Live Server Pro Dev Server' },
    ];

    const options = {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },   // DNS
            { type: 7, ip: '127.0.0.1' },      // IP
          ],
        },
      ],
    };

    try {
      const pems = selfsigned.generate(attrs, options);
      resolve({ cert: pems.cert, key: pems.private });
    } catch (err) {
      reject(new Error(`Certificate generation failed: ${err.message}`));
    }
  });
}

module.exports = { generateCertificates };
