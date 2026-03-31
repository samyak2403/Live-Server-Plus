/**
 * Live Server Pro - File Watcher
 *
 * Uses chokidar for cross-platform, efficient file watching.
 * Features:
 *   - Debounced events to avoid bursts of reloads
 *   - CSS-specific hot-swap vs full reload for other files
 *   - Ignores node_modules, .git, and other build artifacts
 */

'use strict';

const chokidar = require('chokidar');
const path = require('path');

// File extensions that trigger a full reload
const FULL_RELOAD_EXTS = new Set([
  '.html', '.htm', '.js', '.mjs', '.ts', '.tsx', '.jsx',
  '.json', '.vue', '.svelte', '.astro', '.php',
]);

// File extensions that trigger a CSS hot-swap
const CSS_EXTS = new Set(['.css', '.scss', '.sass', '.less', '.styl']);

// Patterns to always ignore
const IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/dist/**',
  '**/build/**',
  '**/.cache/**',
  '**/__pycache__/**',
  '**/*.log',
  '**/.DS_Store',
  '**/Thumbs.db',
];

class Watcher {
  /**
   * @param {object} options
   * @param {string}   options.root         Absolute path to watch
   * @param {number}   options.debounce     Debounce delay in ms
   * @param {Function} options.onCSSChange  Called with file path on CSS change
   * @param {Function} options.onFullReload Called with file path on non-CSS change
   * @param {object}   options.logger       Logger instance
   */
  constructor({ root, debounce = 200, onCSSChange, onFullReload, logger }) {
    this.root = root;
    this.debounceDelay = debounce;
    this.onCSSChange = onCSSChange;
    this.onFullReload = onFullReload;
    this.logger = logger;
    this.watcher = null;
    this._debounceTimers = new Map();
    this._changeCount = 0;
  }

  /**
   * Start watching the root directory.
   */
  start() {
    this.watcher = chokidar.watch(this.root, {
      ignored: IGNORED_PATTERNS,
      persistent: true,
      ignoreInitial: true,          // Don't fire events on initial scan
      awaitWriteFinish: {           // Wait for file write to complete
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      usePolling: false,            // Prefer native fs events
      interval: 100,
      binaryInterval: 300,
    });

    this.watcher
      .on('change', (filePath) => this._handleChange(filePath, 'change'))
      .on('add', (filePath) => this._handleChange(filePath, 'add'))
      .on('unlink', (filePath) => this._handleChange(filePath, 'unlink'))
      .on('error', (err) => {
        this.logger.warn(`Watcher error: ${err.message}`);
      })
      .on('ready', () => {
        this.logger.info(`Watching: ${this.root}`);
      });
  }

  /**
   * Handle a raw file change event with debouncing.
   * @param {string} filePath
   * @param {string} event
   */
  _handleChange(filePath, event) {
    // Cancel any pending debounce for this file
    if (this._debounceTimers.has(filePath)) {
      clearTimeout(this._debounceTimers.get(filePath));
    }

    const timer = setTimeout(() => {
      this._debounceTimers.delete(filePath);
      this._dispatchChange(filePath, event);
    }, this.debounceDelay);

    this._debounceTimers.set(filePath, timer);
  }

  /**
   * Dispatch the change event to the correct handler.
   * @param {string} filePath
   * @param {string} event
   */
  _dispatchChange(filePath, event) {
    this._changeCount++;
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(this.root, filePath);

    if (CSS_EXTS.has(ext) && event === 'change') {
      // CSS hot-swap — no full reload needed
      this.logger.debug(`CSS hot-swap [${event}]: ${relativePath}`);
      if (this.onCSSChange) this.onCSSChange(filePath);
    } else if (FULL_RELOAD_EXTS.has(ext) || event === 'add' || event === 'unlink') {
      // Full reload for HTML, JS, or file additions/deletions
      this.logger.debug(`Full reload [${event}]: ${relativePath}`);
      if (this.onFullReload) this.onFullReload(filePath);
    } else {
      // Unknown extension — do a full reload to be safe
      this.logger.debug(`Unknown type, full reload [${event}]: ${relativePath}`);
      if (this.onFullReload) this.onFullReload(filePath);
    }
  }

  /**
   * Stop watching files. Clears all timers.
   */
  async stop() {
    // Clear all pending debounce timers
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.logger.info(`File watcher stopped (${this._changeCount} events handled).`);
    }
  }

  /**
   * Add additional paths to watch (for multi-root workspaces).
   * @param {string} folderPath
   */
  addPath(folderPath) {
    if (this.watcher) {
      this.watcher.add(folderPath);
      this.logger.info(`Watcher: added path ${folderPath}`);
    }
  }

  /**
   * Remove a path from the watch list.
   * @param {string} folderPath
   */
  removePath(folderPath) {
    if (this.watcher) {
      this.watcher.unwatch(folderPath);
      this.logger.info(`Watcher: removed path ${folderPath}`);
    }
  }
}

module.exports = Watcher;
