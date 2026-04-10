const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const startUrlArg = process.argv.find((arg) => typeof arg === 'string' && /^https?:\/\//.test(arg));
const devServerUrl = startUrlArg || '';
const isDev = Boolean(devServerUrl);

function applyCsp() {
  const prodCsp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const devCsp = [
    "default-src 'self' http://localhost:5173 ws://localhost:5173",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:5173",
    "style-src 'self' 'unsafe-inline' http://localhost:5173",
    "img-src 'self' data: blob: http://localhost:5173",
    "font-src 'self' data: http://localhost:5173",
    "connect-src 'self' ws://localhost:5173 http://localhost:5173",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

  const csp = isDev ? devCsp : prodCsp;

  const filter = { urls: ['*://*/*', 'file://*/*'] };
  require('electron').session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    responseHeaders['Content-Security-Policy'] = [csp];
    callback({ responseHeaders });
  });
}

// Datenbank initialisieren
const { initDb } = require('./dist/db.js');
initDb();

// IPC Handler importieren
require('./dist/ipc-handler.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'dist', 'preload.js'),
    },
  });

  // In Development Mode: Vite Dev Server laden
  // In Production Mode: Gebaute Dateien laden
  if (isDev) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    // Guardrail: normalize asset paths for file:// launches (idempotent).
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      const normalized = html
        .replace(/(["'])\.\.\/assets\//g, '$1./assets/')
        .replace(/(["'])\.\.\/vite\.svg/g, '$1./vite.svg')
        .replace(/(["'])\/assets\//g, '$1./assets/')
        .replace(/(["'])\/vite\.svg/g, '$1./vite.svg');
      if (normalized !== html) {
        fs.writeFileSync(indexPath, normalized, 'utf8');
      }
    }
    mainWindow.loadFile(indexPath);
  }

  // DevTools nur im Entwicklungsmodus öffnen
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);
app.whenReady().then(applyCsp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
