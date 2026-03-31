/**
 * Live Server Pro - Extension Entry Point
 *
 * Matches the behaviour of popular Live Server extensions:
 *   • "Go Live" opens the currently active HTML file directly
 *   • Right-click any file in explorer/editor → "Open with Live Server Pro"
 *   • Server already running → navigates to the requested file's URL
 *   • Status bar port button acts as a toggle (click to stop)
 *   • Supports CSS hot-swap, WebSocket reload, directory listing, HTTPS, QR
 */

'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

const Server          = require('./server');
const Watcher         = require('./watcher');
const WebSocketServer = require('./websocket');
const { generateQRCode } = require('./qrcode');
const DashboardPanel  = require('./dashboard');
const Logger          = require('./utils/logger');
const { findAvailablePort } = require('./utils/portFinder');
const { getLANAddress }     = require('./utils/networkInfo');

// ─── Module-level state ─────────────────────────────────────────────────────
let serverInstance  = null;
let watcherInstance = null;
let wsInstance      = null;
let logger          = null;

// Status bar items
let sbGoLive    = null;   // "Go Live" / "Port :5500" toggle
let sbQR        = null;   // QR code (visible while running)
let sbDashboard = null;   // Dashboard (visible while running)

// Server runtime info
let _currentPort    = null;
let _currentHttps   = false;
let _currentLanURL  = null;
let _serveRoot      = null;   // absolute path being served
let _basePath       = '/';

// ─── Activate ───────────────────────────────────────────────────────────────
/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  logger = new Logger('Live Server Pro');
  logger.info('Live Server Pro activated.');

  // ── Status bar ────────────────────────────────────────────────────────────
  sbGoLive = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  sbGoLive.text    = '$(broadcast) Go Live';
  sbGoLive.command = 'liveflow.toggle';
  sbGoLive.tooltip = 'Live Server Pro: Click to start the live server';
  sbGoLive.color   = '#ffffff';
  sbGoLive.show();

  sbQR = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999);
  sbQR.command  = 'liveflow.showQR';
  sbQR.text     = '$(qr)';
  sbQR.tooltip  = 'Live Server Pro: Show QR code for mobile access';
  sbQR.color    = '#a8e063';

  sbDashboard = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 998);
  sbDashboard.command = 'liveflow.openDashboard';
  sbDashboard.text    = '$(dashboard)';
  sbDashboard.tooltip = 'Live Server Pro: Open dashboard';
  sbDashboard.color   = '#61dafb';

  updateStatusBar('idle');
  context.subscriptions.push(sbGoLive, sbQR, sbDashboard);

  // ── Commands ──────────────────────────────────────────────────────────────
  context.subscriptions.push(

    // Toggle: starts server (opening active file) or stops it
    vscode.commands.registerCommand('liveflow.toggle', () => {
      if (serverInstance) {
        stopServer();
      } else {
        const activeFile = getActiveFilePath();
        startServer(context, activeFile);
      }
    }),

    // Explicit start (used by editor/context menus — receives URI arg)
    vscode.commands.registerCommand('liveflow.start', (uri) => {
      const filePath = uri ? uri.fsPath : getActiveFilePath();
      if (serverInstance) {
        // Server already running → just navigate to the file
        const fileURL = buildFileURL(filePath);
        const browser = vscode.workspace.getConfiguration('liveflow').get('browser') || '';
        openBrowser(fileURL, browser);
      } else {
        startServer(context, filePath);
      }
    }),

    // Open current/active file in the running server (or start + open)
    vscode.commands.registerCommand('liveflow.openFile', (uri) => {
      const filePath = uri ? uri.fsPath : getActiveFilePath();
      if (serverInstance) {
        const fileURL = buildFileURL(filePath);
        const browser = vscode.workspace.getConfiguration('liveflow').get('browser') || '';
        openBrowser(fileURL, browser);
      } else {
        startServer(context, filePath);
      }
    }),

    vscode.commands.registerCommand('liveflow.stop',          () => stopServer()),
    vscode.commands.registerCommand('liveflow.restart',       () => restartServer(context)),
    vscode.commands.registerCommand('liveflow.openDashboard', () =>
      DashboardPanel.createOrShow(context, getServerInfo())
    ),
    vscode.commands.registerCommand('liveflow.showQR',    () => showQRPanel(context)),
    vscode.commands.registerCommand('liveflow.statusMenu', () => showStatusMenu(context))
  );

  // ── Real-time Update on Type ────────────────────────────────────────────────
  let typeTimeout;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const config = vscode.workspace.getConfiguration('liveflow');
      if (!config.get('liveReload')) return;
      
      const doc = e.document;
      if (wsInstance && doc.languageId === 'html') {
        clearTimeout(typeTimeout);
        typeTimeout = setTimeout(() => {
          wsInstance.sendHTMLUpdate(doc.getText());
        }, 50);
      }
    })
  );

  logger.info('Commands registered.');
}

