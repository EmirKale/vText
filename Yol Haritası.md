Beceleriler:



1\. UI/UX Pro Max

Kaynak:

https://github.com/nextlevelbuilder/ui-ux-pro-max-skill



2\. Frontend Design

Kaynak:

https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design/skills/frontend-design



bu skilleri kendine yükler misin?



\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_





Lokal bir windows uygulaması yapmak istiyorum.



Basitçe word mantığında çalışan bir belge uygulaması olacak. Word dosyalarını ve benzer dosyaları açacak ve bu şekilde dışa aktarabilecek.



Ancak içerisinde openrouter api ile Deepseek çalışacak.



Özellikleri şunlar olmalı:



Sayfada "Ai İle Makale" butonu olacak ve verdiğimiz konuda makale yazacak. Kelime sayası seçebileceğiz. (Örn: 200-400 400-600 - 800+ gibi)



Bir paragraf veya cümle seçtiğimde "daha uzun yaz, daha kısa yaz, yazımı düzelt" gibi seçenekler çıkacak.



Sayfa genelinde hataları düzelt butonu olacak ve yazım hatalarını yazıyı değiştirmeden düzeltecek.



Çevir butonu olacak ve sayfayı yeni bir dilde yeni bir sayfa olarak tekrar oluşturacak (İngilizce, Almanca, İspanyolca)



Bir cümle ve paragrafı seçince alakalı bir görsel oluşturma için görsel oluşturma seçeneği çıkacak openrouter key ile .... modeliyle görseli oluşturup yazıya yerleştirecek.



Kod bloğu, Prompt bloğu gibi kısımlar eklenebilecek.



Göz yormayan işlevsel ve modern bir tasarımı olacak.



Openrouter API: openrouterkey.txt



\_\_\_\_\_\_\_\_\_\_\_\_



bytedance-seed/seedream-5-0-lite deepseek/deepseek-v4.1-flash electron olarak güncelle

\_\_\_\_\_\_\_\_\_\_\_\_



\# ROL

Sen, Windows masaüstü uygulamaları geliştiren kıdemli bir full-stack mühendis ve ürün tasarımcısısın. Electron, zengin metin editörleri (ProseMirror/TipTap), belge formatı dönüşümleri (DOCX, ODT, RTF, Markdown, PDF) ve LLM API entegrasyonları konusunda uzmansın. Kodun üretim kalitesinde, tip güvenli, modüler ve yorumlu olmalı.



\# PROJE ÖZETİ

"Kalem" adında, Windows için yerel çalışan, Word mantığında bir belge editörü geliştir. Uygulama Word ve benzeri belgeleri açacak, düzenleyecek ve aynı formatlarda dışa aktaracak. İçinde OpenRouter API üzerinden çalışan yapay zeka özellikleri olacak: makale yazma, seçili metni yeniden yazma, yazım düzeltme, çeviri ve görsel oluşturma. Arayüz dili Türkçe olacak.



\# TEKNOLOJİ YIĞINI

\- Masaüstü kabuk: Electron (en güncel kararlı sürüm)

\- Derleme: electron-vite

\- Paketleme: electron-builder. Kurulum dosyası: NSIS .exe (masaüstü ve Başlat menüsü kısayolu oluşturulacak)

\- Frontend (renderer): React 18 + TypeScript + Vite

\- Stil: Tailwind CSS + shadcn/ui, ikonlar: Lucide

\- Editör: TipTap 2 (ProseMirror tabanlı)

\- Kod vurgulama: lowlight (highlight.js)

\- Belge dönüşümleri:

&#x20; - DOCX içe aktarma: mammoth.js (DOCX → HTML → TipTap JSON)

&#x20; - DOCX dışa aktarma: "docx" npm kütüphanesi ile TipTap JSON → DOCX dönüştürücü (kendin yaz, tüm düğüm tiplerini destekle)

