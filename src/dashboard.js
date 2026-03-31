/**
 * Live Server Pro - Dashboard WebView Panel
 *
 * Creates a VS Code WebviewPanel that shows a rich,
 * interactive dashboard with server information, connection
 * status, and live metrics.
 */

'use strict';

const vscode = require('vscode');

class DashboardPanel {
  static currentPanel = null;
  static viewType = 'Live Server ProDashboard';

  /**
   * Create or show the dashboard panel.
   * @param {vscode.ExtensionContext} context
   * @param {object|null} serverInfo Current server info
   */
  static createOrShow(context, serverInfo) {
    const column = vscode.ViewColumn.Beside;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      DashboardPanel.currentPanel.updateServerInfo(serverInfo);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'Live Server Pro — Dashboard',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, context, serverInfo);
  }

  /**
   * @param {vscode.WebviewPanel} panel
   * @param {vscode.ExtensionContext} context
   * @param {object|null} serverInfo
   */
  constructor(panel, context, serverInfo) {
    this._panel = panel;
    this._context = context;
    this._serverInfo = serverInfo;
    this._disposables = [];

    this._panel.webview.html = this._getHtml(serverInfo);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'start':
            vscode.commands.executeCommand('liveflow.start');
            break;
          case 'stop':
            vscode.commands.executeCommand('liveflow.stop');
            break;
          case 'restart':
            vscode.commands.executeCommand('liveflow.restart');
            break;
          case 'openBrowser':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
          case 'copyURL':
            vscode.env.clipboard.writeText(message.url);
            vscode.window.showInformationMessage('URL copied to clipboard!');
            break;
        }
      },
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Update the dashboard with new server info.
   * @param {object|null} info
   */
  updateServerInfo(info) {
    this._serverInfo = info;
    this._panel.webview.postMessage({ type: 'serverUpdate', data: info });
  }

  dispose() {
    DashboardPanel.currentPanel = null;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }

  // ─── HTML ──────────────────────────────────────────────────────────────

  _getHtml(serverInfo) {
    const isRunning = !!serverInfo;
    const localURL = serverInfo?.localURL || '';
    const lanURL = serverInfo?.lanURL || '';
    const port = serverInfo?.port || '—';
    const proto = serverInfo?.https ? 'HTTPS' : 'HTTP';
    const root = serverInfo?.root || 'Not started';
    const startTime = serverInfo?.startTime
      ? new Date(serverInfo.startTime).toLocaleTimeString()
      : '—';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Server Pro Dashboard</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    :root {
      --bg: #0a0a0f;
      --surface: #12121a;
      --surface2: #1a1a27;
      --border: #2a2a3d;
      --accent: #4f6ef7;
      --accent2: #7c3aed;
      --success: #22c55e;
      --danger: #ef4444;
      --warning: #f59e0b;
      --text: #e2e8f0;
      --muted: #64748b;
      --radius: 12px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
      line-height: 1.5;
    }

    h1 {
      font-size: 22px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 4px;
    }

    .subtitle { color: var(--muted); font-size: 13px; }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
    }

    .status-badge.running {
      background: rgba(34,197,94,0.12);
      color: var(--success);
      border: 1px solid rgba(34,197,94,0.3);
    }

    .status-badge.stopped {
      background: rgba(100,116,139,0.12);
      color: var(--muted);
      border: 1px solid rgba(100,116,139,0.3);
    }

    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .dot.pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      transition: border-color 0.2s, transform 0.2s;
    }

    .card:hover {
      border-color: var(--accent);
      transform: translateY(-1px);
    }

    .card-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .card-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .card-value.accent { color: var(--accent); }
    .card-value.success { color: var(--success); }
    .card-value.mono { font-family: monospace; font-size: 13px; word-break: break-all; }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 16px;
    }

    .url-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--surface2);
      border-radius: 8px;
      margin-bottom: 10px;
    }

    .url-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      min-width: 40px;
    }

    .url-value {
      flex: 1;
      font-family: monospace;
      font-size: 13px;
      color: var(--accent);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

    button {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      transition: opacity 0.15s, transform 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    button:hover { opacity: 0.85; transform: translateY(-1px); }
    button:active { transform: translateY(0); }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff;
    }

    .btn-danger {
      background: rgba(239,68,68,0.15);
      color: var(--danger);
      border: 1px solid rgba(239,68,68,0.3);
    }

    .btn-ghost {
      background: var(--surface2);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-sm {
      padding: 6px 10px;
      font-size: 12px;
      border-radius: 6px;
    }

    .actions {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 20px;
    }

    .footer {
      text-align: center;
      color: var(--muted);
      font-size: 12px;
      margin-top: 32px;
    }

    .logo-icon {
      font-size: 32px;
      line-height: 1;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-icon">⚡</div>
      <h1>Live Server Pro</h1>
      <div class="subtitle">Development Server Dashboard</div>
    </div>
    <div id="statusBadge" class="${isRunning ? 'status-badge running' : 'status-badge stopped'}">
      <div class="dot ${isRunning ? 'pulse' : ''}"></div>
      <span id="statusText">${isRunning ? 'Running' : 'Stopped'}</span>
    </div>
  </div>

  <!-- Stats grid -->
  <div class="grid">
    <div class="card">
      <div class="card-label">Port</div>
      <div class="card-value accent" id="portVal">${port}</div>
    </div>
    <div class="card">
      <div class="card-label">Protocol</div>
      <div class="card-value" id="protoVal">${proto}</div>
    </div>
    <div class="card">
      <div class="card-label">Started At</div>
      <div class="card-value" id="startTimeVal" style="font-size:16px">${startTime}</div>
    </div>
    <div class="card">
      <div class="card-label">SPA Mode</div>
      <div class="card-value ${serverInfo?.spaFallback ? 'success' : ''}" id="spaVal">
        ${serverInfo?.spaFallback ? '✓ On' : '— Off'}
      </div>
    </div>
  </div>

  <!-- URLs -->
  <div class="section">
    <div class="section-title">🌐 Server URLs</div>
    <div class="url-row">
      <span class="url-label">Local</span>
      <span class="url-value" id="localURL">${localURL || 'Not running'}</span>
      ${localURL ? `
        <button class="btn-ghost btn-sm" onclick="openBrowser('${localURL}')">Open</button>
        <button class="btn-ghost btn-sm" onclick="copyURL('${localURL}')">Copy</button>
      ` : ''}
    </div>
    <div class="url-row">
      <span class="url-label">LAN</span>
      <span class="url-value" id="lanURL">${lanURL || 'Not available'}</span>
      ${lanURL ? `
        <button class="btn-ghost btn-sm" onclick="copyURL('${lanURL}')">Copy</button>
      ` : ''}
    </div>
  </div>

  <!-- Root path -->
  <div class="section">
    <div class="section-title">📁 Serving From</div>
    <div class="card-value mono" id="rootPath">${root}</div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <div class="section-title">⚙️ Controls</div>
    <div class="btn-row">
      <button class="btn-primary" onclick="sendCommand('start')">▶ Start Server</button>
      <button class="btn-danger" onclick="sendCommand('stop')">■ Stop Server</button>
      <button class="btn-ghost" onclick="sendCommand('restart')">↺ Restart</button>
    </div>
  </div>

  <div class="footer">Live Server Pro v1.0.0 — Built for developers who care about speed ⚡</div>

  <script>
    const vscode = acquireVsCodeApi();

    function sendCommand(cmd) {
      vscode.postMessage({ command: cmd });
    }

    function openBrowser(url) {
      vscode.postMessage({ command: 'openBrowser', url });
    }

    function copyURL(url) {
      vscode.postMessage({ command: 'copyURL', url });
    }

    // Handle server updates pushed from extension
    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (msg.type === 'serverUpdate') {
        const info = msg.data;
        const running = !!info;

        document.getElementById('statusBadge').className = running ? 'status-badge running' : 'status-badge stopped';
        document.getElementById('statusText').textContent = running ? 'Running' : 'Stopped';
        document.querySelector('.dot').className = 'dot' + (running ? ' pulse' : '');

        document.getElementById('portVal').textContent = info?.port || '—';
        document.getElementById('protoVal').textContent = info?.https ? 'HTTPS' : 'HTTP';
        document.getElementById('startTimeVal').textContent = info?.startTime ? new Date(info.startTime).toLocaleTimeString() : '—';
        document.getElementById('localURL').textContent = info?.localURL || 'Not running';
        document.getElementById('lanURL').textContent = info?.lanURL || 'Not available';
        document.getElementById('rootPath').textContent = info?.root || 'Not started';
        document.getElementById('spaVal').textContent = info?.spaFallback ? '✓ On' : '— Off';
      }
    });
  </script>
</body>
</html>`;
  }
}

module.exports = DashboardPanel;
