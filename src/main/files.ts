import { app, dialog, protocol, net, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { DocumentFormat, FileOpenResult, FileSaveResult, ShowSaveDialogResult } from '../shared/types';
import { convertWithPandocOrLibreOffice } from './convert';
import { documentRegistry } from './registry';

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
  return openFileByPath(targetPath);
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

export async function openFileByPath(filePath: string): Promise<FileOpenResult> {
  try {
    const ext = path.extname(filePath).toLowerCase().replace('.', '') as DocumentFormat;
    const title = path.basename(filePath);

    // 1. Markdown, TXT, HTML
    if (ext === 'md' || ext === 'txt' || ext === 'html') {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const entry = documentRegistry.register(filePath, ext, title);
      return {
        success: true,
        docId: entry.docId,
        title: entry.title,
        content,
        format: ext
      };
    }

    // 2. DOCX (mammoth)
    if (ext === 'docx') {
      const buffer = await fs.promises.readFile(filePath);
      const mammothResult = await mammoth.convertToHtml({ buffer });
      const entry = documentRegistry.register(filePath, 'docx', title);
      return {
        success: true,
        docId: entry.docId,
        title: entry.title,
        content: mammothResult.value,
        format: 'docx',
        warning: mammothResult.messages.length > 0 ? mammothResult.messages.map((m) => m.message).join('\n') : undefined
      };
    }

    // 3. ODT, RTF, DOC (Pandoc / LibreOffice)
    if (ext === 'odt' || ext === 'rtf' || ext === 'doc') {
      const converted = await convertWithPandocOrLibreOffice(filePath, 'docx');
      if (converted.success && converted.outputPath) {
        const buffer = await fs.promises.readFile(converted.outputPath);
        const mammothResult = await mammoth.convertToHtml({ buffer });
        const entry = documentRegistry.register(filePath, ext, title);
        return {
          success: true,
          docId: entry.docId,
          title: entry.title,
          content: mammothResult.value,
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
    return {
      success: true,
      docId: entry.docId,
      filePath: entry.filePath,
      title: entry.title,
      content: rawContent,
      format: ext
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Dosya açılırken bir hata oluştu.'
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
  content: string | Buffer | Uint8Array
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

  // Write to a temporary file in the same directory, fsync, then atomic rename
  const tempPath = path.join(dir, `.${path.basename(entry.filePath)}.${crypto.randomUUID()}.tmp`);
  let fileHandle: fs.promises.FileHandle | null = null;

  try {
    fileHandle = await fs.promises.open(tempPath, 'w');
    await fileHandle.writeFile(content);
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;

    // Atomic replace on same filesystem
    await fs.promises.rename(tempPath, entry.filePath);
    documentRegistry.update(docId, { lastSavedAt: Date.now() });

    return {
      success: true,
      docId: entry.docId,
      title: entry.title
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
