# vText Mimari Belgesi

## 1. Süreçler ve Sorumluluklar
- **Main Süreci** (`src/main/index.ts`): Pencere yönetimi, işletim sistemi dosya I/O, yerel diyaloglar, kasa/şifreleme (`src/main/keystore.ts`), AI OpenRouter ağ çağrıları (`src/main/ai/openrouter.ts`), otomatik güncelleme (`src/main/updater.ts`).
- **Preload Süreci** (`src/preload/index.ts`): `contextBridge.exposeInMainWorld` ile yalnızca izinli ve tiplendirilmiş API köprüsü kurar (`window.api` / `window.kalem`).
- **Renderer Süreci** (`src/renderer/src/`): React 18 ve TipTap tabanlı zengin metin düzenleyici, sekmeler (`useAppStore.ts`), görsel biçimlendirme ve menüler. Renderer doğrudan Node.js/FS yetkisine sahip değildir.

## 2. Dosya İşlemleri ve Kayıt Mimarisi
- **docId & Yol Gizleme** (`src/main/registry.ts`): Renderer kesinlikle gerçek dosya yolunu bilmez; her dosya bellekte UUID `docId` ile eşlenir. Renderer yalnızca `docId` ve `title` bilir.
- **Atomik Yazma** (`src/main/files.ts`): Dosyalar hedef dizinde geçici dosyaya (`.vtext-tmp-...`) yazılır ve `fs.renameSync` ile tek adımda değiştirilir. Veri kaybı engellenir.
- **Format Doğrulaması** (`src/main/ipcSchemas.ts`): Kaydetme ve açma uzantıları Zod enum (`docx`, `md`, `txt`, `html`, `odt`, `rtf`, `doc`, `pdf`) ile kısıtlanır.

## 3. IPC Güvenliği
- **Gönderici Doğrulaması** (`src/main/ipcSecurity.ts`): `isValidSender` fonksiyonu `event.senderFrame.url` bilgisini doğrular (`file://` veya `http://localhost:5173`).
- **registerSecureHandler** (`src/main/ipcSecurity.ts`): Bütün kanallar bu sarmalayıcıyla kaydedilir; yetkisiz çerçeveler engellenir ve argümanlar Zod şemalarıyla doğrulanır.
- **Mevcut IPC Kanalları** (`src/main/ipc.ts`, `src/main/updater.ts`):
  `window:setTheme`, `window:close`, `window:cancelClose`, `window:promptingClose`, `files:open`, `files:openDropped`, `files:showSaveDialog`, `files:save`, `files:unregister`, `files:exportPdf`, `files:saveAsset`, `dialog:confirmClose`, `dialog:confirmOverwrite`, `settings:get`, `settings:save`, `settings:saveApiKey`, `settings:testApiKey`, `settings:importedFromPlaintext`, `tools:detect`, `ai:getModels`, `ai:abort`, `ai:generateArticle`, `ai:rewrite`, `ai:proofread`, `ai:translate`, `ai:generateImagePrompt`, `ai:generateImage`, `updater:check`, `updater:install`, `updater:get-version`.

## 4. Kapatma ve Güncelleme Akışı
- **closeCoordinator** (`src/main/closeCoordinator.ts`): `isClosing`, `isQuitting`, `installPendingAfterSave` durumlarını yönetir.
- **El Sıkışma (Handshake)** (`src/main/index.ts`, `src/renderer/src/App.tsx`): Pencere kapanırken renderer'a `window:requestCloseTab` iletilir. Kaydedilmemiş sekme varsa diyalog açılır. Kullanıcı kaydetmeyi seçerse dosyalar kaydedilir; ardından güncelleme kurulumu (`quitAndInstall`) veya kapanma tetiklenir.

## 5. İçe ve Dışa Aktarma (I/O)
- **DOCX**: İçe aktarma `mammoth` (`src/main/files.ts`) + özel `transformDocument` (tablo başlığı koruma); dışa aktarma `docx` (`src/renderer/src/io/docxExport.ts`) ile yapılır. Bilinen sınır: Tablo hücre dolguları ve kenarlıkları TipTap üzerinde kısmi CSS olarak gösterilir.
- **Markdown**: `markdown-it` ile içe aktarılır (`src/main/files.ts`); TipTap JSON'dan özel dönüştürücüyle dışa aktarılır (`src/renderer/src/io/markdown.ts`).
- **TXT**: Ham metin olarak UTF-8 (veya Windows-1254 tespitiyle) okunur (`src/main/files.ts`); dışa aktarımda UTF-8 BOM ile kaydedilir (`src/renderer/src/io/plainText.ts`).
- **PDF**: Chromium `printToPDF` ile dışa aktarılır (`src/main/pdf.ts`).

## 6. Test Mimarisi
- **Birim Testler** (`npm test`): `vitest` ile `tests/` altındaki kayıt defteri, şemalar, dosya formatları ve koordinatör birimlerini çalıştırır.
- **E2E Testleri** (`npm run test:e2e`): Playwright for Electron (`scripts/run-e2e.mjs`) doğrudan geliştirme çıktısı (`electron .`) üzerinde koşar. Neden: Playwright, `EnableNodeCliInspectArguments` fuse'unun AÇIK olmasını gerektirir; bu fuse güvenlik için paketli exe'de kapalı tutulmalıdır.
- **Gereksinimler**: E2E Senaryo 7 için sistemde LibreOffice (`soffice.exe`) ve Python 3 (`PyMuPDF / fitz`) kurulu olmalıdır.
- **Duman Testi** (`npm run smoke:win`): `scripts/smoke-test.mjs`, paketlenmiş `dist/win-unpacked/vText.exe` dosyasını izole argümanlarla çalıştırıp IPC ve preload köprüsünü doğrular.
- **Mutasyon Kanıtı**: Her güvenlik ve iş kuralı için koddaki kontrol geçici olarak bozularak testin temiz bir hata verdiği kanıtlanır, ardından geri alınır.

## 7. Değiştirilmemesi Gereken Kurallar
- Renderer asla yerel dosya yolu (`filePath`) almamalı veya doğrudan `fs` çağrısı yapmamalıdır (`docId` kuralı korunmalıdır).
- `SaveSettingsSchema` daima `.strict()` kalmalı; GitHub güncelleme deposu dinamik ayarlardan değil yalnızca `package.json` derleme yapılandırmasından okunmalıdır.
- Duman testi bayrağı `--smoke-test-out` yalnızca `os.tmpdir()` altındaki `.json` yolunu kabul etmeli ve sadece ayar anahtarlarını yazmalıdır.
- `docx` dışa aktarımında `tableHeader` yalnızca başlık satırında `true` verilmeli, gövde satırlarında `undefined` bırakılmalıdır (mammoth uyumluluğu).

## 8. Bilinen Eksikler
- Otomatik taslak kaydı (auto-draft) bulunmamaktadır (`src/renderer/src/store/useAppStore.ts`).
- Güvenlik Content-Security-Policy (CSP) başlığı tanımlanmamıştır (`index.html`).
- Electron sürümü eskidir (`v33.2.1`, `package.json`).
- `kalem-asset://` özel protokol işleyicisinin tam güvenlik ve kaynak denetimi incelenmemiştir (`src/main/files.ts`).
- TipTap editör yazı tipi arayüzde dinamik iken dışa aktarılan DOCX yazı tipi Calibri olarak sabittir (`src/renderer/src/io/docxExport.ts`).
