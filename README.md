# Live Server Pro

> ⚡ A production-ready, feature-rich Live Server alternative for VS Code with WebSocket live reload, HTTPS, QR code sharing, SPA support, and browser sync.

![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue?logo=visualstudiocode)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

---

## Features

### Core
- ▶️ **Start/Stop** a local development server from the status bar or command palette
- 📁 **Static file serving** from any workspace folder
- 🔄 **Live reload** via WebSocket — no polling
- 🎨 **CSS hot-swap** — stylesheets update instantly without a full page refresh
- 🌐 **Auto-open** browser on server start
- 🏢 **Multi-root workspace** support

### Advanced
- 🔒 **HTTPS** with auto-generated self-signed certificates
- 🔢 **Auto-detect port** when preferred port is in use
- 🛤️ **Custom base path** support (e.g. `/app/`)
- 📱 **SPA fallback** — serve `index.html` for React/Vue/Angular apps
- ❌ **Error overlay** in browser for build/runtime errors
- 📡 **Browser sync** — LAN access from any device on your network
- 📷 **QR code** printed in Output Channel for quick mobile testing
- 🗜️ **Gzip compression** for faster asset delivery
- 🗃️ **Cache control** headers for static assets

### Developer Experience
- 📊 **Dashboard webview** with real-time server info
- 🎛️ **Status bar** showing server port (click to stop)
- 📋 **Output channel** with structured, timestamped logs
- 🔔 **VS Code notifications** for server events
- 👁️ **File watcher** using chokidar with debounce
- 🚫 Ignores `node_modules`, `.git`, and build output

---

## Getting Started

### Requirements
- **VS Code** 1.85 or higher
- **Node.js** 16+

### Installation
1. Install the extension from the VS Code Marketplace (or via `.vsix`)
2. Open a project folder in VS Code
3. Click **`$(broadcast) Live Server Pro`** in the status bar, or use the command palette

### Quick Start
```
Ctrl+Shift+P → "Live Server Pro: Start Server"
```

---

## Configuration

All settings are under `Live Server Pro.*` in your `settings.json`:

| Setting | Type | Default | Description |
|---|---|---|---|
| `Live Server Pro.port` | `number` | `5500` | Port number (0 = auto-detect) |
| `Live Server Pro.https` | `boolean` | `false` | Enable HTTPS |
| `Live Server Pro.autoOpen` | `boolean` | `true` | Open browser on start |
| `Live Server Pro.rootPath` | `string` | `""` | Relative path from workspace root |
| `Live Server Pro.liveReload` | `boolean` | `true` | Enable live reload |
| `Live Server Pro.spaFallback` | `boolean` | `false` | Serve `index.html` on 404 |
| `Live Server Pro.basePath` | `string` | `"/"` | URL base path prefix |
| `Live Server Pro.showQRCode` | `boolean` | `true` | Print QR code for mobile |
| `Live Server Pro.gzip` | `boolean` | `true` | Enable gzip compression |
| `Live Server Pro.debounceDelay` | `number` | `200` | File watcher debounce (ms) |
| `Live Server Pro.browser` | `string` | `""` | Browser to open (`chrome`, `firefox`, etc.) |

### Example `settings.json`
```json
{
  "Live Server Pro.port": 3000,
  "Live Server Pro.https": false,
  "Live Server Pro.autoOpen": true,
  "Live Server Pro.spaFallback": true,
  "Live Server Pro.showQRCode": true,
  "Live Server Pro.gzip": true
}
```

---

## Commands

| Command | Description |
|---|---|
| `Live Server Pro: Start Server` | Start the development server |
| `Live Server Pro: Stop Server` | Stop the running server |
| `Live Server Pro: Restart Server` | Restart the server |
| `Live Server Pro: Open Dashboard` | Open the server dashboard WebView |

---

## HTTPS Mode

Enable HTTPS with a self-signed certificate:

```json
{
  "Live Server Pro.https": true
}
```

When you first open the site, your browser will show a security warning. Click **"Advanced" → "Proceed to localhost"** to accept the self-signed cert.

---

## SPA Support (React, Vue, Angular)

For single-page applications, enable the SPA fallback:

```json
{
  "Live Server Pro.spaFallback": true
}
```

All routes (e.g. `/about`, `/products/1`) will serve `index.html`, allowing your client-side router to handle them.

---

## Mobile Testing with QR Code

When the server starts, a QR code is printed in the **Live Server Pro** Output Channel. Scan it with your phone (on the same Wi-Fi) to instantly open the site on mobile.

---

## Development

### Running Locally (F5)
1. Clone the repo
2. Open in VS Code
3. Press **F5** → an Extension Development Host opens
4. Use the command palette or status bar to start the server

### Installing Dependencies
```bash
npm install
```

### Publishing
```bash
# Install vsce if you haven't
npm install -g @vscode/vsce

# Package the extension
vsce package

# Publish to marketplace (requires Personal Access Token)
vsce publish
```

---

## Architecture

```
src/
├── extension.js     — Entry point, command registration, status bar
├── server.js        — HTTP/HTTPS server, gzip, SPA fallback, script injection
├── watcher.js       — Chokidar file watcher with debounce
├── websocket.js     — WebSocket server for live reload signals
├── qrcode.js        — QR code generation for mobile access
├── dashboard.js     — VS Code WebView dashboard panel
└── utils/
    ├── logger.js        — Output channel logger
    ├── certificates.js  — Self-signed cert generation
    ├── portFinder.js    — Auto port detection
    ├── pathValidator.js — Directory traversal prevention
    └── networkInfo.js   — LAN IP detection
```

---

## Security

- **Path traversal prevention**: All file paths are validated against the server root
- **Null byte injection protection**: Null bytes are stripped from URL paths
- **No symlink escape**: Symlinks that resolve outside the root are blocked
- **Safe headers**: `X-Content-Type-Options: nosniff` on all responses
- **CORS**: Permissive for development (LAN access); not for production use

---

## License

MIT © Live Server Pro

# Live-Server-Plus
