# vText Mimari Belgesi

## 1. Süreçler ve Sorumluluklar
- **Main Süreci** (`src/main/index.ts:1-301`): Pencere yönetimi, işletim sistemi dosya I/O, yerel diyaloglar, kasa/şifreleme (`src/main/keystore.ts:1-120`), AI OpenRouter ağ çağrıları (`src/main/ai/openrouter.ts:1-250`), otomatik güncelleme (`src/main/updater.ts:1-135`).
- **Preload Süreci** (`src/preload/index.ts:1-188`): `contextBridge.exposeInMainWorld` ile yalnızca izinli ve tiplendirilmiş API köprüsü kurar (`window.kalem`, `window.vtext`, `window.api`).
- **Renderer Süreci** (`src/renderer/src/App.tsx:1-470`): React 18 ve TipTap tabanlı zengin metin düzenleyici, sekmeler (`src/renderer/src/store/useAppStore.ts:1-150`), biçimlendirme ve menüler. Renderer doğrudan Node.js/FS yetkisine sahip değildir.

## 2. Dosya İşlemleri ve Kayıt Mimarisi
- **docId & Yol Gizleme** (`src/main/registry.ts:35-85`): Renderer kesinlikle gerçek dosya yolunu bilmez; her dosya bellekte UUID `docId` ile eşlenir. Renderer yalnızca `docId` ve `title` bilir.
- **Atomik Yazma ve fsync** (`src/main/files.ts:394-414`): Hedef dizinde geçici dosyaya (`.vtext-tmp-...`) `fileHandle.writeFile` ile yazılır, `fileHandle.sync()` ile disk fsync işlemi yapılır ve `fs.promises.rename` ile tek adımda değiştirilir. `fs.renameSync` kullanılmaz.
- **Orijinal Dosyanın Yedeği (vText Öncesi Yedek)** (`src/main/files.ts:405-465`): Diskten açılmış harici bir dosya vText'te ilk kez kaydedilirken, hedef dizinde `Ad (vText öncesi yedek).uzantı` adıyla `fs.promises.copyFile(..., COPYFILE_EXCL)` ile yedeklenir. Aynı adlı yedek varsa numara artırılır (`(vText öncesi yedek 2)`). Yedek alınamazsa (salt okunur klasör vb.) kullanıcıya "Yedek alınamadı. Yine de kaydetmek istiyor musunuz?" diyaloğu sorulur. Oturum başına dosya başına tek bir yedek alınır (`backedUpPaths` seti).
- **Format Doğrulaması** (`src/main/ipcSchemas.ts:10-29`): Zod enum (`DocumentFormatSchema`) `docx`, `md`, `txt`, `html`, `odt`, `rtf`, `doc`, `pdf` içerir. Ancak `pdf` dosyaları `saveFile` (`src/main/files.ts:339-344`) ile kaydedilemez (`ERR_INVALID_FORMAT`); yalnızca `files:exportPdf` (`src/main/pdf.ts:40`) ile dışa aktarılır.
- **Sahte DOCX ve ODT Tespiti** (`src/main/files.ts:291-310`): ZIP içinde `word/document.xml` bulunmayıp `mimetype` ODT ise veya `content.xml` varsa, dosya anında ODT olarak tanınır ve kullanıcıya bilgilendirici Türkçe diyalog (`dialog.showMessageBox`) gösterilir. Sıfır bayt veya bozuk arşivlerde hata günlüğe yazılır ve teknik detay `detail` alanına aktarılır; boş sekme veya docId sızıntısı engellenir.

## 3. IPC Güvenliği
- **Gönderici Doğrulaması** (`src/main/ipcSecurity.ts:13-54`): `isValidSender` fonksiyonu `event.senderFrame.url` bilgisini doğrular. Paketlenmiş ortamda rastgele `file://` URL'leri engellenir; `pathToFileURL` ile uygulamanın kendi `index.html` mutlak yolu ile tam eşleşme (`normSenderPath === normExpected`) aranır. Geliştirme ortamında ise `ELECTRON_RENDERER_URL` kontrol edilir.
- **registerSecureHandler** (`src/main/ipcSecurity.ts:60-72`): Bütün kanallar bu sarmalayıcıyla kaydedilir; yetkisiz çerçeveler engellenir ve parametreler Zod şemalarıyla doğrulanır.
- **Mevcut IPC Kanalları (Koddan Taranan 30 Kanal)**:
  - **Pencere & Tema**: `window:setTheme`, `window:close`, `window:cancelClose`, `window:promptingClose`
  - **Dosya I/O**: `files:open`, `files:openDropped`, `files:showSaveDialog`, `files:save`, `files:unregister`, `files:exportPdf`, `files:saveAsset`
  - **Diyaloglar**: `dialog:confirmClose`, `dialog:confirmOverwrite`
  - **Ayarlar**: `settings:get`, `settings:save`, `settings:saveApiKey`, `settings:testApiKey`, `settings:importedFromPlaintext`
  - **Araçlar & AI**: `tools:detect`, `ai:getModels`, `ai:abort`, `ai:generateArticle`, `ai:rewrite`, `ai:proofread`, `ai:translate`, `ai:generateImagePrompt`, `ai:generateImage`
  - **Güncelleyici**: `updater:check`, `updater:install`, `updater:get-version`
  - **Main -> Renderer Olayları**: `app:request-close-window` (kapatma el sıkışması), `theme:changed`

