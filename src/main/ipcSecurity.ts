import { app, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * URL doğrulaması için saf yardımcı fonksiyon.
 * - senderUrl boş veya geçersizse reddeder.
 * - Vite dev URL'sine yalnızca paketlenmemiş geliştirme ortamında (!isPackaged) izin verir.
 * - Paketlenmiş sürümde rastgele file:// URL'lerini engeller, yalnızca uygulamanın index.html dosyasını kabul eder.
 * - fileURLToPath kullanarak boşlukları (%20), Türkçe karakterleri (%C4%B0, %C5%9F vb.) ve dosya yollarını
 *   Windows'un büyük/küçük harf duyarsızlığına göre normalleştirir.
 */
export function isAllowedUrl(
  senderUrl: string | undefined | null,
  expectedFilePaths: string[] = [
    path.resolve(__dirname, '../renderer/index.html'),
    path.resolve(__dirname, '../../src/renderer/index.html')
  ],
  isPackaged: boolean = typeof app?.isPackaged === 'boolean' ? app.isPackaged : false,
  devUrl: string | undefined = process.env.ELECTRON_RENDERER_URL
): boolean {
  if (!senderUrl || typeof senderUrl !== 'string') return false;

  // 1. Vite dev URL'sine yalnızca paketlenmemiş ortamda izin ver
  if (!isPackaged && devUrl) {
    return senderUrl.startsWith(devUrl);
  }

  // 2. Paketlenmiş sürümde yalnızca uygulamanın index.html dosyasının tam yolunu kabul et
  try {
    const rawUrl = senderUrl.split('#')[0].split('?')[0];
    if (!rawUrl.startsWith('file://')) return false;

    // fileURLToPath percent-encoded karakterleri (%20, %C4%B0, %C5%9F vb.) UTF-8 metne çözer
    const senderPath = fileURLToPath(rawUrl);
    const normSenderPath = path.resolve(senderPath).toLowerCase();

    return expectedFilePaths.some((expected) => {
      const normExpected = path.resolve(expected).toLowerCase();
      return normSenderPath === normExpected;
    });
  } catch {
    return false;
  }
}

/**
 * IPC kanalları için yetkili çağırıcı doğrulayıcısı.
 * - senderFrame null veya undefined ise reddeder.
 */
export function isValidSender(event: Electron.IpcMainInvokeEvent): boolean {
  if (!event || !event.senderFrame) return false;
  return isAllowedUrl(event.senderFrame.url);
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