// ─── Core: Start Server ──────────────────────────────────────────────────────
/**
 * Start the live server, then open targetFilePath (or root) in the browser.
 *
 * @param {vscode.ExtensionContext} context
 * @param {string|null} targetFilePath  Absolute file path to open after start
 */
async function startServer(context, targetFilePath) {
  if (serverInstance) {
    // Already running — just navigate to the requested file
    const fileURL = buildFileURL(targetFilePath);
    const browser = vscode.workspace.getConfiguration('liveflow').get('browser') || '';
    openBrowser(fileURL, browser);
    return;
  }

  const config            = vscode.workspace.getConfiguration('liveflow');
  const workspaceFolders  = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'Live Server Pro: No workspace folder open. Please open a folder first.'
    );
    return;
  }

  // ── Determine serve root ─────────────────────────────────────────────────
  const rootPathSetting = config.get('rootPath') || '';
  const workspaceRoot   = workspaceFolders[0].uri.fsPath;
  _serveRoot = rootPathSetting
    ? path.join(workspaceRoot, rootPathSetting)
    : workspaceRoot;

  // ── Port ─────────────────────────────────────────────────────────────────
  const preferredPort = config.get('port') || 5500;
  let port;
  try {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      logger.warn(`Port ${preferredPort} in use — using ${port}.`);
      vscode.window.showInformationMessage(
        `Live Server Pro: Port ${preferredPort} in use, using ${port}.`
      );
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Live Server Pro: Could not find available port — ${err.message}`);
    return;
  }

  // ── Options ──────────────────────────────────────────────────────────────
  const useHttps     = config.get('https')        || false;
  const useGzip      = config.get('gzip')         !== false;
  const spaFallback  = config.get('spaFallback')  || false;
  const liveReload   = config.get('liveReload')   !== false;
  const debounceMs   = config.get('debounceDelay')|| 200;
  const showQR       = config.get('showQRCode')   !== false;
  const autoOpen     = config.get('autoOpen')     !== false;
  const browser      = config.get('browser')      || '';
  _basePath          = config.get('basePath')     || '/';

  try {
    updateStatusBar('starting');

    // 1. WebSocket server
    wsInstance = new WebSocketServer({ logger });

    // 2. HTTP server
    serverInstance = new Server({
      root: _serveRoot,
      port,
      https:      useHttps,
      gzip:       useGzip,
      spaFallback,
      basePath:   _basePath,
      liveReload,
      wsPort:     wsInstance.getPort(),
      logger,
      context,
    });

    // 3. Start both
    const { httpPort } = await serverInstance.start(wsInstance);

    // 4. File watcher
    if (liveReload) {
      watcherInstance = new Watcher({
        root:     _serveRoot,
        debounce: debounceMs,
        onCSSChange:  (fp) => { logger.info(`CSS: ${path.basename(fp)}`);     wsInstance.sendCSSReload(fp); },
        onFullReload: (fp) => { logger.info(`Changed: ${path.basename(fp)}`); wsInstance.sendFullReload();  },
        logger,
      });
      watcherInstance.start();
    }

    // 5. Compute URLs
    const proto    = useHttps ? 'https' : 'http';
    const lanIP    = getLANAddress();
    const rootURL  = `${proto}://localhost:${httpPort}${_basePath}`;
    const lanURL   = lanIP ? `${proto}://${lanIP}:${httpPort}${_basePath}` : null;

    _currentPort   = httpPort;
    _currentHttps  = useHttps;
    _currentLanURL = lanURL;
    _serveRoot     = _serveRoot;   // already set

    updateStatusBar('running', httpPort, useHttps);

    logger.info(`Server at: ${rootURL}`);
    if (lanURL) logger.info(`LAN: ${lanURL}`);

    // 6. Determine the URL to open (active file or root)
    const openURL = buildFileURL(targetFilePath) || rootURL;

    // 7. Notification with actions
    vscode.window.showInformationMessage(
      `⚡ Live Server Pro running at ${openURL}`,
      'Open Browser', 'QR Code', 'Dashboard'
    ).then((sel) => {
      if (sel === 'Open Browser') openBrowser(openURL, browser);
      if (sel === 'QR Code')     showQRPanel(context);
      if (sel === 'Dashboard')   DashboardPanel.createOrShow(context, getServerInfo());
    });

    // 8. Auto-open
    if (autoOpen) {
      setTimeout(() => openBrowser(openURL, browser), 500);
    }

    // 9. QR code panel
    if (showQR && lanURL) {
      showQRPanel(context);
    }

  } catch (err) {
    logger.error(`Failed to start: ${err.message}`);
    vscode.window.showErrorMessage(`Live Server Pro: Failed to start — ${err.message}`);
    await cleanupInstances();
    updateStatusBar('idle');
  }
}