&#x20; - Markdown: markdown-it (içe), TipTap JSON → MD serializer (dışa)

&#x20; - HTML ve TXT: yerel

&#x20; - PDF dışa aktarma: webContents.printToPDF (A4, kenar boşluklu, arka plan renkleri dahil). Dışa aktarım için gizli bir BrowserWindow'da yazdırmaya özel bir CSS ile render al.

&#x20; - ODT ve RTF: Kullanıcının bilgisayarında Pandoc veya LibreOffice varsa, main process'ten child\_process ile çağırarak dönüştür. Yoksa bu formatları menüde pasif göster ve nedenini tooltip ile açıkla.

&#x20; - Eski .doc (binary) formatı: Yalnızca LibreOffice kuruluysa desteklensin (soffice --headless --convert-to docx).

\- Durum yönetimi: Zustand

\- Ayarlar ve son dosyalar: electron-store



\# ELECTRON GÜVENLİK MİMARİSİ

\- BrowserWindow ayarları: contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true.

\- Renderer'a yalnızca preload script içinden contextBridge.exposeInMainWorld ile sınırlı ve tipli bir API açılacak (ör. window.kalem.ai.generate, window.kalem.files.open). Genel ipcRenderer veya Node API'leri renderer'a açılmayacak.

\- Tüm IPC kanalları main process'te ipcMain.handle ile tanımlanacak ve gelen parametreler doğrulanacak.

\- Renderer için katı bir Content-Security-Policy tanımlanacak.

\- Editördeki linkler uygulama içinde açılmayacak. shell.openExternal ile sistem tarayıcısında açılacak ve yalnızca http/https protokollerine izin verilecek. setWindowOpenHandler ve will-navigate ile istenmeyen gezinmeler engellenecek.

\- Tüm IPC tip tanımları shared/ klasöründe ortak bir TypeScript dosyasında tutulacak.



\# API ANAHTARI VE GÜVENLİK

\- OpenRouter API anahtarı, kullanıcının vereceği "key.txt" dosyasındadır. Dosyada yalnızca anahtar bulunur. Okurken baştaki ve sondaki boşlukları temizle.

\- Anahtar yükleme sırası:

&#x20; 1. Uygulama ilk açılışta exe'nin bulunduğu klasörde ve %APPDATA%/Kalem/ klasöründe key.txt arar.

&#x20; 2. Bulursa anahtarı Electron safeStorage ile şifreleyip %APPDATA%/Kalem/ altında saklar. Başarılı içe aktarmadan sonra kullanıcıya key.txt dosyasını silmesini öneren bir bildirim gösterir.

&#x20; 3. Bulamazsa Ayarlar'da "API anahtarını yapıştır" veya "key.txt seç" alanı gösterir.

\- Anahtar ASLA renderer'a, loglara, hata mesajlarına veya build çıktısına gitmeyecek. key.txt .gitignore'a eklenecek ve electron-builder paketine dahil edilmeyecek.

\- Tüm OpenRouter istekleri main process'te yapılacak. Streaming yanıtlar IPC event'leri ile parça parça renderer'a aktarılacak.

\- Ayarlar'da "Bağlantıyı test et" butonu olacak ve anahtarın geçerliliğini ve kalan krediyi gösterecek.



\# OPENROUTER ENTEGRASYONU

\- Endpoint: https://openrouter.ai/api/v1/chat/completions (OpenAI uyumlu)

\- Header'lar: Authorization: Bearer <KEY>, HTTP-Referer: https://kalem.local, X-Title: Kalem

\- Metin modeli (varsayılan): "deepseek/deepseek-v4.1-flash"

&#x20; - Makale, uzatma, kısaltma, düzeltme, ton değiştirme, çeviri ve görsel prompt'u üretimi bu modelle yapılacak.

\- Görsel modeli (varsayılan): "bytedance-seed/seedream-5-0-lite"

