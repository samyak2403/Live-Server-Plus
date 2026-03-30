/**
 * LiveFlow Pro - Extension Entry Point
 *
 * Registers all commands, manages status bar, coordinates between
 * the server, watcher, and WebSocket modules.
 */

'use strict';

const vscode = require('vscode');
const path = require('path');
const Server = require('./server');
const Watcher = require('./watcher');
const WebSocketServer = require('./websocket');
const { generateQRCode } = require('./qrcode');
const DashboardPanel = require('./dashboard');
const Logger = require('./utils/logger');
const { findAvailablePort } = require('./utils/portFinder');
const { getLANAddress } = require('./utils/networkInfo');

// ─── Module-level state ────────────────────────────────────────────────────
let serverInstance = null;
let watcherInstance = null;
let wsInstance = null;
let statusBarItem = null;
let logger = null;

// ─── Activate ──────────────────────────────────────────────────────────────
/**
 * Called when the extension is activated.
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  logger = new Logger('LiveFlow Pro');
  logger.info('LiveFlow Pro extension activated.');

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'liveflow.start';
  updateStatusBar('idle');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('liveflow.start', () => startServer(context)),
    vscode.commands.registerCommand('liveflow.stop', () => stopServer()),
    vscode.commands.registerCommand('liveflow.restart', () => restartServer(context)),
    vscode.commands.registerCommand('liveflow.openDashboard', () =>
      DashboardPanel.createOrShow(context, getServerInfo())
    )
  );

  logger.info('Commands registered. Use "LiveFlow Pro: Start Server" to begin.');
}

// ─── Commands ──────────────────────────────────────────────────────────────

/**
 * Start the development server.
 * @param {vscode.ExtensionContext} context
 */
async function startServer(context) {
  if (serverInstance) {
    vscode.window.showWarningMessage('LiveFlow Pro: Server is already running.');
    return;
  }

  const config = vscode.workspace.getConfiguration('liveflow');
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'LiveFlow Pro: No workspace folder is open. Please open a folder first.'
    );
    return;
  }

  // Determine root path
  const rootPath = config.get('rootPath') || '';
  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const serveRoot = rootPath
    ? path.join(workspaceRoot, rootPath)
    : workspaceRoot;

  // Resolve port
  const preferredPort = config.get('port') || 5500;
  let port;
  try {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      logger.warn(`Port ${preferredPort} was in use. Using port ${port} instead.`);
      vscode.window.showInformationMessage(
        `LiveFlow Pro: Port ${preferredPort} in use, using ${port}.`
      );
    }
  } catch (err) {
    vscode.window.showErrorMessage(`LiveFlow Pro: Could not find available port: ${err.message}`);
    return;
  }

  const useHttps = config.get('https') || false;
  const useGzip = config.get('gzip') !== false;
  const spaFallback = config.get('spaFallback') || false;
  const basePath = config.get('basePath') || '/';
  const liveReload = config.get('liveReload') !== false;
  const debounceDelay = config.get('debounceDelay') || 200;
  const showQR = config.get('showQRCode') !== false;
  const autoOpen = config.get('autoOpen') !== false;
  const browser = config.get('browser') || '';

  try {
    updateStatusBar('starting');

    // 1. Create WebSocket server (live reload hub)
    wsInstance = new WebSocketServer({ logger });

    // 2. Create HTTP server
    serverInstance = new Server({
      root: serveRoot,
      port,
      https: useHttps,
      gzip: useGzip,
      spaFallback,
      basePath,
      liveReload,
      wsPort: wsInstance.getPort(),
      logger,
      context,
    });

    // 3. Start both
    const { httpPort, wsPort } = await serverInstance.start(wsInstance);

    // 4. Start file watcher (only if live reload is on)
    if (liveReload) {
      watcherInstance = new Watcher({
        root: serveRoot,
        debounce: debounceDelay,
        onCSSChange: (filePath) => {
          logger.info(`CSS change: ${path.basename(filePath)}`);
          wsInstance.sendCSSReload(filePath);
        },
        onFullReload: (filePath) => {
          logger.info(`File change: ${path.basename(filePath)} — full reload`);
          wsInstance.sendFullReload();
        },
        logger,
      });
      watcherInstance.start();
    }

    // 5. Update UI
    updateStatusBar('running', httpPort, useHttps);
    statusBarItem.command = 'liveflow.stop';

    // 6. Show server info
    const protocol = useHttps ? 'https' : 'http';
    const lanIP = getLANAddress();
    const localURL = `${protocol}://localhost:${httpPort}${basePath}`;
    const lanURL = lanIP ? `${protocol}://${lanIP}:${httpPort}${basePath}` : null;

    logger.info(`Server started at: ${localURL}`);
    if (lanURL) logger.info(`LAN access: ${lanURL}`);

    vscode.window.showInformationMessage(
      `🚀 LiveFlow Pro running at ${localURL}`,
      'Open Browser',
      'Show Dashboard'
    ).then((selection) => {
      if (selection === 'Open Browser') openBrowser(localURL, browser);
      if (selection === 'Show Dashboard') DashboardPanel.createOrShow(context, getServerInfo());
    });

    // 7. Auto-open browser
    if (autoOpen) {
      setTimeout(() => openBrowser(localURL, browser), 500);
    }

    // 8. Show QR code
    if (showQR && lanURL) {
      await generateQRCode(lanURL, logger);
    }

  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    vscode.window.showErrorMessage(`LiveFlow Pro: Failed to start server — ${err.message}`);
    await cleanupInstances();
    updateStatusBar('idle');
  }
}

