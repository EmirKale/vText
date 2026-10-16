import { app, BrowserWindow, shell, nativeTheme, dialog } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { registerIpcHandlers } from './ipc';
import { initAutoUpdater } from './updater';
import { registerKalemAssetProtocol, openFileByPath } from './files';
import { getApiKey } from './keystore';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let fileToOpenOnReady: string | null = null;
let isAppQuitting = false;
let isClosePending = false;
let closeTimeout: NodeJS.Timeout | null = null;

export function setAppQuitting(val: boolean = true): void {
  isAppQuitting = val;
}

export function stopCloseTimeout(): void {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
}

export function clearCloseTimeout(): void {
  stopCloseTimeout();
  isClosePending = false;
}

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
  app.on('second-instance', async (_, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const openedFile = parseArgvForFile(argv);
      if (openedFile) {
        const doc = await openFileByPath(openedFile);
        if (doc.success) {
          mainWindow.webContents.send('app:open-file', doc);
        }
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
      color: nativeTheme.shouldUseDarkColors ? '#13191C' : '#F0F3F0',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#E2E7E3' : '#1C2523',
      height: 40
    },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E1315' : '#E6EAE6',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    },
    show: false
  });

  // Save window bounds and intercept close to ask for confirmation if there are unsaved tabs
  mainWindow.on('close', (e) => {
    // 1. Windows oturum kapatma / yeniden başlatma (session-end / before-quit) ve autoUpdater durumlarında onayı atla
    if (isAppQuitting) {
      return;
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    // 2. Aynı anda birden fazla kapatma isteğinde çift onay penceresi çıkmasın
    if (isClosePending) {
      e.preventDefault();
      return;
    }

    try {
      store.set('windowBounds', mainWindow.getBounds());
    } catch {}

    e.preventDefault();
    isClosePending = true;

    // 3. Renderer yanıt vermezse (3.5 saniye zaman aşımı) kullanıcıya kapatma seçeneği ver
    if (closeTimeout) clearTimeout(closeTimeout);
    closeTimeout = setTimeout(() => {
      if (isClosePending && mainWindow && !mainWindow.isDestroyed()) {
        isClosePending = false;
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          buttons: ['Kapat', 'Bekle'],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
          title: 'vText Yanıt Vermiyor',
          message: 'Uygulama kapatılırken yanıt vermiyor. Yine de kapatmak istiyor musunuz?'
        });
        if (choice === 0) {
          mainWindow.destroy();
        }
      }
    }, 3500);

    mainWindow.webContents.send('app:request-close-window');
  });

  // Renderer çöktüğünde veya yanıt vermediğinde pencere kilitli kalmasın
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.warn(`[Main] Renderer process gone (${details.reason})`);
    clearCloseTimeout();
    mainWindow?.destroy();
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Main] Renderer unresponsive');
    if (isClosePending && mainWindow && !mainWindow.isDestroyed()) {
      clearCloseTimeout();
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Kapat', 'Bekle'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'vText Yanıt Vermiyor',
        message: 'Uygulama yanıt vermiyor. Yine de kapatmak istiyor musunuz?'
      });
      if (choice === 0) {
        mainWindow.destroy();
      }
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (fileToOpenOnReady) {
      openFileByPath(fileToOpenOnReady).then((doc) => {
        if (doc.success && mainWindow) {
          setTimeout(() => {
            mainWindow?.webContents.send('app:open-file', doc);
          }, 600);
        }
      });
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

app.on('session-end', () => {
  // Windows oturumu kapatılıyor veya yeniden başlatılıyor.
  // İşletim sisteminin kapatma sürecini kilitlememesi için onayı atla.
  isAppQuitting = true;
  clearCloseTimeout();
});

app.on('before-quit', (e) => {
  // Kullanıcı eylemi veya koddan tetiklenen app.quit() çağrılarında onayı atlamamak için:
  // Eğer henüz onaylı kapatma tamamlanmadıysa, çıkışı engelle ve pencereyi onaylı kapatmaya yönlendir.
  if (!isAppQuitting) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.close();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