// ─── Core: Stop Server ───────────────────────────────────────────────────────
async function stopServer() {
  if (!serverInstance) {
    vscode.window.showWarningMessage('Live Server Pro: No server is running.');
    return;
  }
  try {
    await cleanupInstances();
    _currentPort   = null;
    _currentHttps  = false;
    _currentLanURL = null;
    updateStatusBar('idle');
    logger.info('Server stopped.');
    vscode.window.showInformationMessage('Live Server Pro: Server stopped.');
  } catch (err) {
    logger.error(`Stop error: ${err.message}`);
  }
}

// ─── Core: Restart ──────────────────────────────────────────────────────────
async function restartServer(context) {
  logger.info('Restarting...');
  await stopServer();
  await new Promise(r => setTimeout(r, 500));
  const activeFile = getActiveFilePath();
  await startServer(context, activeFile);
}

// ─── URL Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the absolute fs path of the currently active editor file,
 * if it's inside the workspace (and optionally is an HTML file).
 * Returns null if no suitable active file.
 */
function getActiveFilePath() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  const filePath = editor.document.uri.fsPath;

  // Only serve files that are within the workspace
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return null;
  const inWorkspace = folders.some(f => filePath.startsWith(f.uri.fsPath));
  if (!inWorkspace) return null;

  return filePath;
}

/**
 * Given an absolute file path, compute the URL to open in the browser.
 * Returns null if the file is outside the serve root or server is not running.
 *
 * e.g.  /project/pages/about.html  →  http://localhost:5500/pages/about.html
 */
function buildFileURL(filePath, useLAN = false) {
  if (!filePath || !_currentPort || !_serveRoot) return null;

  // Normalise separators
  const normalRoot = _serveRoot.replace(/\\/g, '/');
  const normalFile = filePath.replace(/\\/g, '/');

  if (!normalFile.startsWith(normalRoot)) return null;

  const proto       = _currentHttps ? 'https' : 'http';
  let relativePath  = normalFile.slice(normalRoot.length);

  // Ensure leading slash
  if (!relativePath.startsWith('/')) relativePath = '/' + relativePath;

  // Strip basePath duplication if needed
  const base = _basePath === '/' ? '' : _basePath.replace(/\/$/, '');
  
  // Use LAN IP if requested, else localhost
  let host = 'localhost';
  if (useLAN && _currentLanURL) {
    const match = _currentLanURL.match(/:\/\/([^:/]+)/);
    if (match) host = match[1];
  }

  return `${proto}://${host}:${_currentPort}${base}${relativePath}`;
}

// ─── Browser opener ──────────────────────────────────────────────────────────
function openBrowser(url, browser) {
  if (!url) return;
  const { exec } = require('child_process');
  const platform  = process.platform;
  let cmd;

  if (browser) {
    cmd = `"${browser}" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => { if (err) logger.warn(`Browser open failed: ${err.message}`); });
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanupInstances() {
  if (watcherInstance) { await watcherInstance.stop(); watcherInstance = null; }
  if (wsInstance)      { await wsInstance.stop();      wsInstance      = null; }
  if (serverInstance)  { await serverInstance.stop();  serverInstance  = null; }
}

function getServerInfo() {
  return serverInstance ? serverInstance.getInfo() : null;
}

// ─── Status bar ──────────────────────────────────────────────────────────────
/**
 * @param {'idle'|'starting'|'running'} state
 */
function updateStatusBar(state, port, https) {
  if (!sbGoLive) return;

  switch (state) {
    case 'idle':
      sbGoLive.text    = '$(broadcast) Go Live';
      sbGoLive.tooltip = 'Live Server Pro: Click to start the live server';
      sbGoLive.color   = '#ffffff';
      sbGoLive.backgroundColor = undefined;
      sbGoLive.show();   // always ensure visible
      sbQR.hide();
      sbDashboard.hide();
      break;

    case 'starting':
      sbGoLive.text    = '$(sync~spin) Starting...';
      sbGoLive.tooltip = 'Live Server Pro is starting...';
      sbGoLive.color   = '#ffd700';
      sbGoLive.backgroundColor = undefined;
      sbQR.hide();
      sbDashboard.hide();
      break;

    case 'running': {
      const proto = https ? 'https' : 'http';
      sbGoLive.text    = `$(radio-tower) Port :${port}`;
      sbGoLive.tooltip = `Live Server Pro running at ${proto}://localhost:${port}\nClick to stop server`;
      sbGoLive.color   = '#a8e063';
      sbGoLive.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      sbDashboard.show();
      sbQR.show();
      break;
    }
  }
}

