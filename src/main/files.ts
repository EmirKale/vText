import { app, dialog, protocol, net, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { DocumentFormat, FileOpenResult, FileSaveResult, ShowSaveDialogResult } from '../shared/types';
import { convertWithPandocOrLibreOffice } from './convert';
import { documentRegistry, normalizePath } from './registry';
import {
  isFileLastWrittenByVText,
  recordFileSavedByVText,
  computeBufferSha256
} from './backupRegistry';
import MarkdownIt from 'markdown-it';
import JSZip from 'jszip';
import { detectUnsupportedDocxFeatures } from './docxFeatureDetector';

const backedUpPaths = new Set<string>();

export function resetBackupTracker(): void {
  backedUpPaths.clear();
}

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
});

export function decodeTextBuffer(buffer: Buffer): string {
  // Check UTF-8 BOM: EF BB BF
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer.subarray(3));
  }
  // Check UTF-16 LE BOM: FF FE
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  }
  // Check UTF-16 BE BOM: FE FF
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  }
  // Try strict UTF-8
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Fallback to Windows-1254 (Turkish ANSI / CP1254)
    try {
      return new TextDecoder('windows-1254').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function plainTextToHtml(text: string): string {
  const paragraphs = text.split(/\r?\n\r?\n/);
  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '<p></p>';
      const lines = p.split(/\r?\n/).map((l) => escapeHtml(l)).join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('');
}

const SUPPORTED_EXTENSIONS = ['docx', 'md', 'txt', 'html', 'htm', 'odt', 'rtf', 'doc'];

export function getAssetsDir(): string {
  const dir = path.join(app.getPath('appData'), 'vText', 'assets');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function registerKalemAssetProtocol(): void {
  const handleAsset = async (request: Request) => {
    try {
      const parsedUrl = new URL(request.url);
      const filename = parsedUrl.hostname ? `${parsedUrl.hostname}${parsedUrl.pathname}` : parsedUrl.pathname.replace(/^\//, '');
      const safeFilename = path.basename(filename);
      const filePath = path.join(getAssetsDir(), safeFilename);
      const fallbackPath = path.join(app.getPath('appData'), 'Kalem', 'assets', safeFilename);

      const targetPath = fs.existsSync(filePath) ? filePath : fs.existsSync(fallbackPath) ? fallbackPath : null;

      if (!targetPath) {
        return new Response('Not Found', { status: 404 });
      }

      return net.fetch(`file://${targetPath}`);
    } catch {
      return new Response('Error', { status: 500 });
    }
  };

  protocol.handle('vtext-asset', handleAsset);
  protocol.handle('kalem-asset', handleAsset);
}

export async function saveAssetImage(dataUrl: string): Promise<{ assetUrl: string; filePath: string }> {
  const assetsDir = getAssetsDir();
  const id = crypto.randomUUID();
  const filename = `${id}.png`;
  const filePath = path.join(assetsDir, filename);

  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.promises.writeFile(filePath, buffer);

  return {
    assetUrl: `kalem-asset://${filename}`,
    filePath
  };
}

export async function showOpenFilePicker(browserWindow: BrowserWindow): Promise<FileOpenResult> {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Belge Aç',
    properties: ['openFile'],
    filters: [
      { name: 'Tüm Desteklenen Belgeler', extensions: ['docx', 'md', 'txt', 'html', 'htm', 'odt', 'rtf', 'doc'] },
      { name: 'Word Belgeleri (*.docx)', extensions: ['docx'] },
      { name: 'Markdown (*.md)', extensions: ['md', 'markdown'] },
      { name: 'Metin Dosyaları (*.txt)', extensions: ['txt'] },
      { name: 'HTML Belgeleri (*.html)', extensions: ['html', 'htm'] },
      { name: 'Diğer Formatlar (*.odt, *.rtf, *.doc)', extensions: ['odt', 'rtf', 'doc'] },
      { name: 'Tüm Dosyalar', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }

  const targetPath = result.filePaths[0];
  const openRes = await openFileByPath(targetPath);
  if (!openRes.success && openRes.error) {
    console.error(`[files:showOpenFilePicker] Belge açılamadı (${targetPath}): ${openRes.error} | Detay: ${openRes.details || 'Yok'}`);
    await dialog.showMessageBox(browserWindow, {
      type: 'error',
      title: 'Belge Açılamadı',
      message: openRes.error,
      detail: openRes.details,
      buttons: ['Tamam'],
      noLink: true
    });
  }
  return openRes;
}

export async function openDroppedFile(filePath: string): Promise<FileOpenResult> {
  try {
    if (!path.isAbsolute(filePath)) {
      return { success: false, error: 'Geçersiz dosya yolu (mutlak yol bekleniyor).' };
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Dosya sistemde bulunamadı.' };
    }

    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return { success: false, error: 'Seçilen öğe geçerli bir dosya değil.' };
    }

    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return { success: false, error: `Desteklenmeyen dosya uzantısı: .${ext}` };
    }

    return openFileByPath(filePath);
  } catch (err: any) {
    return { success: false, error: err.message || 'Sürüklenen dosya açılamadı.' };
  }
}

export async function sanitizeDocxTableHeaders(buffer: Buffer): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return buffer;

    const docXml = await docXmlFile.async('string');
    // Yalnızca w:val="off" | "false" | "0" olan geçersiz/kapatılmış w:tblHeader öğelerini kaldır
    // Böylece w:val yok/on/true/1 olanlar mammoth tarafından başlık sayılırken kapatılmış olanlar sayılmaz
    const sanitizedXml = docXml.replace(/<w:tblHeader\b[^>]*w:val=["'](?:off|false|0)["'][^>]*\/?>/gi, '');
    if (sanitizedXml !== docXml) {
      zip.file('word/document.xml', sanitizedXml);
      return await zip.generateAsync({ type: 'nodebuffer' });
    }
    return buffer;
  } catch {
    return buffer;
  }
}

export const MAMMOTH_STYLE_MAP = [
  "p[style-name='heading 1 center'] => h1.text-center:fresh",
  "p[style-name='heading 2 center'] => h2.text-center:fresh",
  "p[style-name='heading 3 center'] => h3.text-center:fresh",
  "p[style-name='heading 1 right'] => h1.text-right:fresh",
  "p[style-name='heading 2 right'] => h2.text-right:fresh",
  "p[style-name='heading 3 right'] => h3.text-right:fresh",
  "p[style-name='heading 1 justify'] => h1.text-justify:fresh",
  "p[style-name='heading 2 justify'] => h2.text-justify:fresh",
  "p[style-name='heading 3 justify'] => h3.text-justify:fresh",
  "p[style-name='align-center'] => p.text-center:fresh",
  "p[style-name='align-right'] => p.text-right:fresh",
  "p[style-name='align-justify'] => p.text-justify:fresh",
  "r[style-name='Emphasis'] => em",
  "r[style-name='emphasis'] => em",
  "r[style-name='Strong'] => strong",
  "r[style-name='strong'] => strong",
  "u => u"
];

export function preserveDocxStructureAndAlignment(docElement: any): any {
  if (!docElement) return docElement;

  function walk(el: any) {
    if (!el) return;

    if (el.type === 'paragraph' && el.alignment) {
      const origStyle = (el.styleName || el.styleId || '').toLowerCase();
      let alignSuffix = '';
      if (el.alignment === 'center') alignSuffix = 'center';
      else if (el.alignment === 'right' || el.alignment === 'end') alignSuffix = 'right';
      else if (el.alignment === 'both' || el.alignment === 'justify') alignSuffix = 'justify';

      if (alignSuffix) {
        if (origStyle.startsWith('heading')) {
          el.styleName = `${origStyle} ${alignSuffix}`;
        } else {
          el.styleName = `align-${alignSuffix}`;
        }
      }
    }

    if (Array.isArray(el.children)) {
      el.children.forEach(walk);
    }
  }

  walk(docElement);
  return docElement;
}

export function preserveDocxTableStructure(docElement: any): any {
  return preserveDocxStructureAndAlignment(docElement);
}

export function normalizeMammothHtml(rawHtml: string): string {
  if (!rawHtml) return rawHtml;
  return rawHtml
    .replace(/class="text-center"/g, 'style="text-align: center"')
    .replace(/class="text-right"/g, 'style="text-align: right"')
    .replace(/class="text-justify"/g, 'style="text-align: justify"');
}

export async function openFileByPath(filePath: string): Promise<FileOpenResult> {
  try {
    const ext = path.extname(filePath).toLowerCase().replace('.', '') as DocumentFormat;
    const title = path.basename(filePath);

    // 1. Markdown, TXT, HTML (B2: Encoding handling + B3: MD/TXT rendering)
    if (ext === 'md' || ext === 'txt' || ext === 'html') {
      const rawBuffer = await fs.promises.readFile(filePath);
      const decodedText = decodeTextBuffer(rawBuffer);
      let htmlContent: string;
      if (ext === 'md') {
        htmlContent = md.render(decodedText);
      } else if (ext === 'txt') {
        htmlContent = plainTextToHtml(decodedText);
      } else {
        htmlContent = decodedText;
      }

      const entry = documentRegistry.register(filePath, ext, title);
      entry.openedFromDisk = true;
      entry.wasLastSavedByVText = isFileLastWrittenByVText(filePath);
      if (!entry.wasLastSavedByVText) backedUpPaths.delete(normalizePath(filePath));
      return {
        success: true,
        docId: entry.docId,
        title: entry.title,
        content: htmlContent,
        format: ext
      };
    }

    // 2. DOCX (mammoth with B5: ignoreEmptyParagraphs: false)
    if (ext === 'docx') {
      const rawBuffer = await fs.promises.readFile(filePath);

      let zip: JSZip | null = null;
      // ODT tespit kontrolü: ZIP içinde word/document.xml yoksa ve mimetype ODT ise
      try {
        zip = await JSZip.loadAsync(rawBuffer);
        const hasDocumentXml = !!zip.file('word/document.xml');
        const mimetypeFile = zip.file('mimetype');
        const mimetype = mimetypeFile ? (await mimetypeFile.async('string')).trim() : '';

        if (!hasDocumentXml && (mimetype === 'application/vnd.oasis.opendocument.text' || zip.file('content.xml'))) {
          const errMsg = 'Bu dosya aslında bir ODT belgesi (uzantısı .docx yapılmış). LibreOffice\'te Farklı Kaydet > Word 2007-365 (.docx) ile kaydedip tekrar deneyin.';
          const errDetail = 'ZIP içinde word/document.xml bulunamadı. Belge OpenDocument (ODT) yapısındadır.';
          console.error(`[files:openFileByPath] ODT uzantı uyumsuzluğu (${filePath}): ${errMsg}`);
          return {
            success: false,
            error: errMsg,
            details: errDetail
          };
        }
      } catch (zipErr) {
        // Zip ayrıştırılamadıysa (0 bayt, bozuk vb.), aşağıdaki mammoth / catch bloğu yakalayacak
      }

      const buffer = await sanitizeDocxTableHeaders(rawBuffer);
      const mammothResult = await mammoth.convertToHtml(
        { buffer },
        {
          ignoreEmptyParagraphs: false,
          styleMap: MAMMOTH_STYLE_MAP,
          transformDocument: preserveDocxStructureAndAlignment
        }
      );

      let unsupportedWarning: string | undefined;
      let unsupportedFeatures: string[] | undefined;
      if (zip) {
        try {
          const unsupportedInfo = await detectUnsupportedDocxFeatures(zip, mammothResult.messages);
          if (unsupportedInfo.hasUnsupported) {
            unsupportedWarning = unsupportedInfo.warningMessage;
            unsupportedFeatures = unsupportedInfo.features;
          }
        } catch (detErr) {
          console.warn('[files:openFileByPath] Desteklenmeyen öğe tespiti hatası:', detErr);
        }
      }

      const entry = documentRegistry.register(filePath, 'docx', title);
      entry.openedFromDisk = true;
      entry.wasLastSavedByVText = isFileLastWrittenByVText(filePath);
      if (!entry.wasLastSavedByVText) backedUpPaths.delete(normalizePath(filePath));
      return {
        success: true,
        docId: entry.docId,
        title: entry.title,
        content: normalizeMammothHtml(mammothResult.value),
        format: 'docx',
        warning: unsupportedWarning || (mammothResult.messages.length > 0 ? mammothResult.messages.map((m) => m.message).join('\n') : undefined),
        unsupportedWarning,
        unsupportedFeatures
      };
    }

    // 3. ODT, RTF, DOC (Pandoc / LibreOffice with ignoreEmptyParagraphs: false)
    if (ext === 'odt' || ext === 'rtf' || ext === 'doc') {
      const converted = await convertWithPandocOrLibreOffice(filePath, 'docx');
      if (converted.success && converted.outputPath) {
        const buffer = await fs.promises.readFile(converted.outputPath);
        const mammothResult = await mammoth.convertToHtml(
          { buffer },
          {
            ignoreEmptyParagraphs: false,
            styleMap: MAMMOTH_STYLE_MAP,
            transformDocument: preserveDocxStructureAndAlignment
          }
        );
        const entry = documentRegistry.register(filePath, ext, title);
        entry.openedFromDisk = true;
        entry.wasLastSavedByVText = isFileLastWrittenByVText(filePath);
        if (!entry.wasLastSavedByVText) backedUpPaths.delete(normalizePath(filePath));
        return {
          success: true,
          docId: entry.docId,
          title: entry.title,
          content: normalizeMammothHtml(mammothResult.value),
          format: ext
        };
      } else {
        return {
          success: false,
          error: converted.error || `${ext.toUpperCase()} formatını dönüştürmek için sisteminizde Pandoc veya LibreOffice bulunamadı.`
        };
      }
    }

    // Fallback: try reading as UTF-8
    const rawContent = await fs.promises.readFile(filePath, 'utf8');
    const entry = documentRegistry.register(filePath, ext, title);
    entry.openedFromDisk = true;
    entry.wasLastSavedByVText = isFileLastWrittenByVText(filePath);
    if (!entry.wasLastSavedByVText) backedUpPaths.delete(normalizePath(filePath));
    return {
      success: true,
      docId: entry.docId,
      title: entry.title,
      content: rawContent,
      format: ext
    };
  } catch (err: any) {
    console.error(`[files:openFileByPath] Hata (${filePath}):`, err);
    return {
      success: false,
      error: 'Bu dosya açılamadı. Dosya bozuk, parola korumalı veya desteklenmeyen bir biçimde olabilir.',
      details: err?.message || String(err)
    };
  }
}

export async function showSaveFilePicker(
  browserWindow: BrowserWindow,
  defaultTitle: string,
  preferredFormat: DocumentFormat = 'docx'
): Promise<ShowSaveDialogResult> {
  // PDF ayrı bir dışa aktarma komutu olduğu için kayıt diyalogunda sunulmaz
  const safePreferred: DocumentFormat = preferredFormat === 'pdf' ? 'docx' : preferredFormat;

  const filterMap: Record<string, { name: string; extensions: string[] }> = {
    docx: { name: 'Word Belgesi (*.docx)', extensions: ['docx'] },
    md: { name: 'Markdown (*.md)', extensions: ['md'] },
    html: { name: 'HTML Belgesi (*.html)', extensions: ['html'] },
    txt: { name: 'Metin Dosyası (*.txt)', extensions: ['txt'] },
    odt: { name: 'OpenDocument Metni (*.odt)', extensions: ['odt'] },
    rtf: { name: 'Zengin Metin (*.rtf)', extensions: ['rtf'] },
    doc: { name: 'Word 97-2003 (*.doc)', extensions: ['doc'] }
  };

  const activeFilter = filterMap[safePreferred] || filterMap.docx;

  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Belgeyi Kaydet',
    defaultPath: defaultTitle.endsWith(`.${safePreferred}`) ? defaultTitle : `${defaultTitle}.${safePreferred}`,
    filters: [
      activeFilter,
      filterMap.docx,
      filterMap.md,
      filterMap.html,
      filterMap.txt
    ].filter((f, idx, arr) => arr.findIndex((x) => x.name === f.name) === idx)
  });

  if (result.canceled || !result.filePath) {
    return { success: true, canceled: true };
  }

  const chosenPath = result.filePath;
  const ext = path.extname(chosenPath).toLowerCase().replace('.', '') as DocumentFormat;
  const finalFormat = ext || safePreferred;
  const title = path.basename(chosenPath);

  const entry = documentRegistry.register(chosenPath, finalFormat, title);

  return {
    success: true,
    canceled: false,
    docId: entry.docId,
    title: entry.title,
    format: entry.format
  };
}

