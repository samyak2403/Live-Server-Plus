/**
 * LiveFlow Pro - WebSocket Server
 *
 * Manages the WebSocket connections for:
 *   - CSS hot-swap (no full reload)
 *   - Full page reload (HTML/JS changes)
 *   - Error overlay injection
 *
 * Attached to the same HTTP server instance to avoid
 * needing a separate port.
 */

'use strict';

const { WebSocketServer: WSServer } = require('ws');

class WebSocketServer {
  /**
   * @param {object} options
   * @param {object} options.logger Logger instance
   */
  constructor({ logger }) {
    this.logger = logger;
    this.wss = null;
    this.clients = new Set();
    // We use the same port as HTTP, path-based upgrades
    this._port = null;
  }

  /**
   * Attach this WebSocket server to an existing HTTP server.
   * This allows sharing the same port as the HTTP server.
   * @param {http.Server} httpServer
   */
  attachToServer(httpServer) {
    this.wss = new WSServer({
      server: httpServer,
      path: '/__liveflow_ws__',
    });

    // Grab the port after it starts
    httpServer.once('listening', () => {
      this._port = httpServer.address().port;
    });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      this.logger.debug(`WebSocket client connected (${this.clients.size} total)`);

      // Defer handshake so the client's message listener is always registered first
      setImmediate(() => {
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({ type: 'connected', message: 'LiveFlow Pro live-reload active' }),
            { binary: false }
          );
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.logger.debug(`WebSocket client disconnected (${this.clients.size} remaining)`);
      });

      ws.on('error', (err) => {
        this.logger.debug(`WebSocket error: ${err.message}`);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (err) => {
      this.logger.error(`WebSocket server error: ${err.message}`);
    });

    this.logger.info('WebSocket server attached (same port, path: /__liveflow_ws__)');
  }

  /**
   * Get the port the WS server listens on.
   * Since we share with HTTP, this is the HTTP port.
   */
  getPort() {
    return this._port;
  }

  /**
   * Send a CSS hot-swap message to all clients.
   * Clients will replace only the changed stylesheet.
   * @param {string} filePath Absolute path to changed CSS file
   */
  sendCSSReload(filePath) {
    const fileName = filePath.replace(/\\/g, '/').split('/').pop();
    this._broadcast({ type: 'css', file: fileName });
  }

  /**
   * Send a full page reload message to all clients.
   */
  sendFullReload() {
    this._broadcast({ type: 'reload' });
  }

  /**
   * Send an error message to all clients (shows overlay in browser).
   * @param {string} message Error message
   * @param {string} [stack] Stack trace
   */
  sendError(message, stack) {
    this._broadcast({ type: 'error', message, stack });
  }

  /**
   * Broadcast a JSON message to all connected clients.
   * @param {object} data
   */
  _broadcast(data) {
    if (!this.wss || this.clients.size === 0) return;

    const payload = JSON.stringify(data);
    let sent = 0;
    let failed = 0;

    for (const client of this.clients) {
      // Only send to open connections
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        try {
          client.send(payload, { binary: false });
          sent++;
        } catch (err) {
          this.logger.debug(`Failed to send to client: ${err.message}`);
          this.clients.delete(client);
          failed++;
        }
      }
    }

    this.logger.debug(
      `Broadcast [${data.type}] → ${sent} client(s)${failed ? ` (${failed} failed)` : ''}`
    );
  }

  /**
   * Stop the WebSocket server and close all connections.
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all clients
      for (const client of this.clients) {
        try { client.terminate(); } catch {}
      }
      this.clients.clear();

      this.wss.close(() => {
        this.wss = null;
        this.logger.info('WebSocket server stopped.');
        resolve();
      });
    });
  }
}

module.exports = WebSocketServer;
