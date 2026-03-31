# ⚡ LiveFlow Pro

> ⚡ A blazing-fast, production-ready Live Server alternative for VS Code with CSS hot-swap, WebSocket live reload, HTTPS, QR code sharing, SPA support, and browser sync.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/samyak2403.liveflow-pro?style=for-the-badge&logo=visual-studio-code&label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=samyak2403.liveflow-pro)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/samyak2403.liveflow-pro?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=samyak2403.liveflow-pro)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/samyak2403.liveflow-pro?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=samyak2403.liveflow-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## 🚀 Why LiveFlow Pro?
Unlike basic live servers, LiveFlow Pro uses **WebSocket-based live reload** (no polling), **CSS hot-swap without full page refresh**, and packs advanced features like HTTPS, QR code mobile testing, and SPA support — all in one extension.

---

## ✨ Features

### Core
- ▶️ **Start/Stop** a local development server from the status bar or command palette
- 📁 **Static file serving** from any workspace folder
- 🔄 **Live reload** via WebSocket — instant updates, no polling
- 🎨 **CSS hot-swap** — stylesheets update instantly without a full page refresh
- 🌐 **Auto-open** browser on server start
- 🏢 **Multi-root workspace** support

### Advanced
- 🔒 **HTTPS** with auto-generated self-signed certificates
- 🔢 **Auto-detect port** when preferred port is in use
- 🛤️ **Custom base path** support (e.g. `/app/`)
- 📱 **SPA fallback** — serve `index.html` for React/Vue/Angular apps
- ❌ **Error overlay** injected into the browser for build/runtime errors
- 📡 **Browser sync** — LAN access from any device on your network
- 📷 **QR code** printed in Output Channel for quick mobile testing
- 🗜️ **Gzip compression** for faster asset delivery
- 🗃️ **Cache control** headers for static assets

### Developer Experience
- 📊 **Dashboard webview** with real-time server info
- 🎛️ **Status bar** showing server port (click to stop)
- 📋 **Output channel** with structured, timestamped logs
- 🔔 **VS Code notifications** for server events
- 👁️ **File watcher** using chokidar with debounce (ignores `node_modules`, `.git`)

---

## 🏁 Getting Started

### Requirements
- **VS Code** 1.85 or higher
- **Node.js** 16+

### Installation
1. Search for **LiveFlow Pro** in the VS Code Marketplace and install it.
2. Open a project folder in VS Code.
3. Click **`$(broadcast) LiveFlow Pro`** in the status bar, or use the Command Palette.

### Quick Start
```
Ctrl+Shift+P → "LiveFlow Pro: Start Server"
```

---

## ⚙️ Configuration

All settings are configured under `liveflow.*` in your `settings.json`:

| Setting | Type | Default | Description |
|---|---|---|---|
| `liveflow.port` | `number` | `5500` | Port number (0 = auto-detect) |
| `liveflow.https` | `boolean` | `false` | Enable HTTPS |
| `liveflow.autoOpen` | `boolean` | `true` | Open browser on start |
| `liveflow.rootPath` | `string` | `""` | Relative path from workspace root |
| `liveflow.liveReload` | `boolean` | `true` | Enable live reload |
| `liveflow.spaFallback` | `boolean` | `false` | Serve `index.html` on 404 |
| `liveflow.basePath` | `string` | `"/"` | URL base path prefix |
| `liveflow.showQRCode` | `boolean` | `true` | Print QR code for mobile |
| `liveflow.gzip` | `boolean` | `true` | Enable gzip compression |
| `liveflow.debounceDelay` | `number` | `200` | File watcher debounce (ms) |
| `liveflow.browser` | `string` | `""` | Browser to open (`chrome`, `firefox`, etc.) |

### Example `settings.json`
```json
{
  "liveflow.port": 3000,
  "liveflow.https": false,
  "liveflow.autoOpen": true,
  "liveflow.spaFallback": true,
  "liveflow.showQRCode": true,
  "liveflow.gzip": true
}
```

---

## ⌨️ Commands

| Command | Description |
|---|---|
| `LiveFlow Pro: Start Server` | Start the development server |
| `LiveFlow Pro: Stop Server` | Stop the running server |
| `LiveFlow Pro: Restart Server` | Restart the server |
| `LiveFlow Pro: Open Dashboard` | Open the server dashboard WebView |

---

## 🔒 HTTPS Mode

Enable HTTPS with a self-signed certificate:

```json
{
  "liveflow.https": true
}
```

When you first open the site, your browser will show a security warning. Click **"Advanced" → "Proceed to localhost"** to accept the self-signed cert.

---

## 📱 SPA Support (React, Vue, Angular)

For single-page applications, enable the SPA fallback:

```json
{
  "liveflow.spaFallback": true
}
```

All non-file routes (e.g. `/about`, `/products/1`) will explicitly serve your `index.html`, allowing your client-side router to handle them.

---

## 📷 Mobile Testing with QR Code

When the server starts, a QR code is generated and printed directly to the **LiveFlow Pro** Output Channel. Scan it with your phone (connected to the same Wi-Fi) to instantly open the site on mobile.

---

## 🛠️ Security

- **Path traversal prevention**: All file paths are validated against the server root
- **Null byte injection protection**: Null bytes are stripped from URL paths
- **No symlink escape**: Symlinks that resolve outside the root are blocked
- **Safe headers**: `X-Content-Type-Options: nosniff` on all responses
- **CORS**: Permissive for development (LAN access); not intended for production usage

---

## 📄 License

MIT © Samyak Kamble