## 4. Kapatma ve Güncelleme Akışı
- **closeCoordinator** (`src/main/closeCoordinator.ts:1-75`): `isClosing`, `isQuitting`, `installPendingAfterSave` durumlarını yönetir.
- **El Sıkışma (Handshake) Kanalları** (`src/main/index.ts:149`, `src/preload/index.ts:21-27`, `src/main/ipc.ts:172-205`):
  Pencere veya sekme kapatılırken Main'den Renderer'a `app:request-close-window` iletilir (`window:requestCloseTab` değildir). Kaydedilmemiş sekme varsa diyalog açılır. Kullanıcı kaydetmeyi seçerse dosyalar kaydedilir; ardından `window:close`, `window:cancelClose` veya `window:promptingClose` ile el sıkışma tamamlanır; güncelleme varsa `autoUpdater.quitAndInstall` çalıştırılır.

## 5. İçe ve Dışa Aktarma (I/O)
- **DOCX**: İçe aktarma `mammoth` (`src/main/files.ts`) + `MAMMOTH_STYLE_MAP` + `preserveDocxStructureAndAlignment` kancası ile yapılır; dışa aktarma `docx` kütüphanesi (`src/renderer/src/io/docxExport.ts:1-400`) ile üretilir.
- **Hizalama Korunumu (`w:jc`)**: Mammoth AST'sindeki `paragraph.alignment` ('center', 'end'/'right', 'both'/'justify'), `preserveDocxStructureAndAlignment` kancasıyla stil sınıfına dönüştürülür. `MAMMOTH_STYLE_MAP` ile HTML sınıflarına (`text-center`, `text-right`, `text-justify`) ve ardından TipTap `TextAlign` uyumlu inline CSS'e (`style="text-align: ..."`) çevrilir. Dışa aktarımda `docxExport.ts` `AlignmentType` ile OpenXML `w:jc` etiketini yazar.
- **Karakter Stilleri**: `Emphasis` ve `Strong` karakter stilleri `MAMMOTH_STYLE_MAP` ile sırasıyla `<em>` ve `<strong>` etiketlerine dönüştürülür.
- **İç İçe Listeler**: Çok seviyeli listeler dışa aktarılırken `convertList` özyinelemeli (recursive) fonksiyonu ile işlenir ve `docx` kütüphanesinin `numbering.config` seviyelerine (seviye 0..5) uygun olarak `w:ilvl` atanır.
- **Markdown**: `markdown-it` ile içe aktarılır; dışa aktarma TipTap JSON'dan özel dönüştürücüyle yapılır (`src/renderer/src/io/markdown.ts:1-120`).
- **TXT**: Ham metin olarak UTF-8 veya Windows-1254 tespitiyle okunur; dışa aktarımda UTF-8 BOM eklenerek kaydedilir.
- **PDF**: Chromium `printToPDF` ile dışa aktarılır (`src/main/pdf.ts:40-95`).

### 5.2 (d) Karar Notu: Serbest Yazı Tipi ve Punto Korunumu
- **Mammoth'ta Mümkün mü?** HAYIR. Mammoth'un tasarım felsefesi anlamsal belge yapısına odaklanır. Belge içindeki serbest satır içi yazı tipi adları (`w:rFonts`) ve punto boyutları (`w:sz`), web semantiğinde tutarsız ve temizlenmesi zor satır içi stil karmaşası yarattığı için Mammoth tarafından kasıtlı olarak göz ardı edilir.
- **Alternatif 1: `word/document.xml` Ön-İşleme (Pre-processing):**
  DOCX arşivini açıp XML içindeki `w:rFonts` ve `w:sz` değerlerini sentetik karakter stillerine (`vtext_font_X_size_Y`) dönüştürüp `word/styles.xml`'e yazmak ve Mammoth `styleMap`'e eklemek teorik olarak mümkündür. Ancak ECMA-376 stil kalıtımı (Document Defaults, Normal, Paragraph Style, Character Style, Run Properties) hiyerarşisi simüle edilmeden yapılan bu müdahale, mevcut stilleri bozar, dosya boyutunu ve açılış süresini artırır ve yüksek dosya bozulma riski taşır. (Not: Ön analizlerdeki "Word belgelerinin %70'inden fazlası tema fontu kullanır" ve "5-10 kat DOM şişmesi" ifadeleri ölçülmemiştir, tahmindir).
