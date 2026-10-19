# vText Mimari Belgesi

## 1. Süreçler ve Sorumluluklar
- **Main Süreci** (`src/main/index.ts:1-301`): Pencere yönetimi, işletim sistemi dosya I/O, yerel diyaloglar, kasa/şifreleme (`src/main/keystore.ts:1-120`), AI OpenRouter ağ çağrıları (`src/main/ai/openrouter.ts:1-250`), otomatik güncelleme (`src/main/updater.ts:1-135`).
- **Preload Süreci** (`src/preload/index.ts:1-188`): `contextBridge.exposeInMainWorld` ile yalnızca izinli ve tiplendirilmiş API köprüsü kurar (`window.kalem`, `window.vtext`, `window.api`).
- **Renderer Süreci** (`src/renderer/src/App.tsx:1-470`): React 18 ve TipTap tabanlı zengin metin düzenleyici, sekmeler (`src/renderer/src/store/useAppStore.ts:1-150`), biçimlendirme ve menüler. Renderer doğrudan Node.js/FS yetkisine sahip değildir.

## 2. Dosya İşlemleri ve Kayıt Mimarisi
- **docId & Yol Gizleme** (`src/main/registry.ts:35-85`): Renderer kesinlikle gerçek dosya yolunu bilmez; her dosya bellekte UUID `docId` ile eşlenir. Renderer yalnızca `docId` ve `title` bilir.
- **Atomik Yazma ve fsync** (`src/main/files.ts:394-414`): Hedef dizinde geçici dosyaya (`.vtext-tmp-...`) `fileHandle.writeFile` ile yazılır, `fileHandle.sync()` ile disk fsync işlemi yapılır ve `fs.promises.rename` ile tek adımda değiştirilir. `fs.renameSync` kullanılmaz.
- **Format Doğrulaması** (`src/main/ipcSchemas.ts:10-29`): Zod enum (`DocumentFormatSchema`) `docx`, `md`, `txt`, `html`, `odt`, `rtf`, `doc`, `pdf` içerir. Ancak `pdf` dosyaları `saveFile` (`src/main/files.ts:339-344`) ile kaydedilemez (`ERR_INVALID_FORMAT`); yalnızca `files:exportPdf` (`src/main/pdf.ts:40`) ile dışa aktarılır.

## 3. IPC Güvenliği
- **Gönderici Doğrulaması** (`src/main/ipcSecurity.ts:13-54`): `isValidSender` fonksiyonu `event.senderFrame.url` bilgisini doğrular. Paketlenmiş ortamda rastgele `file://` URL'leri engellenir; `pathToFileURL` ile uygulamanın kendi `index.html` mutlak yolu ile tam eşleşme (`normSenderPath === normExpected`) aranır. Geliştirme ortamında ise `ELECTRON_RENDERER_URL` kontrol edilir.
- **registerSecureHandler** (`src/main/ipcSecurity.ts:60-72`): Bütün kanallar bu sarmalayıcıyla kaydedilir; yetkisiz çerçeveler engellenir ve parametreler Zod şemalarıyla doğrulanır.
- **Mevcut IPC Kanalları** (`src/main/ipc.ts:74-490`, `src/main/updater.ts:69-125`):
  `window:setTheme`, `window:close`, `window:cancelClose`, `window:promptingClose`, `files:open`, `files:openDropped`, `files:showSaveDialog`, `files:save`, `files:unregister`, `files:exportPdf`, `files:saveAsset`, `dialog:confirmClose`, `dialog:confirmOverwrite`, `settings:get`, `settings:save`, `settings:saveApiKey`, `settings:testApiKey`, `settings:importedFromPlaintext`, `tools:detect`, `ai:getModels`, `ai:abort`, `ai:generateArticle`, `ai:rewrite`, `ai:proofread`, `ai:translate`, `ai:generateImagePrompt`, `ai:generateImage`, `updater:check`, `updater:install`, `updater:get-version`.

## 4. Kapatma ve Güncelleme Akışı
- **closeCoordinator** (`src/main/closeCoordinator.ts:1-75`): `isClosing`, `isQuitting`, `installPendingAfterSave` durumlarını yönetir.
- **El Sıkışma (Handshake) Kanalları** (`src/main/index.ts:149`, `src/preload/index.ts:21-27`, `src/main/ipc.ts:172-205`):
  Pencere veya sekme kapatılırken Main'den Renderer'a `app:request-close-window` iletilir (`window:requestCloseTab` değildir). Kaydedilmemiş sekme varsa diyalog açılır. Kullanıcı kaydetmeyi seçerse dosyalar kaydedilir; ardından `window:close`, `window:cancelClose` veya `window:promptingClose` ile el sıkışma tamamlanır; güncelleme varsa `autoUpdater.quitAndInstall` çalıştırılır.

