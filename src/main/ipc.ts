import { ipcMain, BrowserWindow, shell, nativeTheme, dialog } from 'electron';
import Store from 'electron-store';
import {
  showOpenFilePicker,
  openFileByPath,
  openDroppedFile,
  showSaveFilePicker,
  saveFile,
  saveAssetImage
} from './files';
import { exportToPdf } from './pdf';
import { detectTools } from './convert';
import { documentRegistry } from './registry';
import {
  getApiKey,
  saveApiKey,
  removeApiKey,
  getMaskedApiKey,
  testApiKey,
  hasImportedFromPlaintext
} from './keystore';
import {
  fetchAvailableModels,
  streamChat,
  nonStreamChat,
  generateAiImage,
  abortAiRequest,
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL
} from './ai/openrouter';
import {
  getArticleSystemPrompt,
  getRewriteSystemPrompt,
  getProofreadSystemPrompt,
  getTranslationSystemPrompt,
  getImagePromptGeneratorSystemPrompt,
  ProofreadSchema
} from './ai/prompts';
import {
  AppSettings,
  GenerateArticleOptions,
  RewriteOptions,
  ProofreadItem,
  ImageGenOptions
} from '../shared/types';
import {
  validateIpc,
  ShowSaveDialogSchema,
  SaveFileSchema,
  SaveAssetSchema,
  OpenDroppedFilePathSchema,
  GenerateArticleSchema,
  RewriteSchema,
  ProofreadBlocksSchema,
  TranslateSchema,
  ImagePromptSchema,
  ImageGenSchema,
  ExportPdfSchema
} from './ipcSchemas';