&#x20; - Görsel üretimi chat/completions isteğiyle yapılacak ve isteğe modalities parametresi eklenecek. Bu model yalnızca görsel üretiyorsa \["image"], hem görsel hem metin üretiyorsa \["image", "text"] kullanılacak. Hangisinin doğru olduğu, modelin /api/v1/models yanıtındaki architecture.output\_modalities alanından okunacak.

&#x20; - Görsel, yanıtta message.images\[].image\_url.url alanında base64 data URL olarak döner.

&#x20; - En-boy oranı, OpenRouter'ın desteklediği image\_config (ör. aspect\_ratio) parametresiyle gönderilecek. Model bu parametreyi desteklemiyorsa oran prompt'a yazılacak.

&#x20; - Koda başlamadan önce OpenRouter'ın güncel görsel üretim dokümantasyonunu ve bu modelin sayfasını kontrol et. İstek ve yanıt formatını buna göre uygula.

\- Her iki model ID'si de Ayarlar'dan değiştirilebilecek. Ayarlar'da https://openrouter.ai/api/v1/models adresinden modeller çekilecek. Metin modelleri ve görsel üretebilen modeller (output\_modalities içinde "image" olanlar) ayrı açılır listelerde gösterilecek.

\- Açılışta seçili model ID'leri model listesinde bulunamazsa kullanıcı uyarılacak ve Ayarlar'a yönlendirilecek.

\- Metin üretiminde streaming (stream: true, SSE) kullanılacak ve metin editöre kelime kelime akacak.

\- Her yapay zeka işleminde "Durdur" butonu olacak (AbortController ile istek iptali).

\- Hata yönetimi (kullanıcıya Türkçe ve anlaşılır mesaj):

&#x20; - 401: anahtar geçersiz

&#x20; - 402: kredi yetersiz

&#x20; - 429: istek sınırı aşıldı, otomatik 1 kez yeniden dene

&#x20; - Zaman aşımı ve ağ hatası

\- İsteğe bağlı: Her işlemden sonra kullanılan token sayısı durum çubuğunda küçük yazıyla gösterilsin.



\# ÖZELLİKLER



\## 1. Temel Editör (Word mantığı)

\- Biçimlendirme: Başlık 1-3, kalın, italik, altı çizili, üstü çizili, vurgulama rengi, yazı rengi, hizalama, madde ve numaralı liste, görev listesi, alıntı, yatay çizgi, tablo, görsel, link.

\- Linkler otomatik algılanacak. Ctrl+tık ile sistem tarayıcısında açılacak (shell.openExternal).

\- "Sayfa görünümü" (A4 beyaz sayfa, kenar boşluklu, ortalanmış) ve "Akış görünümü" (tam genişlik) arasında geçiş yapılabilecek.

\- Geri al / yinele, bul ve değiştir (Ctrl+F / Ctrl+H).

\- Kelime sayısı, karakter sayısı ve tahmini okuma süresi alt durum çubuğunda görünecek.

\- Sekmeli çoklu belge desteği olacak.

\- Otomatik kaydetme olacak (30 saniyede bir ve odak kaybında) ve kaydedilmemiş değişiklik göstergesi (•) bulunacak.

\- Kurtarma: Uygulama beklenmedik şekilde kapanırsa, açılışta kaydedilmemiş belge geri önerilecek.

\- Son açılan dosyalar listesi.

\- Tek kopya çalışma (app.requestSingleInstanceLock). Uygulama açıkken bir dosyaya çift tıklanırsa dosya mevcut pencerede yeni sekmede açılacak.

\- Windows dosya ilişkilendirme: electron-builder fileAssociations ile .docx, .md ve .txt dosyaları için "Birlikte aç → Kalem" çalışacak. Komut satırından gelen dosya yolu açılışta okunacak.

\- Pencere boyutu, konumu ve açık sekmeler kapanışta kaydedilip açılışta geri yüklenecek.



