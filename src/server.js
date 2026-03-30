/**
 * LiveFlow Pro - HTTP/HTTPS Server
 *
 * Serves static files with:
 *   - Gzip compression
 *   - Cache control headers
 *   - SPA fallback (index.html for unknown routes)
 *   - Automatic script injection for live-reload client
 *   - Security: directory traversal prevention
 *   - HTTPS support via self-signed certificates
 *   - CORS headers for LAN/mobile access
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { validatePath } = require('./utils/pathValidator');
const { generateCertificates } = require('./utils/certificates');
const { getLANAddress } = require('./utils/networkInfo');

// ─── MIME types ────────────────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ts': 'application/typescript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

// Extensions to gzip
const COMPRESSIBLE = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt', '.map']);

// ─── Server class ──────────────────────────────────────────────────────────
class Server {
  /**
   * @param {object} options
   * @param {string}  options.root         Absolute path to serve files from
   * @param {number}  options.port         Port number
   * @param {boolean} options.https        Enable HTTPS
   * @param {boolean} options.gzip         Enable gzip compression
   * @param {boolean} options.spaFallback  Serve index.html on 404
   * @param {string}  options.basePath     URL base path prefix
   * @param {boolean} options.liveReload   Inject live-reload client
   * @param {number}  options.wsPort       WebSocket port for client script
   * @param {object}  options.logger       Logger instance
   * @param {object}  options.context      VS Code extension context
   */
  constructor(options) {
    this.root = options.root;
    this.port = options.port;
    this.useHttps = options.https || false;
    this.useGzip = options.gzip !== false;
    this.spaFallback = options.spaFallback || false;
    this.basePath = options.basePath || '/';
    this.liveReload = options.liveReload !== false;
    this.wsPort = options.wsPort || 5501;
    this.logger = options.logger;
    this.context = options.context;
    this.httpServer = null;
    this._info = null;
  }

  /**
   * Start the server. Returns actual ports used.
   * @param {object} wsInstance WebSocket server instance
   * @returns {Promise<{httpPort: number, wsPort: number}>}
   */
  async start(wsInstance) {
    this.wsInstance = wsInstance;

    let serverOptions = {};
    if (this.useHttps) {
      this.logger.info('Generating self-signed certificate...');
      const { cert, key } = await generateCertificates();
      serverOptions = { cert, key };
    }

    // Load live-reload client script
    this._clientScript = this._buildClientScript();

    return new Promise((resolve, reject) => {
      const requestHandler = (req, res) => this._handleRequest(req, res);

      if (this.useHttps) {
        this.httpServer = https.createServer(serverOptions, requestHandler);
      } else {
        this.httpServer = http.createServer(requestHandler);
      }

      this.httpServer.on('error', (err) => {
        reject(err);
      });

      // Attach WebSocket server to same HTTP server
      if (wsInstance) {
        wsInstance.attachToServer(this.httpServer);
      }

      this.httpServer.listen(this.port, '0.0.0.0', () => {
        const addr = this.httpServer.address();
        const httpPort = addr.port;
        const proto = this.useHttps ? 'https' : 'http';
        const lanIP = getLANAddress();

        this._info = {
          port: httpPort,
          https: this.useHttps,
          root: this.root,
          spaFallback: this.spaFallback,
          basePath: this.basePath,
          localURL: `${proto}://localhost:${httpPort}${this.basePath}`,
          lanURL: lanIP ? `${proto}://${lanIP}:${httpPort}${this.basePath}` : null,
          lanIP,
          startTime: new Date().toISOString(),
        };

        this.logger.info(`HTTP server listening on port ${httpPort}`);
        resolve({ httpPort, wsPort: this.wsPort });
      });
    });
  }

  /**
   * Stop the HTTP server.
   */
  stop() {
    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.httpServer = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Return server info object for the dashboard.
   */
  getInfo() {
    return this._info;
  }

  // ─── Request handler ─────────────────────────────────────────────────────

  /**
   * Main HTTP request handler.
   */
  async _handleRequest(req, res) {
    // CORS headers (allow LAN access)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('X-Powered-By', 'LiveFlow Pro');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      this._sendError(res, 405, 'Method Not Allowed');
      return;
    }

    // Parse URL and strip base path
    let urlPath = req.url.split('?')[0]; // ignore query string
    try {
      urlPath = decodeURIComponent(urlPath);
    } catch {
      this._sendError(res, 400, 'Bad Request');
      return;
    }

    // Strip base path prefix
    if (this.basePath !== '/') {
      if (urlPath.startsWith(this.basePath)) {
        urlPath = urlPath.slice(this.basePath.length - 1) || '/';
      }
    }

    // Validate path to prevent traversal
    const resolvedPath = validatePath(this.root, urlPath);
    if (!resolvedPath) {
      this.logger.warn(`Blocked path traversal attempt: ${urlPath}`);
      this._sendError(res, 403, 'Forbidden');
      return;
    }

    await this._serveFile(req, res, resolvedPath, urlPath);
  }

  /**
   * Resolve and serve a file.
   */
  async _serveFile(req, res, filePath, urlPath) {
    let targetPath = filePath;

    // Check if path is a directory → try index.html
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        targetPath = path.join(targetPath, 'index.html');
      }
    } catch {
      // File does not exist — SPA fallback or 404
      if (this.spaFallback) {
        targetPath = path.join(this.root, 'index.html');
        this.logger.debug(`SPA fallback: ${urlPath} → index.html`);
      } else {
        this._send404(res, urlPath);
        return;
      }
    }

    // Check target file exists
    if (!fs.existsSync(targetPath)) {
      if (this.spaFallback) {
        targetPath = path.join(this.root, 'index.html');
      }
      if (!fs.existsSync(targetPath)) {
        this._send404(res, urlPath);
        return;
      }
    }

    // Extension and MIME type
    const ext = path.extname(targetPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHtml = ext === '.html' || ext === '.htm';
    const isCss = ext === '.css';
    const canCompress = this.useGzip && COMPRESSIBLE.has(ext);

    // Read file
    let content;
    try {
      content = fs.readFileSync(targetPath);
    } catch (err) {
      this.logger.error(`Error reading file: ${err.message}`);
      this._sendError(res, 500, 'Internal Server Error');
      return;
    }

    // Inject live-reload client into HTML
    if (isHtml && this.liveReload) {
      content = this._injectClientScript(content);
    }

    // Set headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Cache control: no-store in dev mode for HTML/CSS/JS, long for assets
    if (isHtml || isCss || ext === '.js') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    // Gzip
    const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip');
    if (canCompress && acceptsGzip) {
      res.setHeader('Content-Encoding', 'gzip');
      zlib.gzip(content, (err, compressed) => {
        if (err) {
          res.writeHead(200);
          res.end(content);
        } else {
          res.setHeader('Content-Length', compressed.length);
          res.writeHead(200);
          res.end(req.method === 'HEAD' ? undefined : compressed);
        }
      });
    } else {
      res.setHeader('Content-Length', content.length);
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? undefined : content);
    }

    this.logger.debug(`GET ${req.url} → 200`);
  }

  // ─── Script injection ─────────────────────────────────────────────────────

  /**
   * Inject live-reload client script before </body>.
   */
  _injectClientScript(htmlBuffer) {
    const html = htmlBuffer.toString('utf8');
    const script = `\n<script>\n${this._clientScript}\n</script>\n`;

    // Try to inject before </body>
    const bodyCloseIdx = html.lastIndexOf('</body>');
    if (bodyCloseIdx !== -1) {
      const injected = html.slice(0, bodyCloseIdx) + script + html.slice(bodyCloseIdx);
      return Buffer.from(injected, 'utf8');
    }

    // Append at end if no </body>
    return Buffer.from(html + script, 'utf8');
  }

  /**
   * Build the inline client script.
   * Connects via the same port as HTTP using path /__liveflow_ws__.
   */
  _buildClientScript() {
    const proto = this.useHttps ? 'wss' : 'ws';

    return `
/* LiveFlow Pro — Live Reload Client */
(function() {
  var protocol = '${proto}';
  var host = window.location.hostname;
  var port = window.location.port;
  var ws;
  var reconnectInterval = 1000;
  var maxReconnectInterval = 10000;

  function connect() {
    var wsURL = protocol + '://' + host + (port ? ':' + port : '') + '/__liveflow_ws__';
    ws = new WebSocket(wsURL);

    ws.addEventListener('open', function() {
      console.log('[LiveFlow Pro] Connected to live-reload server');
      reconnectInterval = 1000; // reset backoff
    });

    ws.addEventListener('message', function(event) {
      var data;
      try { data = JSON.parse(event.data); } catch(e) { return; }

      if (data.type === 'reload') {
        console.log('[LiveFlow Pro] Full reload triggered');
        window.location.reload();
      } else if (data.type === 'css') {
        console.log('[LiveFlow Pro] CSS hot-swap:', data.file);
        hotSwapCSS(data.file);
      } else if (data.type === 'error') {
        showErrorOverlay(data.message, data.stack);
      } else if (data.type === 'connected') {
        console.log('[LiveFlow Pro] Server:', data.message);
      }
    });

    ws.addEventListener('close', function() {
      console.log('[LiveFlow Pro] Disconnected — reconnecting in ' + (reconnectInterval/1000) + 's...');
      setTimeout(connect, reconnectInterval);
      reconnectInterval = Math.min(reconnectInterval * 1.5, maxReconnectInterval);
    });

    ws.addEventListener('error', function(err) {
      ws.close();
    });
  }

  // ── CSS hot-swap: replace stylesheet without full page reload ──
  function hotSwapCSS(file) {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    var found = false;
    links.forEach(function(link) {
      var href = link.href.split('?')[0];
      if (href.endsWith(file) || file.endsWith(href.replace(window.location.origin, ''))) {
        link.href = href + '?_lf=' + Date.now();
        found = true;
      }
    });
    if (!found) {
      // Reload all CSS if specific file not matched
      links.forEach(function(link) {
        var href = link.href.split('?')[0];
        link.href = href + '?_lf=' + Date.now();
      });
    }
  }

  // ── Error overlay ──
  function showErrorOverlay(message, stack) {
    removeErrorOverlay();
    var overlay = document.createElement('div');
    overlay.id = '__liveflow_error_overlay__';
    overlay.style.cssText = [
      'position:fixed','top:0','left:0','right:0','bottom:0',
      'background:rgba(10,10,10,0.96)','color:#ff6b6b',
      'font-family:monospace','font-size:14px',
      'padding:40px','z-index:99999','overflow:auto',
      'display:flex','flex-direction:column','gap:16px'
    ].join(';');

    var title = document.createElement('h2');
    title.style.cssText = 'color:#ff4757;margin:0;font-size:20px;';
    title.textContent = '⚡ LiveFlow Pro — Build Error';

    var msg = document.createElement('pre');
    msg.style.cssText = 'color:#ffa502;white-space:pre-wrap;margin:0;';
    msg.textContent = message || 'Unknown error';

    var stackEl = document.createElement('pre');
    stackEl.style.cssText = 'color:#747d8c;white-space:pre-wrap;margin:0;font-size:12px;';
    stackEl.textContent = stack || '';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Dismiss';
    closeBtn.style.cssText = [
      'align-self:flex-start','padding:8px 16px','background:#ff4757',
      'color:#fff','border:none','border-radius:4px','cursor:pointer',
      'font-size:14px','font-family:monospace'
    ].join(';');
    closeBtn.onclick = removeErrorOverlay;

    overlay.appendChild(title);
    overlay.appendChild(msg);
    overlay.appendChild(stackEl);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
  }

  function removeErrorOverlay() {
    var el = document.getElementById('__liveflow_error_overlay__');
    if (el) el.remove();
  }

  connect();
})();
`.trim();
  }

  // ─── Error responses ──────────────────────────────────────────────────────

  _send404(res, urlPath) {
    this.logger.debug(`GET ${urlPath} → 404`);
    const body = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>404 Not Found — LiveFlow Pro</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d0d0d; color: #e0e0e0;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { text-align: center; padding: 60px 40px; }
  .code { font-size: 120px; font-weight: 900; color: #2563eb; line-height: 1; }
  h1 { font-size: 28px; margin: 16px 0 8px; }
  p { color: #6b7280; font-size: 16px; }
  .path { font-family: monospace; background: #1f1f1f; padding: 6px 12px; border-radius: 6px;
          display: inline-block; margin: 12px 0; color: #60a5fa; }
  a { color: #2563eb; text-decoration: none; margin-top: 24px; display: inline-block; }
  a:hover { text-decoration: underline; }
  .badge { font-size: 12px; color: #374151; margin-top: 40px; }
</style>
</head>
<body>
  <div class="card">
    <div class="code">404</div>
    <h1>File Not Found</h1>
    <div class="path">${urlPath}</div>
    <p>This file doesn't exist in the project root.</p>
    <a href="/">← Back to home</a>
    <div class="badge">Served by LiveFlow Pro</div>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(404);
    res.end(body);
  }

  _sendError(res, code, message) {
    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(code);
    res.end(message);
  }
}

module.exports = Server;
