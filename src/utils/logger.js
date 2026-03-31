/**
 * Live Server Pro - Logger
 *
 * Wraps VS Code's OutputChannel to provide structured,
 * leveled logging with timestamps.
 */

'use strict';

const vscode = require('vscode');

class Logger {
  /**
   * @param {string} channelName Display name in the Output panel
   */
  constructor(channelName) {
    this._channel = vscode.window.createOutputChannel(channelName);
  }

  /**
   * Format a log line with timestamp and level.
   * @param {string} level
   * @param {string} message
   */
  _format(level, message) {
    const ts = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `[${ts}] [${level.padEnd(5)}] ${message}`;
  }

  /**
   * Log an informational message. Reveals the output channel.
   * @param {string} message
   */
  info(message) {
    this._channel.appendLine(this._format('INFO', message));
  }

  /**
   * Log a warning message.
   * @param {string} message
   */
  warn(message) {
    this._channel.appendLine(this._format('WARN', message));
  }

  /**
   * Log an error message.
   * @param {string} message
   */
  error(message) {
    this._channel.appendLine(this._format('ERROR', message));
    this._channel.show(true); // Reveal on error
  }

  /**
   * Log a debug message (only shown in output, not toasted).
   * @param {string} message
   */
  debug(message) {
    this._channel.appendLine(this._format('DEBUG', message));
  }

  /**
   * Show the output channel.
   * @param {boolean} [preserveFocus=true]
   */
  show(preserveFocus = true) {
    this._channel.show(preserveFocus);
  }

  /**
   * Clear the output channel.
   */
  clear() {
    this._channel.clear();
  }

  /**
   * Dispose of the output channel.
   */
  dispose() {
    this._channel.dispose();
  }
}

module.exports = Logger;
