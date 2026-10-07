import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { registerIpcHandlers } from './ipc';
import { initAutoUpdater } from './updater';
import { registerKalemAssetProtocol } from './files';
import { getApiKey } from './keystore';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let fileToOpenOnReady: string | null = null;

// Parse file argument from command line (Windows Open With / Double-click)
function parseArgvForFile(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') || arg.startsWith('-')) continue;
    if (path.isAbsolute(arg)) {
      const ext = path.extname(arg).toLowerCase();
      if (['.docx', '.md', '.txt', '.html', '.htm', '.odt', '.rtf', '.doc'].includes(ext)) {
        return arg;
      }
    }
  }
  return null;
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const openedFile = parseArgvForFile(argv);
      if (openedFile) {
        mainWindow.webContents.send('app:open-file', openedFile);
      }
    }
  });

  fileToOpenOnReady = parseArgvForFile(process.argv);
}

function createWindow(): void {
  const savedBounds = store.get('windowBounds') as { width?: number; height?: number; x?: number; y?: number } | undefined;

  mainWindow = new BrowserWindow({
    width: savedBounds?.width || 1200,
    height: savedBounds?.height || 800,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 800,
    minHeight: 600,
    title: 'vText',
    icon: path.join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: nativeTheme.shouldUseDarkColors ? '#17181B' : '#F5F5F4',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#E5E7EB' : '#1F2937',
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    },
    show: false
  });

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (fileToOpenOnReady) {
      setTimeout(() => {
        mainWindow?.webContents.send('app:open-file', fileToOpenOnReady);
      }, 600);
    }
  });

  // Secure navigation & external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
      }
    }
  });

  // Register all IPC handlers
  registerIpcHandlers(mainWindow);
  initAutoUpdater(mainWindow);

  // Load URL or file
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize safe key reading
  getApiKey();

  // Register custom protocol
  registerKalemAssetProtocol();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
