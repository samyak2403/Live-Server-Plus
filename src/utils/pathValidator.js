/**
 * Live Server Pro - Path Validator
 *
 * Prevents directory traversal attacks by ensuring that
 * all resolved file paths stay within the server root.
 *
 * Security principle: Normalize the URL path, resolve it
 * against the root, then confirm the result starts with root.
 */

'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Validate and resolve a URL path against the server root.
 * Returns the resolved absolute path if safe, or null if unsafe.
 *
 * @param {string} root    Absolute server root directory
 * @param {string} urlPath URL-style path (e.g. '/subdir/file.html')
 * @returns {string|null}  Resolved absolute path, or null if traversal detected
 */
function validatePath(root, urlPath) {
  // Normalize slashes and remove null bytes
  const cleaned = urlPath.replace(/\0/g, '').replace(/\\/g, '/');

  // Decode any remaining percent-encoded sequences
  let decoded;
  try {
    decoded = decodeURIComponent(cleaned);
  } catch {
    return null; // Invalid encoding — reject
  }

  // Resolve the path against the root
  const resolved = path.resolve(root, '.' + decoded);

  // Ensure resolved path starts with root (prevent traversal)
  const normalRoot = path.normalize(root + path.sep);
  if (!resolved.startsWith(normalRoot) && resolved !== path.normalize(root)) {
    return null;
  }

  return resolved;
}

/**
 * Check whether a path is a safe file (exists, not a symlink outside root).
 * @param {string} root
 * @param {string} filePath
 * @returns {boolean}
 */
function isSafePath(root, filePath) {
  if (!validatePath(root, filePath)) return false;

  try {
    const realPath = fs.realpathSync(filePath);
    const realRoot = fs.realpathSync(root);
    return realPath.startsWith(realRoot);
  } catch {
    return false;
  }
}

module.exports = { validatePath, isSafePath };