## 5. İçe ve Dışa Aktarma (I/O)
- **DOCX**: İçe aktarma `mammoth` (`src/main/files.ts:208-225`) + `preserveDocxTableStructure` kancası ile yapılır; dışa aktarma `docx` kütüphanesi (`src/renderer/src/io/docxExport.ts:1-350`) ile üretilir.
- **Markdown**: `markdown-it` ile içe aktarılır (`src/main/files.ts:182-205`); dışa aktarma TipTap JSON'dan özel dönüştürücüyle yapılır (`src/renderer/src/io/markdown.ts:1-120`).
- **TXT**: Ham metin olarak UTF-8 veya Windows-1254 tespitiyle okunur (`src/main/files.ts:150-180`); dışa aktarımda UTF-8 BOM eklenerek kaydedilir (`src/main/files.ts:401-403`).
- **PDF**: Chromium `printToPDF` ile dışa aktarılır (`src/main/pdf.ts:40-95`).

## 6. Tipografi ve WYSIWYG Kararı
- **Yazı Tipi Yığını** (`src/shared/typography.ts:13-17`, `src/renderer/src/styles/globals.css:167`): Varsayılan editör, DOCX ve PDF yazı tipi yığını `'Calibri, Carlito, "Segoe UI", sans-serif'` olarak eşitlenmiştir. Calibri lisans kısıtlaması nedeniyle uygulamaya gömülmez; işletim sistemi yazı tipi olarak kullanılır. Eski serif web yazı tipi (`Literata`) paket ve ağ boyutu optimizasyonu için `src/renderer/index.html`'den kaldırılmıştır.
- **Boyut ve Aralık Eşitlemesi** (`src/shared/typography.ts:18-70`, `src/renderer/src/io/docxExport.ts:25-450`, `src/main/pdf.ts:23-40`): Gövde 12pt (16px), Başlık 1 24pt (32px, oran 2.0), Başlık 2 18pt (24px, oran 1.5), Başlık 3 15pt (20px, oran 1.25). Satır aralığı (1.15) ve paragraf boşlukları (6pt) OpenXML `styles.xml` ile tam uyumludur.

## 7. Test Mimarisi ve TSC İzolasyonu
- **TSC İzolasyonu** (`tsconfig.node.json`, `tsconfig.web.json`, `tsconfig.json`):
  - `tsconfig.node.json` (17 dosya): `lib: ["ESNext"]`, `types: ["node"]`, DOM tipleri (`window`) bulunmaz.
  - `tsconfig.web.json` (36 dosya): `lib: ["ESNext", "DOM", "DOM.Iterable"]`, `types: []` ve boş `typeRoots`, Node tipleri (`require`, `process`) bulunmaz.
- **Birim Testler** (`npm test`): `vitest` ile `tests/` altındaki 6 test dosyasını (79 test) çalıştırır.
- **E2E Testleri** (`npm run test:e2e`): Playwright for Electron (`scripts/run-e2e.mjs`) doğrudan geliştirme çıktısı (`electron .`) üzerinde 12 kapsamlı senaryoyu çalıştırır. Neden: Playwright, `EnableNodeCliInspectArguments` fuse'unun AÇIK olmasını gerektirir; bu fuse güvenlik için paketli exe'de kapalı tutulmalıdır.
- **Gereksinimler**: E2E testleri için sistemde LibreOffice (`soffice.exe`) ve Python 3 (`PyMuPDF / fitz`) kurulu olmalıdır.
- **Duman Testi** (`npm run smoke-test`): `scripts/smoke-test.mjs`, paketlenmiş `dist/win-unpacked/vText.exe` dosyasını izole argümanlarla çalıştırıp IPC ve preload köprüsünü doğrular.
- **Mutasyon Kanıtı**: Her kural için koddaki kontrol geçici olarak bozularak testin temiz bir çalışma anı/assertion hatası verdiği kanıtlanır, ardından geri alınır.

## 8. Değiştirilmemesi Gereken Kurallar
- Renderer asla yerel dosya yolu (`filePath`) almamalı veya doğrudan `fs` çağrısı yapmamalıdır (`docId` kuralı, `src/main/registry.ts`).
- `SaveSettingsSchema` daima `.strict()` kalmalı; GitHub güncelleme deposu dinamik ayarlardan değil yalnızca `package.json` (`build.publish`) derleme yapılandırmasından okunmalıdır (`src/main/ipcSchemas.ts:189-201`).
- Duman testi bayrağı `--smoke-test-out` yalnızca `os.tmpdir()` altındaki `.json` yolunu kabul etmeli ve sadece ayar anahtarlarını yazmalıdır (`src/main/smokeValidator.ts:1-25`, `src/main/index.ts:237-255`).
- `docx` dışa aktarımında `tableHeader` yalnızca başlık satırında `true` verilmeli, gövde satırlarında `undefined` bırakılmalıdır (`src/renderer/src/io/docxExport.ts:285`).

## 9. Bilinen Eksikler
- Otomatik taslak kaydı (auto-draft) bulunmamaktadır (`src/renderer/src/store/useAppStore.ts`).
- Güvenlik Content-Security-Policy (CSP) başlığı tanımlanmamıştır (`index.html`).
- Electron sürümü: `package.json:64` üzerinde `^34.0.0` tanımlı olup derleme çıktısı `v34.5.8`'dir.
- `kalem-asset://` özel protokol işleyicisinin tam güvenlik ve kaynak denetimi incelenmemiştir (`src/main/files.ts:68-110`).