\## 2. Dosya Açma ve Dışa Aktarma

\- Açılabilen formatlar: .docx, .md, .txt, .html. Pandoc veya LibreOffice varsa ek olarak .odt, .rtf, .doc.

\- Dışa aktarılabilen formatlar: .docx, .pdf, .md, .html, .txt. Pandoc veya LibreOffice varsa ek olarak .odt, .rtf.

\- Dosya diyalogları main process'teki dialog.showOpenDialog / showSaveDialog ile açılacak.

\- Dosya sürükle-bırak ile de açılabilecek.

\- DOCX dönüşümünde korunması gerekenler: başlıklar, kalın/italik/altı çizili, listeler, tablolar, linkler, görseller, hizalama.

\- Kod ve Prompt blokları DOCX'e şu şekilde aktarılacak: gri arka planlı, tek hücreli tablo içinde, Consolas yazı tipiyle.

\- Dönüşümde kaybolan bir özellik varsa, kullanıcıya küçük bir bildirimle haber verilecek.



\## 3. "AI ile Makale" Butonu

\- Üst araç çubuğunda belirgin bir "✨ AI ile Makale" butonu olacak. Tıklanınca sade bir yan panel veya diyalog açılacak.

\- Alanlar:

&#x20; - Konu (zorunlu, çok satırlı)

&#x20; - Kelime aralığı: 200–400 / 400–600 / 600–800 / 800+ ve "Özel" (min–max girişi)

&#x20; - Ton: Bilgilendirici / Samimi / Resmi / İkna edici

&#x20; - Dil: Türkçe (varsayılan), İngilizce, Almanca, İspanyolca

&#x20; - İsteğe bağlı: Ek talimatlar (hedef kitle, anahtar kelimeler vb.)

\- Çıktı yapısı: Başlık (H1), giriş, ara başlıklı bölümler (H2/H3), sonuç. Model Markdown üretecek, bu çıktı TipTap düğümlerine dönüştürülecek.

\- Yazı imlecin bulunduğu konuma veya boş belgeye streaming ile akacak.

\- Yazım bitince gerçek kelime sayısı gösterilecek. Hedef aralığın dışında kaldıysa "Genişlet" veya "Kısalt" önerisi sunulacak.



\## 4. Seçim Menüsü (Bubble Menu)

Kullanıcı bir cümle veya paragraf seçtiğinde, seçimin üstünde küçük ve şık bir menü çıkacak:

\- ✍️ Daha uzun yaz

\- ✂️ Daha kısa yaz

\- ✅ Yazımı düzelt

\- 🎭 Tonu değiştir (alt menü: Resmi, Samimi, Akıcı)

\- 🔁 Yeniden ifade et

\- 🖼️ Görsel oluştur

\- 🌐 Seçimi çevir



Davranış:

\- Sonuç doğrudan uygulanmayacak. Seçimin altında, orijinal ve yeni metni karşılaştıran bir önizleme kartı çıkacak. Kartta şu butonlar olacak: "Değiştir", "Altına ekle", "Tekrar dene", "Vazgeç".

\- Seçili metnin biçimlendirmesi (kalın, link vb.) mümkün olduğunca korunacak.

\- Model yalnızca yeniden yazılmış metni döndürecek. Açıklama veya "İşte metniniz:" gibi ön ekler olmayacak. Bu, sistem prompt'unda net şekilde belirtilecek.



\## 5. "Hataları Düzelt" (Sayfa Geneli)

\- Araç çubuğunda "Hataları Düzelt" butonu olacak.

\- Kural: Yalnızca yazım, noktalama ve dil bilgisi hataları düzeltilecek. Anlam, üslup, kelime seçimi ve cümle yapısı DEĞİŞTİRİLMEYECEK.

\- Uygulama yöntemi (biçimlendirmeyi korumak için):

