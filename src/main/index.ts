import { app, BrowserWindow, shell, nativeTheme, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Store from 'electron-store';
import { registerIpcHandlers } from './ipc';
import { initAutoUpdater } from './updater';
import { registerKalemAssetProtocol, openFileByPath } from './files';
import { getApiKey } from './keystore';

import { closeCoordinator } from './closeCoordinator';
import { isValidSmokeTestOutPath, isValidSmokeTestOpenPath } from './smokeValidator';
import { documentRegistry } from './registry';

(globalThis as any).__documentRegistry = documentRegistry;

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let fileToOpenOnReady: string | null = null;

export function setAppQuitting(val: boolean = true): void {
  closeCoordinator.setAppQuitting(val);
}

export function stopCloseTimeout(): void {
  closeCoordinator.stopCloseTimeout();
}

export function clearCloseTimeout(): void {
  closeCoordinator.clearCloseTimeout();
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

  // Windows oturumu kapatılıyor veya yeniden başlatılıyor (BrowserWindow olayı - Windows)
  mainWindow.on('session-end', () => {
    closeCoordinator.setAppQuitting(true);
    closeCoordinator.clearCloseTimeout();
  });

  // Save window bounds and intercept close to ask for confirmation if there are unsaved tabs
  mainWindow.on('close', (e) => {
    // 1. Windows oturum kapatma / yeniden başlatma (session-end / before-quit) ve autoUpdater durumlarında onayı atla
    if (closeCoordinator.isQuitting()) {
      return;
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    // 2. Aynı anda birden fazla kapatma isteğinde çift onay penceresi çıkmasın
    if (closeCoordinator.isClosing()) {
      e.preventDefault();
      return;
    }

    try {
      store.set('windowBounds', mainWindow.getBounds());
    } catch {}

    e.preventDefault();
    closeCoordinator.setClosePending(true);

    // 3. Renderer yanıt vermezse (3.5 saniye zaman aşımı) kullanıcıya kapatma seçeneği ver
    closeCoordinator.startCloseTimeout(() => {
      if (closeCoordinator.isClosing() && mainWindow && !mainWindow.isDestroyed()) {
        closeCoordinator.clearCloseTimeout();
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
        } else {
          closeCoordinator.setClosePending(false);
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
    if (closeCoordinator.isClosing() && mainWindow && !mainWindow.isDestroyed()) {
      clearCloseTimeout();
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Kapat', 'Bekle'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'vText Yanıt Vermiyor',
        message: 'Uygulama yanıt vermiyor. Zorla kapatmak istiyor musunuz?'
      });
      if (choice === 0) {
        mainWindow.destroy();
      } else {
        closeCoordinator.setClosePending(false);
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

  // Smoke test verification flag: verifies contextBridge, preload and IPC roundtrip
  const isSmokeTest = process.argv.includes('--smoke-test');
  const smokeOutArg = process.argv.find((arg) => arg.startsWith('--smoke-test-out='));
  const smokeTestOutPath = smokeOutArg ? smokeOutArg.slice('--smoke-test-out='.length) : null;
  const isValidOutPath = isValidSmokeTestOutPath(smokeTestOutPath);

  // Collect all --smoke-test-open= args (supports multiple flags or comma-separated list)
  const openArgs: string[] = [];
  for (const arg of process.argv) {
    if (arg.startsWith('--smoke-test-open=')) {
      const val = arg.slice('--smoke-test-open='.length);
      for (const p of val.split(',')) {
        const trimmed = p.trim();
        if (trimmed && isValidSmokeTestOpenPath(trimmed)) {
          openArgs.push(trimmed);
        }
      }
    }
  }

  if (isSmokeTest && isValidOutPath && smokeTestOutPath) {
    mainWindow.webContents.on('did-finish-load', async () => {
      try {
        console.log('[SmokeTest] did-finish-load triggered, verifying IPC via window.api.settings.get()...');
        const settings = await mainWindow!.webContents.executeJavaScript(`
          new Promise((resolve, reject) => {
            const api = window.api || window.kalem || window.vtext;
            if (!api || !api.settings || typeof api.settings.get !== 'function') {
              reject(new Error('IPC api.settings.get is not exposed or contextBridge failed'));
              return;
            }
            api.settings.get().then(resolve).catch(reject);
          })
        `);

        let overallSuccess = true;
        let turkceKarakterKorundu = true;
        let docxHeadings = 0;
        let docxParagraphs = 0;
        let mdHeadings = 0;
        let mdParagraphs = 0;
        let txtParagraphs = 0;

        for (const filePath of openArgs) {
          const ext = path.extname(filePath).toLowerCase();
          console.log(`[SmokeTest] Opening ${ext} file:`, filePath);
          const openResult = await openFileByPath(filePath);
          if (!openResult.success || !openResult.content) {
            overallSuccess = false;
            console.error(`[SmokeTest] Dosya açılamadı (${ext}):`, openResult.error);
            continue;
          }
          const content = openResult.content;
          const hMatches = content.match(/<h[1-6]\b[^>]*>/gi);
          const pMatches = content.match(/<(?:p|li)\b[^>]*>/gi);
          const hCount = hMatches ? hMatches.length : 0;
          const pCount = pMatches ? pMatches.length : 0;

          if (ext === '.docx') {
            docxHeadings += hCount;
            docxParagraphs += pCount;
          } else if (ext === '.md') {
            mdHeadings += hCount;
            mdParagraphs += pCount;
          } else if (ext === '.txt') {
            txtParagraphs += pCount;
            // K5: Windows-1254 Türkçe karakter doğrulama (ş, ğ, ı, İ, ö, ü, ç)
            const requiredChars = ['ş', 'ğ', 'ı', 'İ', 'ö', 'ü', 'ç'];
            const allPreserved = requiredChars.every((ch) => content.includes(ch));
            if (!allPreserved) {
              turkceKarakterKorundu = false;
              console.error('[SmokeTest] Türkçe karakterler korunamadı (kodlama çözücü hatası):', content);
            }
          }
        }

        // Only boolean success, turkceKarakterKorundu and number metrics are written to the marker file (no paths or strings)
        const payload: Record<string, boolean | number> = (openArgs.length > 0)
          ? {
              success: overallSuccess && turkceKarakterKorundu,
              turkceKarakterKorundu,
              docxHeadings,
              docxParagraphs,
              mdHeadings,
              mdParagraphs,
              txtParagraphs
            }
          : {
              success: overallSuccess,
              settingKeyCount: settings && typeof settings === 'object' ? Object.keys(settings).length : 0,
              timestamp: Date.now()
            };

        fs.writeFileSync(smokeTestOutPath, JSON.stringify(payload, null, 2), 'utf-8');
        console.log('[SmokeTest] Marker file written successfully:', smokeTestOutPath);
        setTimeout(() => {
          app.quit();
        }, 500);
      } catch (err: any) {
        console.error('[SmokeTest] IPC verification failed:', err);
        const payload = {
          success: false,
          error: err?.message || String(err),
          timestamp: Date.now()
        };
        try {
          fs.writeFileSync(smokeTestOutPath, JSON.stringify(payload, null, 2), 'utf-8');
        } catch {}
        setTimeout(() => {
          app.quit();
        }, 500);
      }
    });
  }

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

app.on('before-quit', (e) => {
  // Kullanıcı eylemi veya koddan tetiklenen app.quit() çağrılarında onayı atlamamak için:
  // Eğer henüz onaylı kapatma tamamlanmadıysa, çıkışı engelle ve pencereyi onaylı kapatmaya yönlendir.
  if (!closeCoordinator.isQuitting()) {
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
