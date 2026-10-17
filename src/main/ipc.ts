import { app, ipcMain, BrowserWindow, shell, nativeTheme, dialog } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import Store from 'electron-store';
import { clearCloseTimeout, stopCloseTimeout } from './index';
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
  ExportPdfSchema,
  UnregisterFileSchema,
  ConfirmOverwriteSchema
} from './ipcSchemas';
import { isValidSender, registerSecureHandler } from './ipcSecurity';
import { closeCoordinator } from './closeCoordinator';
import { autoUpdater } from './updater';

const store = new Store();

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // 0. Window chrome — keep native caption buttons in sync with the renderer theme
  registerSecureHandler('window:setTheme', async (_, isDark: boolean) => {
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
  registerSecureHandler('files:open', async () => {
    return showOpenFilePicker(mainWindow);
  });

  registerSecureHandler('files:openDropped', async (_, filePath: unknown) => {
    const validated = validateIpc(OpenDroppedFilePathSchema, { filePath });
    if (!validated.success) {
      return { success: false, error: validated.error };
    }
    return openDroppedFile(validated.data.filePath);
  });

  registerSecureHandler('files:showSaveDialog', async (_, defaultTitle: unknown, format: unknown) => {
    const validated = validateIpc(ShowSaveDialogSchema, { defaultTitle, format });
    if (!validated.success) {
      return { success: false, canceled: true, error: validated.error };
    }
    return showSaveFilePicker(mainWindow, validated.data.defaultTitle, validated.data.format);
  });

  registerSecureHandler('files:save', async (_, docId: unknown, content: unknown) => {
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

  registerSecureHandler('files:unregister', async (_, docId: unknown) => {
    const validated = validateIpc(UnregisterFileSchema, { docId });
    if (!validated.success) return false;
    return documentRegistry.unregister(validated.data.docId);
  });

  registerSecureHandler('dialog:confirmClose', async (_, documentTitle: unknown) => {
    const title = typeof documentTitle === 'string' && documentTitle.trim() ? documentTitle.trim() : 'Belge';
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Kaydet', 'Kaydetme', 'İptal'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Kaydedilmemiş Değişiklikler',
      message: `"${title}" belgesinde yaptığınız değişiklikleri kaydetmek istiyor musunuz?`,
      detail: 'Kaydetmezseniz yaptığınız tüm değişiklikler kaybolacaktır.'
    });
    return result.response === 0 ? 'save' : result.response === 1 ? 'dont-save' : 'cancel';
  });

  registerSecureHandler('dialog:confirmOverwrite', async (_, payload: unknown) => {
    const validated = validateIpc(ConfirmOverwriteSchema, payload);
    const title = validated.success ? validated.data.targetTitle : 'Belge';
    const isDirty = validated.success ? validated.data.isDirty : false;

    const message = isDirty
      ? `Bu dosya ("${title}") başka bir sekmede açık ve kaydedilmemiş değişiklikleri var.`
      : `Bu dosya ("${title}") başka bir sekmede açık.`;

    const detail = isDirty
      ? 'Üzerine yazılırsa o sekme kapatılacak ve kaydedilmemiş değişiklikleri kaybolacaktır.'
      : 'Üzerine yazılırsa o sekme kapatılacak.';

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['İptal', 'Üzerine Yaz'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: 'Dosya Başka Bir Sekmede Açık',
      message: `${message} ${detail}`,
      detail: 'Üzerine yazmak istiyor musunuz?'
    });

    return result.response === 1 ? 'overwrite' : 'cancel';
  });

  registerSecureHandler('window:close', async (_, force: unknown) => {
    closeCoordinator.clearCloseTimeout();
    if (force === true) {
      if (closeCoordinator.isInstallPending()) {
        closeCoordinator.setInstallPendingAfterSave(false);
        closeCoordinator.setAppQuitting(true);
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            store.set('windowBounds', mainWindow.getBounds());
          } catch {}
        }
        autoUpdater.quitAndInstall(false, true);
        return true;
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          store.set('windowBounds', mainWindow.getBounds());
        } catch {}
        mainWindow.destroy();
      }
      return true;
    }
    mainWindow.close();
    return true;
  });

  registerSecureHandler('window:cancelClose', async () => {
    closeCoordinator.setInstallPendingAfterSave(false);
    closeCoordinator.clearCloseTimeout();
    return true;
  });

  registerSecureHandler('window:promptingClose', async () => {
    closeCoordinator.stopCloseTimeout();
    return true;
  });

  registerSecureHandler('files:exportPdf', async (_, htmlContent: unknown, defaultTitle: unknown) => {
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
    return { success: true, canceled: false };
  });

  registerSecureHandler('files:saveAsset', async (_, dataUrl: unknown) => {
    const validated = validateIpc(SaveAssetSchema, { dataUrl });
    if (!validated.success) {
      throw new Error(validated.error);
    }
    return saveAssetImage(validated.data.dataUrl);
  });

  // 2. Settings Handlers
  registerSecureHandler('settings:get', async (): Promise<AppSettings> => {
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

  registerSecureHandler('settings:save', async (_, newSettings: Partial<AppSettings>) => {
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

  registerSecureHandler('settings:saveApiKey', async (_, key: string) => {
    if (!key || key.trim().length === 0) {
      removeApiKey();
      return { success: true };
    }
    const success = saveApiKey(key);
    return { success };
  });

  registerSecureHandler('settings:testApiKey', async () => {
    return testApiKey();
  });

  registerSecureHandler('settings:importedFromPlaintext', () => {
    return hasImportedFromPlaintext();
  });

  registerSecureHandler('tools:detect', async () => {
    return detectTools();
  });

  // 3. AI Handlers
  registerSecureHandler('ai:getModels', async () => {
    return fetchAvailableModels();
  });

  registerSecureHandler('ai:abort', (_, requestId: string) => {
    return abortAiRequest(requestId);
  });

  // Stream Article
  registerSecureHandler('ai:generateArticle', async (event, requestId: string, options: GenerateArticleOptions) => {
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
  registerSecureHandler('ai:rewrite', async (event, requestId: string, options: RewriteOptions) => {
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
  registerSecureHandler('ai:proofread', async (event, requestId: string, rawBlocks: Array<{ id: string; text: string; index: number }>) => {
    const validated = validateIpc(ProofreadBlocksSchema, rawBlocks);
    if (!validated.success) {
      throw new Error(validated.error);
    }

    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getProofreadSystemPrompt();
    const results: ProofreadItem[] = [];

    // Process blocks in parallel with limit of 3
    const concurrencyLimit = 3;
    const blocks = validated.data;
    const queue = [...blocks];
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
          total: blocks.length
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
  registerSecureHandler('ai:translate', async (event, requestId: string, text: string, targetLanguage: string) => {
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
  registerSecureHandler('ai:generateImagePrompt', async (_, text: string) => {
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
  registerSecureHandler('ai:generateImage', async (_, options: ImageGenOptions) => {
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
      totalTokens
    };
  });
}
