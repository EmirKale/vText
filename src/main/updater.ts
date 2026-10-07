import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import { UpdateStatusData } from '../shared/types';

const store = new Store();

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Set logger
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Configure custom repo if saved by user
  const savedRepo = store.get('updateRepo') as string | undefined;
  if (savedRepo && savedRepo.includes('/')) {
    const [owner, repo] = savedRepo.trim().split('/');
    if (owner && repo) {
      try {
        autoUpdater.setFeedURL({
          provider: 'github',
          owner,
          repo
        });
      } catch (err) {
        console.error('[AutoUpdater] Failed to set feed URL:', err);
      }
    }
  }

  const sendStatus = (data: UpdateStatusData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', data);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      releaseDate: info.releaseDate
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendStatus({
      status: 'not-available',
      version: info.version
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendStatus({
      status: 'downloading',
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({
      status: 'downloaded',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    });
  });

  autoUpdater.on('error', (err) => {
    sendStatus({
      status: 'error',
      message: err == null ? 'Güncelleme sunucusuna erişilemedi.' : (err.message || String(err))
    });
  });

  // Renderer IPC Handlers
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        isDevelopment: true,
        message: 'Geliştirme modundasınız. Otomatik güncelleme paketlenmiş (.exe) ortamında çalışır.'
      };
    }
    try {
      const res = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: res?.updateInfo };
    } catch (err: any) {
      return { success: false, error: err.message || 'Güncelleme denetlenemedi.' };
    }
  });

  ipcMain.handle('updater:install', () => {
    // Quits app and runs installer
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updater:get-version', () => {
    return app.getVersion();
  });

  // Background check on launch if enabled and packaged
  const autoCheck = store.get('autoCheckUpdates') !== false;
  if (app.isPackaged && autoCheck) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[AutoUpdater] Startup check failed:', err?.message);
      });
    }, 4000);
  }
}
