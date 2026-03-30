# Changelog

All notable changes to **LiveFlow Pro** will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-03-31

### Added
- ▶️ Start/Stop/Restart commands via command palette and status bar
- 📁 Static file serving from workspace root or custom sub-path
- 🔄 WebSocket-based live reload (no polling)
- 🎨 CSS hot-swap — stylesheets update without a full page reload
- 🚀 Auto-open browser on server start
- 🔢 Auto-detect available port when preferred port is in use
- 🔒 HTTPS mode with programmatic self-signed certificate generation
- 🛤️ Custom base path support
- 📱 SPA fallback — serve `index.html` for client-side routed apps
- ❌ Error overlay injected into the browser for runtime/build errors
- 📡 LAN access (browser sync across devices on the same network)
- 📷 QR code for mobile access (printed in VS Code Output Channel)
- 🗜️ Gzip compression for HTML, CSS, JS, and other text assets
- 🗃️ Cache control headers (no-cache for HTML/CSS/JS, 1h for assets)
- 📊 Interactive server dashboard (VS Code WebView)
- 🎛️ Status bar button showing server port, click to stop
- 📋 Timestamped output channel logging (INFO, WARN, ERROR, DEBUG)
- 🔔 VS Code notifications for server start, stop, and errors
- 👁️ File watcher with chokidar and configurable debounce
- 🚫 Ignores `node_modules`, `.git`, `dist`, `build`, `__pycache__`
- 🏢 Multi-root workspace support
- 🛡️ Path traversal attack prevention
- ⚙️ Full settings integration via VS Code `settings.json`

---

## [Unreleased]

### Planned
- Plugin system for third-party extensions
- Optional React dashboard with live metrics charts
- HTTP/2 support
- Custom MIME type overrides
- Basic auth support for staging environments
- WebDAV support for file uploads