/**
 * Stop the development server.
 */
async function stopServer() {
  if (!serverInstance) {
    vscode.window.showWarningMessage('LiveFlow Pro: No server is running.');
    return;
  }

  try {
    await cleanupInstances();
    updateStatusBar('idle');
    statusBarItem.command = 'liveflow.start';
    logger.info('Server stopped.');
    vscode.window.showInformationMessage('LiveFlow Pro: Server stopped.');
  } catch (err) {
    logger.error(`Error stopping server: ${err.message}`);
  }
}

/**
 * Restart the development server.
 * @param {vscode.ExtensionContext} context
 */
async function restartServer(context) {
  logger.info('Restarting server...');
  await stopServer();
  // Brief pause to allow ports to free up
  await new Promise((resolve) => setTimeout(resolve, 500));
  await startServer(context);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Open a URL in the configured or system default browser.
 * @param {string} url
 * @param {string} browser
 */
function openBrowser(url, browser) {
  const { exec } = require('child_process');
  const platform = process.platform;
  let cmd;

  if (browser) {
    cmd = `${browser} "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => {
    if (err) logger.warn(`Could not open browser: ${err.message}`);
  });
}

/**
 * Tear down all active instances.
 */
async function cleanupInstances() {
  if (watcherInstance) {
    await watcherInstance.stop();
    watcherInstance = null;
  }
  if (serverInstance) {
    await serverInstance.stop();
    serverInstance = null;
  }
  if (wsInstance) {
    await wsInstance.stop();
    wsInstance = null;
  }
}

/**
 * Get current server info for the dashboard.
 * @returns {object}
 */
function getServerInfo() {
  if (!serverInstance) return null;
  return serverInstance.getInfo();
}

/**
 * Update the status bar item appearance.
 * @param {'idle'|'starting'|'running'} state
 * @param {number} [port]
 * @param {boolean} [https]
 */
function updateStatusBar(state, port, https) {
  if (!statusBarItem) return;

  switch (state) {
    case 'idle':
      statusBarItem.text = '$(broadcast) LiveFlow';
      statusBarItem.tooltip = 'Click to start LiveFlow Pro server';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.color = undefined;
      break;
    case 'starting':
      statusBarItem.text = '$(sync~spin) LiveFlow: Starting...';
      statusBarItem.tooltip = 'LiveFlow Pro is starting...';
      break;
    case 'running':
      const proto = https ? 'https' : 'http';
      statusBarItem.text = `$(radio-tower) LiveFlow :${port}`;
      statusBarItem.tooltip = `LiveFlow Pro running at ${proto}://localhost:${port}\nClick to stop`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.activeBackground');
      statusBarItem.command = 'liveflow.stop';
      break;
  }
}

// ─── Deactivate ────────────────────────────────────────────────────────────
/**
 * Called when the extension is deactivated.
 */
async function deactivate() {
  await cleanupInstances();
  if (logger) logger.info('LiveFlow Pro deactivated.');
}

module.exports = { activate, deactivate };