&#x20; 1. Belge blok blok (paragraf, başlık, liste öğesi) işlenecek.

&#x20; 2. Kod blokları ve Prompt blokları atlanacak.

&#x20; 3. Model her blok için JSON formatında düzeltme listesi döndürecek: \[{ "original": "...", "corrected": "...", "reason": "..." }].

&#x20; 4. Düzeltmeler metne doğrudan yazılmayacak. Önce editörde ilgili kelimelerin altı renkli çizgiyle işaretlenecek.

\- Sağ panelde düzeltme listesi gösterilecek. Her düzeltme tek tek kabul edilebilecek veya reddedilebilecek. Ayrıca "Tümünü kabul et" butonu olacak.

\- Uzun belgelerde bloklar paralel ama sınırlı sayıda (en fazla 3 eşzamanlı) istekle işlenecek ve ilerleme çubuğu gösterilecek.



\## 6. Çevir Butonu

\- Araç çubuğunda "Çevir" açılır menüsü olacak: İngilizce, Almanca, İspanyolca. Dil listesi Ayarlar'dan genişletilebilecek.

\- Çeviri mevcut belgeyi değiştirmeyecek. Yeni bir sekmede yeni bir belge oluşturacak. Belge adı "Orijinal Ad (EN)" formatında olacak.

\- Yapı birebir korunacak: başlık seviyeleri, listeler, tablolar, kalın/italik, linkler, görseller.

\- Kod blokları çevrilmeyecek. Prompt bloklarının çevrilip çevrilmeyeceği bir onay kutusuyla seçilecek (varsayılan: çevirme).

\- Çeviri blok blok yapılacak ve yeni sekmede canlı olarak dolacak.



\## 7. Görsel Oluşturma

\- Seçim menüsündeki "Görsel oluştur" seçeneğine tıklanınca akış şöyle ilerleyecek:

&#x20; 1. Metin modeli (deepseek/deepseek-v4.1-flash), seçili metinden İngilizce, detaylı bir görsel prompt'u üretecek.

&#x20; 2. Bu prompt küçük bir diyalogda düzenlenebilir olarak gösterilecek. Diyalogda şu seçenekler de olacak:

&#x20;    - Stil: Fotoğraf gerçekçi / İllüstrasyon / Minimal / 3D / Sulu boya

&#x20;    - En-boy oranı: 16:9, 1:1, 4:3

&#x20; 3. "Oluştur" butonuna basılınca görsel modeli (bytedance-seed/seedream-5-0-lite) çağrılacak ve bekleme sırasında bir yükleniyor iskeleti gösterilecek.

&#x20; 4. Görsel, seçili paragrafın hemen altına yerleştirilecek. İstenirse altına açıklama yazısı (caption) eklenebilecek.

