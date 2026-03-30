# LiveFlow Pro — Setup Script
# Run this in PowerShell to install dependencies and package the extension

Write-Host ""
Write-Host "⚡ LiveFlow Pro Setup" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor DarkGray

# Step 1: Check Node.js
Write-Host ""
Write-Host "Step 1: Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    $npmVersion  = npm --version 2>&1
    Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green
    Write-Host "  ✓ npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "  Download from: https://nodejs.org (LTS recommended)" -ForegroundColor DarkYellow
    exit 1
}

# Step 2: Install dependencies
Write-Host ""
Write-Host "Step 2: Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "  ✗ npm install failed. Check your internet connection." -ForegroundColor Red
    exit 1
}

# Step 3: Check vsce
Write-Host ""
Write-Host "Step 3: Checking vsce (VS Code Extension CLI)..." -ForegroundColor Yellow
try {
    $vsceVersion = vsce --version 2>&1
    Write-Host "  ✓ vsce $vsceVersion" -ForegroundColor Green
} catch {
    Write-Host "  vsce not found. Installing globally..." -ForegroundColor DarkYellow
    npm install -g @vscode/vsce
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ vsce installed." -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to install vsce." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "✓ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open this folder in VS Code" -ForegroundColor White
Write-Host "  2. Press F5 to launch the Extension Development Host" -ForegroundColor White
Write-Host "  3. Open any workspace with HTML files" -ForegroundColor White
Write-Host "  4. Click '$(broadcast) LiveFlow' in the status bar" -ForegroundColor White
Write-Host ""
Write-Host "To package for publishing:" -ForegroundColor Cyan
Write-Host "  vsce package" -ForegroundColor White
Write-Host ""
Write-Host "To publish to VS Code Marketplace:" -ForegroundColor Cyan
Write-Host "  vsce publish" -ForegroundColor White
Write-Host ""