const store = new Store();

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // 0. Window chrome — keep native caption buttons in sync with the renderer theme
  ipcMain.handle('window:setTheme', async (_, isDark: boolean) => {
    try {
      mainWindow.setTitleBarOverlay({
        color: isDark ? '#13191C' : '#F0F3F0',
        symbolColor: isDark ? '#E2E7E3' : '#1C2523',
        height: 40
      });
    } catch {
      // setTitleBarOverlay is unavailable on some platforms
    }
  });

  // 1. Filesystem Handlers (Hardened: No raw file paths accepted from renderer)
  ipcMain.handle('files:open', async () => {
    return showOpenFilePicker(mainWindow);
  });

  ipcMain.handle('files:openDropped', async (_, filePath: unknown) => {
    const validated = validateIpc(OpenDroppedFilePathSchema, { filePath });
    if (!validated.success) {
      return { success: false, error: validated.error };
    }
    return openDroppedFile(validated.data.filePath);
  });

  ipcMain.handle('files:showSaveDialog', async (_, defaultTitle: unknown, format: unknown) => {
    const validated = validateIpc(ShowSaveDialogSchema, { defaultTitle, format });
    if (!validated.success) {
      return { success: false, canceled: true, error: validated.error };
    }
    return showSaveFilePicker(mainWindow, validated.data.defaultTitle, validated.data.format);
  });

  ipcMain.handle('files:save', async (_, docId: unknown, content: unknown) => {
    const validated = validateIpc(SaveFileSchema, { docId, content });
    if (!validated.success) {
      return { success: false, error: validated.error };
    }

    const data = typeof validated.data.content === 'string'
      ? validated.data.content
      : Buffer.from(
          (validated.data.content as any).buffer || validated.data.content,
          (validated.data.content as any).byteOffset || 0,
          (validated.data.content as any).byteLength || (validated.data.content as any).length
        );

    return saveFile(validated.data.docId, data);
  });

  ipcMain.handle('files:unregister', async (_, docId: unknown) => {
    if (typeof docId === 'string' && docId) {
      return documentRegistry.unregister(docId);
    }
    return false;
  });

  ipcMain.handle('files:exportPdf', async (_, htmlContent: unknown, defaultTitle: unknown) => {
    const validated = validateIpc(ExportPdfSchema, { htmlContent, defaultTitle });
    if (!validated.success) {
      return { success: false, error: validated.error };
    }

    const baseTitle = (typeof validated.data.defaultTitle === 'string' && validated.data.defaultTitle.trim())
      ? validated.data.defaultTitle.trim().replace(/\.pdf$/i, '')
      : 'Belge';

    const saveRes = await dialog.showSaveDialog(mainWindow, {
      title: 'PDF Olarak Dışa Aktar',
      defaultPath: `${baseTitle}.pdf`,
      filters: [{ name: 'PDF Belgesi (*.pdf)', extensions: ['pdf'] }]
    });

    if (saveRes.canceled || !saveRes.filePath) {
      return { success: true, canceled: true };
    }

    const success = await exportToPdf(validated.data.htmlContent, saveRes.filePath);
    if (!success) {
      return { success: false, error: 'PDF dosyası oluşturulamadı.' };
    }
    return { success: true, canceled: false, filePath: saveRes.filePath };
  });

  ipcMain.handle('files:saveAsset', async (_, dataUrl: unknown) => {
    const validated = validateIpc(SaveAssetSchema, { dataUrl });
    if (!validated.success) {
      throw new Error(validated.error);
    }
    return saveAssetImage(validated.data.dataUrl);
  });

  // 2. Settings Handlers
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    const tools = await detectTools();
    const hasKey = !!getApiKey();
    const masked = getMaskedApiKey();

    return {
      hasApiKey: hasKey,
      maskedApiKey: masked,
      textModel: (store.get('textModel') as string) || DEFAULT_TEXT_MODEL,
      imageModel: (store.get('imageModel') as string) || DEFAULT_IMAGE_MODEL,
      defaultLanguage: (store.get('defaultLanguage') as string) || 'tr',
      defaultTone: (store.get('defaultTone') as string) || 'informative',
      theme: (store.get('theme') as any) || 'system',
      fontSize: (store.get('fontSize') as number) || 16,
      autoSaveInterval: (store.get('autoSaveInterval') as number) || 30,
      hasPandoc: tools.hasPandoc,
      hasLibreOffice: tools.hasLibreOffice,
      updateRepo: (store.get('updateRepo') as string) || '',
      autoCheckUpdates: (store.get('autoCheckUpdates') as boolean) ?? true
    };
  });

  ipcMain.handle('settings:save', async (_, newSettings: Partial<AppSettings>) => {
    if (newSettings.textModel) store.set('textModel', newSettings.textModel);
    if (newSettings.imageModel) store.set('imageModel', newSettings.imageModel);
    if (newSettings.defaultLanguage) store.set('defaultLanguage', newSettings.defaultLanguage);
    if (newSettings.defaultTone) store.set('defaultTone', newSettings.defaultTone);
    if (newSettings.theme) {
      store.set('theme', newSettings.theme);
      if (newSettings.theme === 'dark') nativeTheme.themeSource = 'dark';
      else if (newSettings.theme === 'light') nativeTheme.themeSource = 'light';
      else nativeTheme.themeSource = 'system';
    }
    if (newSettings.fontSize) store.set('fontSize', newSettings.fontSize);
    if (newSettings.autoSaveInterval) store.set('autoSaveInterval', newSettings.autoSaveInterval);
    if (newSettings.updateRepo !== undefined) store.set('updateRepo', newSettings.updateRepo);
    if (newSettings.autoCheckUpdates !== undefined) store.set('autoCheckUpdates', newSettings.autoCheckUpdates);
    return true;
  });

  ipcMain.handle('settings:saveApiKey', async (_, key: string) => {
    if (!key || key.trim().length === 0) {
      removeApiKey();
      return { success: true };
    }
    const success = saveApiKey(key);
    return { success };
  });

  ipcMain.handle('settings:testApiKey', async () => {
    return testApiKey();
  });

  ipcMain.handle('settings:importedFromPlaintext', () => {
    return hasImportedFromPlaintext();
  });

  ipcMain.handle('tools:detect', async () => {
    return detectTools();
  });

  // 3. AI Handlers
  ipcMain.handle('ai:getModels', async () => {
    return fetchAvailableModels();
  });

  ipcMain.handle('ai:abort', (_, requestId: string) => {
    return abortAiRequest(requestId);
  });

  // Stream Article
  ipcMain.handle('ai:generateArticle', async (event, requestId: string, options: GenerateArticleOptions) => {
    const validated = validateIpc(GenerateArticleSchema, options);
    if (!validated.success) {
      event.sender.send(`ai:stream-error:${requestId}`, { error: validated.error });
      return;
    }

    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getArticleSystemPrompt(validated.data as any);

    await streamChat(
      requestId,
      textModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Konu: ${validated.data.topic}\nEk Talimatlar: ${validated.data.instructions || 'Yok'}` }
      ],
      {
        onChunk: (chunk) => event.sender.send(`ai:stream-chunk:${requestId}`, chunk),
        onDone: (tokens) => event.sender.send(`ai:stream-done:${requestId}`, { tokens }),
        onError: (err) => event.sender.send(`ai:stream-error:${requestId}`, { error: err })
      }
    );
  });

  // Stream Rewrite
  ipcMain.handle('ai:rewrite', async (event, requestId: string, options: RewriteOptions) => {
    const validated = validateIpc(RewriteSchema, options);
    if (!validated.success) {
      event.sender.send(`ai:stream-error:${requestId}`, { error: validated.error });
      return;
    }

    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getRewriteSystemPrompt(validated.data as any);

    await streamChat(
      requestId,
      textModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: validated.data.text }
      ],
      {
        onChunk: (chunk) => event.sender.send(`ai:stream-chunk:${requestId}`, chunk),
        onDone: (tokens) => event.sender.send(`ai:stream-done:${requestId}`, { tokens }),
        onError: (err) => event.sender.send(`ai:stream-error:${requestId}`, { error: err })
      }
    );
  });

  // Proofread Page (Process blocks and return structured JSON)
  ipcMain.handle('ai:proofread', async (event, requestId: string, blocks: Array<{ id: string; text: string; index: number }>) => {
    const validated = validateIpc(ProofreadBlocksSchema, blocks);
    if (!validated.success) {
      throw new Error(validated.error);
    }

    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getProofreadSystemPrompt();
    const results: ProofreadItem[] = [];

    // Process blocks in parallel with limit of 3
    const concurrencyLimit = 3;
    const queue = [...validated.data];
    let processedCount = 0;

    async function processBlock(block: { id: string; text: string; index: number }): Promise<void> {
      try {
        const { content } = await nonStreamChat(textModel, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: block.text }
        ]);

        // Clean JSON formatting if codeblock was returned
        let cleanJsonStr = content.trim();
        cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();

        const parsed = JSON.parse(cleanJsonStr);
        const parsedValidation = ProofreadSchema.safeParse(parsed);

        if (parsedValidation.success) {
          for (const item of parsedValidation.data) {
            results.push({
              id: `${block.id}-${Math.random().toString(36).slice(2, 7)}`,
              original: item.original,
              corrected: item.corrected,
              reason: item.reason,
              blockIndex: block.index
            });
          }
        }
      } catch {
        // Fallback: Skip block on parsing error
      } finally {
        processedCount++;
        event.sender.send(`ai:proofread-progress:${requestId}`, {
          processed: processedCount,
          total: validated.data.length
        });
      }
    }

    // Proper async pool with concurrency limit
    const running = new Set<Promise<void>>();
    for (const b of queue) {
      const p = processBlock(b).then(() => { running.delete(p); });
      running.add(p);
      if (running.size >= concurrencyLimit) {
        await Promise.race(running);
      }
    }

    await Promise.all(running);
    return results;
  });

  // Translation (Stream translated section)
  ipcMain.handle('ai:translate', async (event, requestId: string, text: string, targetLanguage: string) => {
    const validated = validateIpc(TranslateSchema, { text, targetLanguage });
    if (!validated.success) {
      event.sender.send(`ai:stream-error:${requestId}`, { error: validated.error });
      return;
    }

    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getTranslationSystemPrompt(validated.data.targetLanguage);

    await streamChat(
      requestId,
      textModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: validated.data.text }
      ],
      {
        onChunk: (chunk) => event.sender.send(`ai:stream-chunk:${requestId}`, chunk),
        onDone: (tokens) => event.sender.send(`ai:stream-done:${requestId}`, { tokens }),
        onError: (err) => event.sender.send(`ai:stream-error:${requestId}`, { error: err })
      }
    );
  });

  // Generate Image Prompt from Text
  ipcMain.handle('ai:generateImagePrompt', async (_, text: string) => {
    const validated = validateIpc(ImagePromptSchema, { text });
    if (!validated.success) {
      throw new Error(validated.error);
    }

    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getImagePromptGeneratorSystemPrompt();

    const { content } = await nonStreamChat(textModel, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: validated.data.text }
    ]);
    return content.trim();
  });

  // Generate Image with Seedream or selected model
  ipcMain.handle('ai:generateImage', async (_, options: ImageGenOptions) => {
    const validated = validateIpc(ImageGenSchema, options);
    if (!validated.success) {
      throw new Error(validated.error);
    }

    const imageModel = (store.get('imageModel') as string) || DEFAULT_IMAGE_MODEL;

    // Incorporate style into prompt
    const styleMap: Record<string, string> = {
      photorealistic: 'photorealistic, high detail, DSLR quality',
      illustration: 'digital illustration, vibrant colors, artistic style',
      minimalist: 'minimalist, clean lines, simple composition, flat design',
      '3d': '3D render, octane render, volumetric lighting, realistic materials',
      watercolor: 'watercolor painting, soft brushstrokes, artistic, traditional media'
    };
    const styleHint = styleMap[validated.data.style] || '';
    const styledPrompt = styleHint ? `${validated.data.prompt}, ${styleHint}` : validated.data.prompt;

    const { imageDataUrl, totalTokens } = await generateAiImage(imageModel, styledPrompt, validated.data.aspectRatio);

    // Save image to %APPDATA%/vText/assets/
    const asset = await saveAssetImage(imageDataUrl);

    return {
      assetUrl: asset.assetUrl,
      filePath: asset.filePath,
      totalTokens
    };
  });
}