\- Görseller base64 olarak belgeye gömülmeyecek. Main process tarafından %APPDATA%/Kalem/assets/ klasörüne PNG olarak kaydedilecek. Editörde bu dosyalar özel bir protokolle (ör. kalem-asset://) gösterilecek. Bu protokol protocol.handle ile tanımlanacak ve yalnızca assets klasörüne erişime izin verecek.

\- DOCX dışa aktarımda görseller dosyanın içine gömülecek.

\- Görselin üzerinde küçük bir menü olacak: "Yeniden oluştur", "Boyutlandır", "Farklı kaydet", "Sil".



\## 8. Özel Bloklar

\- "/" komut menüsü (slash menu) ile eklenecek. Ayrıca araç çubuğunda "Ekle" menüsü olacak.

\- Kod Bloğu:

&#x20; - Dil seçimi ve sözdizimi vurgulama

&#x20; - Satır numaraları

&#x20; - Tek tıkla "Kopyala" butonu

\- Prompt Bloğu:

&#x20; - Belirgin bir kart görünümünde olacak (sol kenarda vurgu rengi şerit, hafif farklı arka plan, "PROMPT" etiketi)

&#x20; - Monospace yazı tipi

&#x20; - Tek tıkla "Kopyala" butonu

&#x20; - İsteğe bağlı başlık alanı

\- Not / Uyarı / Bilgi kutuları: renkli callout blokları

\- Tüm bloklar sürükleme tutamacı (⋮⋮) ile yeniden sıralanabilecek.



\## 9. Ayarlar

\- API anahtarı (maskeli gösterim, değiştirme, test etme)

\- Metin modeli (varsayılan: deepseek/deepseek-v4.1-flash) ve görsel modeli (varsayılan: bytedance-seed/seedream-5-0-lite) seçimi (OpenRouter'dan canlı liste)

\- Varsayılan makale dili ve tonu

\- Tema: Açık / Koyu / Sistem (nativeTheme ile senkron)

\- Editör yazı tipi ve boyutu

\- Otomatik kaydetme aralığı

\- Pandoc ve LibreOffice algılama durumu



\# TASARIM İLKELERİ (GÖZ YORMAYAN, MODERN, İŞLEVSEL)

\- Referans estetik: Notion + iA Writer + Microsoft Word'ün sade modu.

\- Açık tema: sayfa #FFFFFF, çalışma alanı arka planı #F5F5F4, metin #1F2937.

\- Koyu tema: saf siyah yok. Arka plan #17181B, sayfa #1E1F23, metin #E5E7EB.

\- Tek vurgu rengi kullanılacak (sakin indigo #6366F1). AI özellikleri bu renkle ve ✨ ikonuyla ayırt edilecek.

\- Tipografi:

&#x20; - Arayüz: Inter

&#x20; - Editör gövdesi: 16px, satır yüksekliği 1.7, sayfa genişliği en fazla \~720px

&#x20; - Kod: JetBrains Mono veya Consolas

\- Pencere: frameless değil, ama titleBarStyle: "hidden" + titleBarOverlay ile Windows'un pencere butonları korunarak sade, temaya uyumlu bir başlık çubuğu.

\- Sade, tek satırlı bir araç çubuğu. Az kullanılan araçlar "..." menüsünde.

\- Odak modu (F11): araç çubukları gizlenir, sadece sayfa kalır.

\- Gölgeler çok hafif, köşeler 8px, animasyonlar 150ms.

\- AI işlemleri sırasında arayüz kilitlenmeyecek. İşlemin durumu küçük bir göstergeyle belirtilecek.

\- Klavye kısayolları:

&#x20; - Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S

&#x20; - Ctrl+J: AI ile Makale

&#x20; - Ctrl+Shift+E: Hataları düzelt

&#x20; - Ctrl+/: Blok menüsü

\- Erişilebilirlik: yeterli kontrast, klavye ile tam gezinme, focus halkaları.



\# SİSTEM PROMPTLARI

Tüm AI sistem prompt'larını src/main/ai/prompts.ts dosyasında merkezi olarak tut. Her görev için ayrı ve net bir sistem prompt'u yaz: makale, uzat, kısalt, düzelt, ton, çeviri, görsel prompt üretimi, sayfa geneli düzeltme (JSON). Her prompt şu kuralları içermeli:

\- Yalnızca istenen çıktıyı döndür. Açıklama, ön ek veya son ek ekleme.

\- Kaynak metnin dilini koru (çeviri görevi hariç).

\- Markdown veya JSON formatına kesinlikle uy (hangisi isteniyorsa).

JSON yanıtlarını doğrula (ör. zod ile). Geçersiz JSON gelirse bir kez yeniden iste.



\# PROJE YAPISI (öneri)

\- src/main/ (Electron main process)

&#x20; - index.ts: pencere, single-instance, dosya ilişkilendirme, menü

&#x20; - ipc.ts: tüm ipcMain.handle kayıtları

&#x20; - ai/openrouter.ts: istekler, streaming, iptal

&#x20; - ai/prompts.ts: sistem prompt'ları

&#x20; - keystore.ts: key.txt okuma ve safeStorage

&#x20; - convert.ts: Pandoc/LibreOffice köprüsü

&#x20; - files.ts: dosya işlemleri, assets, kalem-asset:// protokolü

&#x20; - pdf.ts: printToPDF

\- src/preload/index.ts: contextBridge API'si

\- src/shared/: IPC tipleri ve ortak modeller

\- src/renderer/ (React)

&#x20; - editor/: TipTap kurulumu

&#x20; - editor/extensions/: PromptBlock, Callout, SlashMenu, AIBubbleMenu, ProofreadMark

&#x20; - io/: docxImport.ts, docxExport.ts, markdown.ts

&#x20; - components/: Toolbar, Sidebar, Dialogs, Settings

&#x20; - store/: Zustand store'ları



\# GELİŞTİRME SIRASI (her adımda çalışan bir sürüm teslim et)

1\. electron-vite + React iskeleti, güvenli pencere ayarları, preload köprüsü, tema sistemi, temel TipTap editörü, sekmeler

2\. Dosya aç/kaydet: DOCX, MD, TXT, HTML. Dışa aktarma: DOCX, PDF (printToPDF), MD

3\. Kod bloğu, Prompt bloğu, callout'lar ve slash menü

4\. API anahtarı yönetimi (key.txt + safeStorage), OpenRouter servisi (main process), Ayarlar ekranı ve model listesi

5\. AI ile Makale (streaming)

6\. Seçim menüsü: uzat, kısalt, düzelt, ton, önizleme kartı

7\. Sayfa geneli Hataları Düzelt (JSON, işaretleme, kabul/ret paneli)

8\. Çeviri (yeni sekmede, yapı korumalı)

9\. Görsel oluşturma (Seedream), assets klasörü ve özel protokol

10\. Pandoc/LibreOffice köprüsü, dosya ilişkilendirme, single-instance, kurtarma, electron-builder ile NSIS kurulum dosyası



Koda başlamadan önce:

\- Klasör yapısını ve ana ekran yerleşimini (metin tabanlı wireframe) sun.

\- Kullanacağın kütüphane sürümlerini listele.

\- İki model ID'sinin OpenRouter'da mevcut olduğunu ve Seedream'in istek/yanıt formatını doğruladığını bildir.

Onayımı aldıktan sonra kodlamaya geç.



\# KABUL KRİTERLERİ

\- Uygulama Windows 10/11'de NSIS kurulum dosyasıyla kurulur ve terminal gerektirmeden çalışır.

\- Word'de oluşturulmuş başlıklı, listeli, tablolu, görselli bir .docx dosyası açılıp tekrar .docx olarak kaydedildiğinde Word'de düzgün görünür.

\- PDF dışa aktarımı A4 formatında, sayfa kenar boşluklarıyla ve blok stilleri korunarak çıkar.

\- "AI ile Makale" seçilen kelime aralığına ±%10 sapmayla uyar.

\- "Hataları Düzelt" metnin anlamını ve üslubunu değiştirmez. Sadece yazım, noktalama ve dil bilgisi hatalarını düzeltir. Her düzeltme tek tek reddedilebilir.

\- Çeviri yeni sekmede açılır ve orijinal belge değişmez.

\- Seedream ile oluşturulan görsel ilgili paragrafın altına yerleşir ve DOCX dışa aktarımında korunur.

\- Kod ve Prompt blokları tek tıkla kopyalanır.

\- API anahtarı hiçbir koşulda renderer'da, loglarda, paket içinde veya git geçmişinde görünmez.

\- Renderer'da Node.js API'lerine doğrudan erişim yoktur (contextIsolation + sandbox).

\- İnternet yokken editör ve dosya işlemleri sorunsuz çalışır. Yalnızca AI butonları "Bağlantı yok" uyarısı verir.