- **Alternatif 2: Kendi İçe Aktarıcımız (Custom OpenXML Importer):**
  Mammoth yerine sıfırdan OpenXML DOM ayrıştırıcısı yazmak yüzlerce adam-saat (kaba tahmin) gerektiren aşırı maliyetli bir iştir.
- **Karar:** vText, standart bir tipografi yığınına (Calibri/Carlito, 12pt gövde) sahip bir kelime işlemcidir. Rastgele font/punto karmaşasını içeri almak tipografik tutarlılığı bozar. Bu nedenle serbest yazı tipi ve punto korunumu Mammoth tasarım sınırları çerçevesinde **bilinen sınır** olarak kabul edilmiş ve spekülatif kod yazılmamıştır.

## 6. Tipografi ve WYSIWYG Ölçüm Raporu
- **Yazı Tipi Yığını** (`src/shared/typography.ts:13-17`, `src/renderer/src/styles/globals.css:167`): Varsayılan editör, DOCX ve PDF yazı tipi yığını `'Calibri, Carlito, "Segoe UI", sans-serif'` olarak eşitlenmiştir.
- **Boyut ve Aralık Eşitlemesi**: Gövde 12pt (16px), Başlık 1 24pt (32px), Başlık 2 18pt (24px), Başlık 3 15pt (20px). Satır aralığı 1.15 ve paragraf boşlukları 6pt'dir.
- **6.a Ölçüm Raporu: vText PDF ile LibreOffice PDF (A4 ~600 Kelime) Düzen Karşılaştırması**:
  "Sayfa düzeni A4 çıktılarıyla birebir örtüşüyor" iddiası deneysel olarak test edilmiştir. 521 kelimelik 5 paragraflık aynı metin A4 ebadında (20mm kenar boşlukları, Calibri 12pt, 1.15 satır aralığı) üretilmiş ve PyMuPDF ile incelenmiştir:
  - **LibreOffice PDF**: **2 sayfa**, toplam **60 satır** (Sayfa 1: 42 satır / 358 kelime, Sayfa 2: 18 satır / 163 kelime). Ortalama 8.6 kelime/satır.
  - **vText (Chromium) PDF**: **1 sayfa**, toplam **45 satır** (Sayfa 1: 45 satır / 521 kelime). Ortalama 11.5 kelime/satır.
  - **Sonuç**: Chromium ve LibreOffice metin dizgi, harf aralığı ve düşey kutu hesaplama algoritmaları farklı olduğundan, iki motorun sayfa sınırları ve satır kırma noktaları **birebir örtüşmemektedir**. İddia kanıtsızdır; vText daha geniş satır dizgisiyle tüm metni tek sayfaya sığdırmıştır.

## 7. Test Mimarisi ve TSC İzolasyonu
- **TSC İzolasyonu** (`tsconfig.node.json`, `tsconfig.web.json`, `tsconfig.json`):
  - `tsconfig.node.json`: `lib: ["ESNext"]`, `types: ["node"]`, DOM tipleri bulunmaz.
  - `tsconfig.web.json`: `lib: ["ESNext", "DOM", "DOM.Iterable"]`, `types: []`, Node tipleri bulunmaz.
- **Birim Testler** (`npm test`): `vitest` ile `tests/` altındaki 7 test dosyasını (85 başarılı test, 3 todo) çalıştırır.
- **E2E Testleri** (`npm run test:e2e`): Playwright for Electron (`scripts/run-e2e.mjs`) 14 kapsamlı senaryoyu çalıştırır (Senaryo 13: Sahte ODT ve bozuk dosya koruması, Senaryo 14: Orijinal dosya yedekleme ve COPYFILE_EXCL).
- **Duman Testi** (`npm run smoke-test`): Paketlenmiş `dist/win-unpacked/vText.exe` dosyasını izole argümanlarla çalıştırıp IPC ve preload köprüsünü doğrular.

