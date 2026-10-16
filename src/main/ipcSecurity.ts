import { app, ipcMain } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * IPC kanalları için yetkili çağırıcı doğrulayıcısı.
 * - senderFrame null veya undefined ise reddeder.
 * - Vite dev URL'sine yalnızca paketlenmemiş geliştirme ortamında (!app.isPackaged) izin verir.
 * - Paketlenmiş sürümde rastgele file:// URL'lerini engeller, yalnızca uygulamanın kendi index.html dosyasını kabul eder.
 */
export function isValidSender(event: Electron.IpcMainInvokeEvent): boolean {
  if (!event || !event.senderFrame) return false;
  const senderUrl = event.senderFrame.url;
  if (!senderUrl || typeof senderUrl !== 'string') return false;

  // 1. Vite dev URL'sine yalnızca !app.isPackaged iken izin ver
  const isPackaged = typeof app?.isPackaged === 'boolean' ? app.isPackaged : false;
  if (!isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return senderUrl.startsWith(process.env.ELECTRON_RENDERER_URL);
  }

  // 2. Paketlenmiş sürümde yalnızca uygulamanın kendi index.html dosyasının tam yolunu kabul et; rastgele file:// değil
  try {
    // __dirname main/ altında çalışır, renderer/index.html dosyasını çözümler
    // Test veya derleme ortamında src/renderer veya out/renderer olabilir
    const outRendererPath = path.resolve(__dirname, '../renderer/index.html');
    const srcRendererPath = path.resolve(__dirname, '../../src/renderer/index.html');
    const expectedFileUrlOut = pathToFileURL(outRendererPath).href.toLowerCase();
    const expectedFileUrlSrc = pathToFileURL(srcRendererPath).href.toLowerCase();

    const normSender = senderUrl.toLowerCase().split('#')[0].split('?')[0];
    return normSender === expectedFileUrlOut || normSender === expectedFileUrlSrc;
  } catch {
    return false;
  }
}

/**
 * Tüm ipcMain.handle kanallarını saran güvenli kayıt sarmalayıcısı.
 * Her çağrıda sender frame'in güvenliğini ve kaynağını denetler.
 */
export function registerSecureHandler(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isValidSender(event)) {
      console.warn(`[Security] Unauthorized IPC invocation blocked on channel: ${channel}`);
      throw new Error(`Unauthorized IPC call on channel: ${channel}`);
    }
    return handler(event, ...args);
  });
}
