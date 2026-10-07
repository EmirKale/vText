import { ipcMain, BrowserWindow, shell, nativeTheme } from 'electron';
import Store from 'electron-store';
import {
  showOpenFilePicker,
  openFileByPath,
  showSaveFilePicker,
  saveFile,
  saveAssetImage
} from './files';
import { exportToPdf } from './pdf';
import { detectTools } from './convert';
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

const store = new Store();

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // 1. Filesystem Handlers
  ipcMain.handle('files:open', async (_, filePath?: string) => {
    if (filePath) {
      return openFileByPath(filePath);
    }
    return showOpenFilePicker(mainWindow);
  });

  ipcMain.handle('files:showSaveDialog', async (_, defaultTitle: string, format: any) => {
    return showSaveFilePicker(mainWindow, defaultTitle, format);
  });

  ipcMain.handle('files:save', async (_, filePath: string, content: string | Uint8Array) => {
    const data = typeof content === 'string' ? content : Buffer.from(content);
    return saveFile(filePath, data);
  });

  ipcMain.handle('files:exportPdf', async (_, htmlContent: string, outputPath: string) => {
    return exportToPdf(htmlContent, outputPath);
  });

  ipcMain.handle('files:saveAsset', async (_, dataUrl: string) => {
    return saveAssetImage(dataUrl);
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
    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getArticleSystemPrompt(options);

    await streamChat(
      requestId,
      textModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Konu: ${options.topic}\nEk Talimatlar: ${options.instructions || 'Yok'}` }
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
    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getRewriteSystemPrompt(options);

    await streamChat(
      requestId,
      textModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.text }
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
    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getProofreadSystemPrompt();
    const results: ProofreadItem[] = [];

    // Process blocks in parallel with limit of 3
    const concurrencyLimit = 3;
    const queue = [...blocks];
    let processedCount = 0;

    async function processBlock(block: { id: string; text: string; index: number }): Promise<void> {
      try {
        const { content, totalTokens } = await nonStreamChat(textModel, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: block.text }
        ]);

        // Clean JSON formatting if codeblock was returned
        let cleanJsonStr = content.trim();
        cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();

        const parsed = JSON.parse(cleanJsonStr);
        const validated = ProofreadSchema.safeParse(parsed);

        if (validated.success) {
          for (const item of validated.data) {
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
  ipcMain.handle('ai:translate', async (event, requestId: string, text: string, targetLanguage: string) => {
    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getTranslationSystemPrompt(targetLanguage);

    await streamChat(
      requestId,
      textModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
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
    const textModel = (store.get('textModel') as string) || DEFAULT_TEXT_MODEL;
    const systemPrompt = getImagePromptGeneratorSystemPrompt();

    const { content } = await nonStreamChat(textModel, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ]);
    return content.trim();
  });

  // Generate Image with Seedream or selected model
  ipcMain.handle('ai:generateImage', async (_, options: ImageGenOptions) => {
    const imageModel = (store.get('imageModel') as string) || DEFAULT_IMAGE_MODEL;

    // Incorporate style into prompt
    const styleMap: Record<string, string> = {
      photorealistic: 'photorealistic, high detail, DSLR quality',
      illustration: 'digital illustration, vibrant colors, artistic style',
      minimalist: 'minimalist, clean lines, simple composition, flat design',
      '3d': '3D render, octane render, volumetric lighting, realistic materials',
      watercolor: 'watercolor painting, soft brushstrokes, artistic, traditional media'
    };
    const styleHint = styleMap[options.style] || '';
    const styledPrompt = styleHint ? `${options.prompt}, ${styleHint}` : options.prompt;

    const { imageDataUrl, totalTokens } = await generateAiImage(imageModel, styledPrompt, options.aspectRatio);

    // Save image to %APPDATA%/Kalem/assets/
    const asset = await saveAssetImage(imageDataUrl);

    return {
      assetUrl: asset.assetUrl,
      filePath: asset.filePath,
      totalTokens
    };
  });
}