export async function saveFile(
  docId: string,
  content: string | Buffer | Uint8Array,
  targetWindow?: BrowserWindow
): Promise<FileSaveResult> {
  const entry = documentRegistry.get(docId);
  if (!entry) {
    return {
      success: false,
      error: 'Geçersiz belge kimliği veya oturum süresi dolmuş. Lütfen "Farklı Kaydet" seçeneğini kullanın.',
      errorCode: 'ERR_INVALID_DOC_ID'
    };
  }

  // 1. PDF saveFile ile kaydedilemez
  if (entry.format === 'pdf') {
    return {
      success: false,
      error: 'PDF dosyaları saveFile ile kaydedilemez; "PDF olarak dışa aktar" komutu kullanılmalıdır.',
      errorCode: 'ERR_INVALID_FORMAT'
    };
  }

  // 2. DOCX kontrolü: Yalnızca Buffer/Uint8Array kabul et ve "PK" (0x50 0x4B) sihirli baytlarını doğrula
  if (entry.format === 'docx') {
    if (typeof content === 'string') {
      return {
        success: false,
        error: 'DOCX belgesi metin olarak kaydedilemez; ikili veri (Buffer/Uint8Array) bekleniyor.',
        errorCode: 'ERR_INVALID_FORMAT'
      };
    }

    const buf = Buffer.isBuffer(content)
      ? content
      : Buffer.from(
          (content as any).buffer || content,
          (content as any).byteOffset || 0,
          (content as any).byteLength || content.length
        );

    if (buf.length < 2 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return {
        success: false,
        error: 'Geçersiz DOCX içeriği: dosya "PK" (0x50 0x4B) sihirli baytlarıyla başlamıyor.',
        errorCode: 'ERR_INVALID_FORMAT'
      };
    }
  }

  // 3. MD ve TXT kontrolü: Yalnızca string kabul et; Buffer/Uint8Array gelirse reddet, dosyaya HİÇBİR ŞEY yazma
  if (entry.format === 'md' || entry.format === 'txt') {
    if (typeof content !== 'string') {
      return {
        success: false,
        error: `${entry.format.toUpperCase()} belgesi ikili veri olarak kaydedilemez; düz metin (string) bekleniyor.`,
        errorCode: 'ERR_INVALID_FORMAT'
      };
    }
  }

  const dir = path.dirname(entry.filePath);
  if (!fs.existsSync(dir)) {
    return {
      success: false,
      error: 'Hedef dizin sistemde bulunamadı.',
      errorCode: 'ERR_DIR_NOT_FOUND'
    };
  }

  // GRUP 4: Diskten açılmış bir dosya ilk kez vText tarafından kaydedilirken,
  // yazmadan ÖNCE orijinalin kopyasını aynı klasöre "Ad (vText öncesi yedek).uzantı" olarak yaz.
  // Oturum başına dosya başına bir kez; aynı adlı yedek varsa üzerine yazma (sayı ekle). COPYFILE_EXCL kullan.
  const canonKey = normalizePath(entry.filePath);
  let backupFileName: string | undefined;

  const shouldSkipBackup = entry.wasLastSavedByVText === true || backedUpPaths.has(canonKey);

  if (entry.openedFromDisk && fs.existsSync(entry.filePath) && !shouldSkipBackup) {
    const ext = path.extname(entry.filePath);
    const baseName = path.basename(entry.filePath, ext);

    let backupSuccess = false;
    let counter = 1;

    try {
      while (!backupSuccess) {
        const suffix = counter === 1 ? ' (vText öncesi yedek)' : ` (vText öncesi yedek ${counter})`;
        const candidateName = `${baseName}${suffix}${ext}`;
        const candidatePath = path.join(dir, candidateName);

        try {
          await fs.promises.copyFile(entry.filePath, candidatePath, fs.constants.COPYFILE_EXCL);
          backupSuccess = true;
          backupFileName = candidateName;
          backedUpPaths.add(canonKey);
        } catch (copyErr: any) {
          if (copyErr.code === 'EEXIST') {
            counter++;
            continue;
          }
          throw copyErr;
        }
      }
    } catch (backupErr: any) {
      console.error(`[saveFile] Yedek oluşturulamadı (${entry.filePath}):`, backupErr);
      const win = targetWindow || (BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]);
      if (win) {
        const choice = await dialog.showMessageBox(win, {
          type: 'warning',
          title: 'Yedek Alınamadı',
          message: 'Yedek alınamadı. Yine de kaydetmek istiyor musunuz?',
          buttons: ['Kaydet', 'İptal'],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        });
        if (choice.response !== 0) {
          return {
            success: false,
            error: 'Kayıt iptal edildi: Orijinal dosyanın yedeği alınamadı.',
            errorCode: 'ERR_BACKUP_CANCELLED'
          };
        }
        // Kullanıcı "Kaydet" dediyse bu oturumda bu dosya için tekrar sorma
        backedUpPaths.add(canonKey);
      } else {
        return {
          success: false,
          error: 'Yedek alınamadı: ' + (backupErr?.message || String(backupErr)),
          errorCode: 'ERR_BACKUP_FAILED'
        };
      }
    }
  }

  // Write to a temporary file in the same directory, fsync, then atomic rename
  const tempPath = path.join(dir, `.${path.basename(entry.filePath)}.${crypto.randomUUID()}.tmp`);
  let fileHandle: fs.promises.FileHandle | null = null;

  try {
    fileHandle = await fs.promises.open(tempPath, 'w');
    if (entry.format === 'txt' && typeof content === 'string') {
      // B2: .txt için UTF-8 BOM ekle (Windows Not Defteri ve Windows araçları için)
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      await fileHandle.writeFile(Buffer.concat([bom, Buffer.from(content, 'utf8')]));
    } else {
      await fileHandle.writeFile(content);
    }
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;

    // Atomic replace on same filesystem
    await fs.promises.rename(tempPath, entry.filePath);
    documentRegistry.update(docId, { lastSavedAt: Date.now() });

    try {
      const writtenBuffer = await fs.promises.readFile(entry.filePath);
      recordFileSavedByVText(entry.filePath, computeBufferSha256(writtenBuffer));
      entry.wasLastSavedByVText = true;
      backedUpPaths.add(canonKey);
    } catch (regErr) {
      console.warn('[saveFile] backupRegistry kaydedilemedi:', regErr);
    }

    return {
      success: true,
      docId: entry.docId,
      title: entry.title,
      backupFileName
    };
  } catch (err: any) {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch {}
    }
    try {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch {}

    let errorCode = 'ERR_WRITE_FAILED';
    if (err.code === 'ENOENT') {
      errorCode = 'ERR_DIR_NOT_FOUND';
    } else if (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EROFS') {
      errorCode = 'ERR_PERMISSION_DENIED';
    }

    return {
      success: false,
      error: err.message || 'Dosya kaydedilemedi.',
      errorCode
    };
  }
}
