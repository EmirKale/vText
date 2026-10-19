import { app, BrowserWindow, dialog } from 'electron';
import pkg from 'electron-updater';
export const { autoUpdater } = pkg;
import Store from 'electron-store';
import { registerSecureHandler } from './ipcSecurity';
import { closeCoordinator } from './closeCoordinator';
import type { UpdateStatusData } from '../shared/types';

const store = new Store();

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Set logger
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

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
  registerSecureHandler('updater:check', async () => {
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

  registerSecureHandler('updater:install', async (_event, options?: { hasDirtyTabs?: boolean; force?: boolean }) => {
    if (options?.hasDirtyTabs && !options?.force) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'question',
          buttons: ['Kaydet', 'Yine de güncelle', 'İptal'],
          defaultId: 0,
          cancelId: 2,
          noLink: true,
          title: 'vText Güncelleme',
          message: 'Güncellemek için yeniden başlatılacak, kaydedilmemiş belgeler var: Kaydet / Yine de güncelle / İptal',
          detail: 'Belgelerinizdeki kaydedilmemiş değişiklikleri kaydetmek istiyor musunuz?'
        });

        if (choice === 0) {
          // Kaydet: belgeler kaydedildikten sonra quitAndInstall çalışacak şekilde koordinatöre kaydet
          closeCoordinator.setInstallPendingAfterSave(true);
          mainWindow.webContents.send('app:request-close-window');
          return { success: false, action: 'save' };
        } else if (choice === 2) {
          // İptal: güncellemeyi iptal et
          closeCoordinator.setInstallPendingAfterSave(false);
          return { success: false, action: 'cancel' };
        }
        // choice === 1: 'Yine de güncelle' seçildi, doğrudan devam et
      }
    }

    // Quits app and runs installer
    closeCoordinator.setAppQuitting(true);
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  });

  registerSecureHandler('updater:get-version', () => {
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