// ─── Status quick-pick menu ───────────────────────────────────────────────────
async function showStatusMenu(context) {
  const proto    = _currentHttps ? 'https' : 'http';
  const rootURL  = _currentPort  ? `${proto}://localhost:${_currentPort}${_basePath}` : '';
  const activeFileURL = buildFileURL(getActiveFilePath());
  const browser  = vscode.workspace.getConfiguration('liveflow').get('browser') || '';

  const items = [
    activeFileURL && activeFileURL !== rootURL ? {
      label: '$(file-code) Open Current File',
      description: activeFileURL,
      action: () => openBrowser(activeFileURL, browser)
    } : null,
    {
      label: '$(globe) Open Root in Browser',
      description: rootURL,
      action: () => openBrowser(rootURL, browser)
    },
    {
      label: '$(qr) Show QR Code',
      description: _currentLanURL || 'No LAN address found',
      action: () => showQRPanel(context)
    },
    {
      label: '$(dashboard) Open Dashboard',
      description: 'Stats & live file activity',
      action: () => DashboardPanel.createOrShow(context, getServerInfo())
    },
    {
      label: '$(refresh) Restart Server',
      description: '',
      action: () => restartServer(context)
    },
    {
      label: '$(stop-circle) Stop Server',
      description: '',
      action: () => stopServer()
    }
  ].filter(Boolean);

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Live Server Pro  •  ${rootURL}`,
    title: '⚡ Live Server Pro — Server Options'
  });

  if (picked) picked.action();
}

// ─── QR Panel ────────────────────────────────────────────────────────────────
function showQRPanel(context) {
  // Get LAN URL for the active file, or fallback to the root LAN URL
  let url = buildFileURL(getActiveFilePath(), true);
  if (!url) url = _currentLanURL;

  if (!url) {
    vscode.window.showWarningMessage(
      'Live Server Pro: No LAN address detected. Make sure you are on a network.'
    );
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'liveflowQR', '📱 Live Server Pro — QR Code',
    vscode.ViewColumn.Beside, { enableScripts: true }
  );

  const encodedURL = encodeURIComponent(url);
  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Code</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 100vh;
      background: #1e1e2e;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #cdd6f4; gap: 20px; padding: 32px;
    }
    h2 { font-size: 1.1rem; font-weight: 600; letter-spacing: 0.04em; color: #a8e063; }
    .qr-wrapper {
      background: #fff; border-radius: 16px; padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); text-align: center;
    }
    .qr-wrapper img { display: block; width: 220px; height: 220px; margin: 0 auto; }
    .url-badge {
      background: #313244; border: 1px solid #45475a; border-radius: 8px;
      padding: 10px 18px; font-size: 0.85rem; color: #89dceb;
      word-break: break-all; text-align: center; max-width: 380px;
    }
    .hint { font-size: 0.8rem; color: #bac2de; text-align: center; max-width: 380px; line-height: 1.4; }
    .alert { background: rgba(243, 139, 168, 0.1); border: 1px solid #f38ba8; padding: 12px; border-radius: 8px; color: #f38ba8; font-size: 0.8rem; text-align: left; max-width: 380px; }
    .alert strong { display: block; margin-bottom: 4px; }
  </style>
</head>
<body>
  <h2>📱 Scan to open on mobile</h2>
  <div class="qr-wrapper">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodedURL}" 
         onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#333\\'>Image failed to load.<br>API blocked by firewall.</span>';" 
         alt="QR Code">
  </div>
  <div class="url-badge">${url}</div>
  <p class="hint">Ensure your mobile device and PC are physically on the <b>same Wi-Fi network</b>.</p>
  
  <div class="alert">
    <strong>⚠️ Still not loading on your phone?</strong>
    Windows Defender Firewall blocks Node.js incoming connections by default.<br><br>
    <b>Fix:</b> Go to Windows Start &rarr; "Allow an app through Windows Firewall" &rarr; check both Private & Public for <b>Node.js JavaScript Runtime</b>.
  </div>
</body>
</html>`;
}

// ─── Deactivate ──────────────────────────────────────────────────────────────
async function deactivate() {
  await cleanupInstances();
  if (logger) logger.info('Live Server Pro deactivated.');
}

module.exports = { activate, deactivate };
