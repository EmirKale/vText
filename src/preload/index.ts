import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  GenerateArticleOptions,
  RewriteOptions,
  ProofreadItem,
  ImageGenOptions,
  AppSettings,
  DocumentFormat,
  UpdateStatusData,
  FileOpenResult,
  FileSaveResult,
  ShowSaveDialogResult
} from '../shared/types';

export const kalemApi = {
  window: {
    setTheme: (isDark: boolean) => ipcRenderer.invoke('window:setTheme', isDark),
    close: (force?: boolean): Promise<boolean> => ipcRenderer.invoke('window:close', force),
    cancelClose: (): Promise<boolean> => ipcRenderer.invoke('window:cancelClose'),
    promptingClose: (): Promise<boolean> => ipcRenderer.invoke('window:promptingClose'),
    onRequestClose: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('app:request-close-window', listener);
      return () => {
        ipcRenderer.removeListener('app:request-close-window', listener);
      };
    }
  },
  dialog: {
    confirmClose: (documentTitle: string): Promise<'save' | 'dont-save' | 'cancel'> =>
      ipcRenderer.invoke('dialog:confirmClose', documentTitle),
    confirmOverwrite: (options: { targetTitle: string; isDirty: boolean }): Promise<'overwrite' | 'cancel'> =>
      ipcRenderer.invoke('dialog:confirmOverwrite', options)
  },
  files: {
    open: (): Promise<FileOpenResult> => ipcRenderer.invoke('files:open'),
    openDropped: async (file: File): Promise<FileOpenResult> => {
      if (!file || typeof file !== 'object') {
        return { success: false, error: 'Geçersiz dosya nesnesi.' };
      }
      let filePath: string;
      try {
        filePath = webUtils.getPathForFile(file);
      } catch {
        return { success: false, error: 'Dosya yolu File nesnesinden alınamadı.' };
      }
      if (!filePath) {
        return { success: false, error: 'Dosya yolu alınamadı.' };
      }
      return ipcRenderer.invoke('files:openDropped', filePath);
    },
    showSaveDialog: (defaultTitle: string, format: DocumentFormat): Promise<ShowSaveDialogResult> =>
      ipcRenderer.invoke('files:showSaveDialog', defaultTitle, format),
    save: (docId: string, content: string | Uint8Array): Promise<FileSaveResult> =>
      ipcRenderer.invoke('files:save', docId, content),
    unregister: (docId: string): Promise<boolean> =>
      ipcRenderer.invoke('files:unregister', docId),
    exportPdf: (
      htmlContent: string,
      defaultTitle?: string
    ): Promise<{ success: boolean; canceled?: boolean; error?: string }> =>
      ipcRenderer.invoke('files:exportPdf', htmlContent, defaultTitle),
    saveAsset: (dataUrl: string) => ipcRenderer.invoke('files:saveAsset', dataUrl),
    onOpenFile: (callback: (result: FileOpenResult) => void) => {
      const listener = (_: any, result: FileOpenResult) => callback(result);
      ipcRenderer.on('app:open-file', listener);
      return () => {
        ipcRenderer.removeListener('app:open-file', listener);
      };
    }
  },
  ai: {
    getModels: () => ipcRenderer.invoke('ai:getModels'),
    abort: (requestId: string) => ipcRenderer.invoke('ai:abort', requestId),
    generateArticle: (
      requestId: string,
      options: GenerateArticleOptions,
      onChunk: (chunk: string) => void,
      onDone: (tokens?: number) => void,
      onError: (err: string) => void
    ) => {
      const chunkListener = (_: any, chunk: string) => onChunk(chunk);
      const doneListener = (_: any, data: any) => onDone(data?.tokens);
      const errorListener = (_: any, data: any) => onError(data?.error);

      ipcRenderer.on(`ai:stream-chunk:${requestId}`, chunkListener);
      ipcRenderer.on(`ai:stream-done:${requestId}`, doneListener);
      ipcRenderer.on(`ai:stream-error:${requestId}`, errorListener);

      ipcRenderer.invoke('ai:generateArticle', requestId, options);

      return () => {
        ipcRenderer.removeListener(`ai:stream-chunk:${requestId}`, chunkListener);
        ipcRenderer.removeListener(`ai:stream-done:${requestId}`, doneListener);
        ipcRenderer.removeListener(`ai:stream-error:${requestId}`, errorListener);
      };
    },
    rewrite: (
      requestId: string,
      options: RewriteOptions,
      onChunk: (chunk: string) => void,
      onDone: (tokens?: number) => void,
      onError: (err: string) => void
    ) => {
      const chunkListener = (_: any, chunk: string) => onChunk(chunk);
      const doneListener = (_: any, data: any) => onDone(data?.tokens);
      const errorListener = (_: any, data: any) => onError(data?.error);

      ipcRenderer.on(`ai:stream-chunk:${requestId}`, chunkListener);
      ipcRenderer.on(`ai:stream-done:${requestId}`, doneListener);
      ipcRenderer.on(`ai:stream-error:${requestId}`, errorListener);

      ipcRenderer.invoke('ai:rewrite', requestId, options);

      return () => {
        ipcRenderer.removeListener(`ai:stream-chunk:${requestId}`, chunkListener);
        ipcRenderer.removeListener(`ai:stream-done:${requestId}`, doneListener);
        ipcRenderer.removeListener(`ai:stream-error:${requestId}`, errorListener);
      };
    },
    proofread: (
      requestId: string,
      blocks: Array<{ id: string; text: string; index: number }>,
      onProgress?: (progress: { processed: number; total: number }) => void
    ): Promise<ProofreadItem[]> => {
      if (onProgress) {
        const progListener = (_: any, p: any) => onProgress(p);
        ipcRenderer.on(`ai:proofread-progress:${requestId}`, progListener);
      }
      return ipcRenderer.invoke('ai:proofread', requestId, blocks);
    },
    translate: (
      requestId: string,
      text: string,
      targetLanguage: string,
      onChunk: (chunk: string) => void,
      onDone: (tokens?: number) => void,
      onError: (err: string) => void
    ) => {
      const chunkListener = (_: any, chunk: string) => onChunk(chunk);
      const doneListener = (_: any, data: any) => onDone(data?.tokens);
      const errorListener = (_: any, data: any) => onError(data?.error);

      ipcRenderer.on(`ai:stream-chunk:${requestId}`, chunkListener);
      ipcRenderer.on(`ai:stream-done:${requestId}`, doneListener);
      ipcRenderer.on(`ai:stream-error:${requestId}`, errorListener);

      ipcRenderer.invoke('ai:translate', requestId, text, targetLanguage);

      return () => {
        ipcRenderer.removeListener(`ai:stream-chunk:${requestId}`, chunkListener);
        ipcRenderer.removeListener(`ai:stream-done:${requestId}`, doneListener);
        ipcRenderer.removeListener(`ai:stream-error:${requestId}`, errorListener);
      };
    },
    generateImagePrompt: (text: string): Promise<string> =>
      ipcRenderer.invoke('ai:generateImagePrompt', text),
    generateImage: (options: ImageGenOptions): Promise<{ assetUrl: string; totalTokens?: number }> =>
      ipcRenderer.invoke('ai:generateImage', options)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    save: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:save', settings),
    saveApiKey: (key: string) => ipcRenderer.invoke('settings:saveApiKey', key),
    testApiKey: () => ipcRenderer.invoke('settings:testApiKey'),
    importedFromPlaintext: () => ipcRenderer.invoke('settings:importedFromPlaintext'),
    detectTools: () => ipcRenderer.invoke('tools:detect')
  },
  updater: {
    check: (): Promise<{ success: boolean; isDevelopment?: boolean; message?: string; updateInfo?: any; error?: string }> =>
      ipcRenderer.invoke('updater:check'),
    install: (options?: { hasDirtyTabs?: boolean; force?: boolean }): Promise<any> =>
      ipcRenderer.invoke('updater:install', options),
    getVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),
    onStatus: (callback: (data: UpdateStatusData) => void) => {
      const listener = (_: any, data: UpdateStatusData) => callback(data);
      ipcRenderer.on('updater:status', listener);
      return () => {
        ipcRenderer.removeListener('updater:status', listener);
      };
    }
  }
};

contextBridge.exposeInMainWorld('kalem', kalemApi);
contextBridge.exposeInMainWorld('vtext', kalemApi);