## 8. Değiştirilmemesi Gereken Kurallar
- Renderer asla yerel dosya yolu (`filePath`) almamalı veya doğrudan `fs` çağrısı yapmamalıdır (`docId` kuralı, `src/main/registry.ts`).
- Diskten açılan dosyalar ilk kayıtta diskte `Ad (vText öncesi yedek).uzantı` olarak yedeklenmelidir (`COPYFILE_EXCL`).
- `SaveSettingsSchema` daima `.strict()` kalmalı; GitHub güncelleme deposu dinamik ayarlardan değil yalnızca derleme yapılandırmasından okunmalıdır.
- `docx` dışa aktarımında `tableHeader` yalnızca başlık satırında `true` verilmeli, gövde satırlarında `undefined` bırakılmalıdır.

## 9. Bilinen Eksikler
- Otomatik taslak kaydı (auto-draft) bulunmamaktadır (`src/renderer/src/store/useAppStore.ts`).
- Güvenlik Content-Security-Policy (CSP) başlığı tanımlanmamıştır (`index.html`).
- Electron sürümü: `package.json` üzerinde `^34.0.0` tanımlı olup derleme çıktısı `v34.5.8`'dir.
- `kalem-asset://` özel protokol işleyicisinin tam güvenlik ve kaynak denetimi incelenmemiştir.

## 10. Uyumsuzluk ve Bilinen Sınırlar

Aşağıdaki tablo, LibreOffice ile üretilen 5 test belgesinin vText içe aktarım ve dışa aktarım sadakatini göstermektedir:

| Özellik / Yapı | Girdi Biçimi | Durum | Kaynak / Sorumlu Katman | Doğrulama & Test Durumu |
| :--- | :--- | :--- | :--- | :--- |
| **Başlık ve Paragraf Hizalaması (`w:jc`)** | DOCX | **Korundu** | Mammoth AST + `preserveDocxStructureAndAlignment` + `docxExport.ts` | **Gerçek Assertion**: `tests/import-fidelity.test.ts` (5.2 a). Ortalanmış başlık, sağa ve iki yana yaslı paragraflar `style="text-align: ..."` olarak korunur. |
| **Karakter Stilleri (`Emphasis`, `Strong`)** | DOCX | **Korundu** | `MAMMOTH_STYLE_MAP` | **Gerçek Assertion**: `tests/import-fidelity.test.ts` (5.2 b). `Emphasis` → `<em>`, `Strong` → `<strong>` etiketlerine dönüştürülür. |
| **İç İçe Listeler (Çok Seviyeli)** | DOCX | **Korundu** | TipTap JSON + `docxExport.ts: convertList` (recursive) | **Gerçek Assertion**: `tests/import-fidelity.test.ts` (5.2 c). Seviye 0, 1 ve 2 (`w:ilvl`) dışa aktarımda düzleşmeden korunur. |
| **Tablo Kenarlıkları & Hücre Birleştirme** | DOCX | **Korundu** | Mammoth + `sanitizeDocxTableHeaders` + `docxExport.ts` | **Gerçek Assertion**: Senaryo 7 ve 11. Başlık satırları (`th`), kenarlıklar ve `colspan` korunur. |
| **Köprüler ve Görseller** | DOCX | **Korundu** | Mammoth + TipTap ResizableImage | **Gerçek Assertion**: Senaryo 11 (`interop-source.docx`) ve `tests/file-formats-group-b.test.ts`. |
| **Serbest Yazı Tipi (`w:rFonts`) ve Punto (`w:sz`)** | DOCX | **Kayıp** | Mammoth Tasarım Felsefesi | **Bilinen Sınır (`test.todo`)**: Mammoth satır içi serbest font/punto değerlerini anlamsal HTML'e aktarmaz. vText standart Calibri 12pt uygular. |
| **Sayfa Sonları (`w:br type="page"`)** | DOCX | **Kayıp** | Mammoth Sınırı | **Bilinen Sınır (`test.todo`)**: Mammoth sayfa sonu etiketlerini HTML içine taşımaz. |
| **Dipnotlar ve Sonnotlar** | DOCX | **Kayıp** | TipTap Şema Sınırı | **Bilinen Sınır (`test.todo`)**: TipTap çekirdek şemasında dipnot düğüm desteği bulunmamaktadır. |
| **Üstbilgi ve Altbilgi (`w:headerReference`)** | DOCX | **Kayıp** | Mammoth + TipTap Sınırı | **Bilinen Sınır (`test.todo`)**: Mammoth belge üstbilgi ve altbilgilerini ayrıştırmaz. |
