export type DocumentFormat = 'docx' | 'md' | 'txt' | 'html' | 'odt' | 'rtf' | 'doc' | 'pdf';

export interface DocumentTab {
  id: string;
  title: string;
  docId?: string;
  content: string; // TipTap HTML or JSON string
  isDirty: boolean;
  format: DocumentFormat;
  lastSavedAt?: number;
}


export type WordCountOption = '200-400' | '400-600' | '600-800' | '800+' | 'custom';

export interface GenerateArticleOptions {
  topic: string;
  wordCount: WordCountOption;
  customWordCount?: string;
  tone: 'informative' | 'friendly' | 'formal' | 'persuasive' | string;
  language: 'tr' | 'en' | 'de' | 'es' | string;
  instructions?: string;
}

export type RewriteAction = 'longer' | 'shorter' | 'fix' | 'tone' | 'rephrase' | 'translate';

export interface RewriteOptions {
  text: string;
  action: RewriteAction;
  tone?: 'formal' | 'friendly' | 'fluent' | string;
  language?: string;
}

export interface ProofreadItem {
  id: string;
  original: string;
  corrected: string;
  reason: string;
  blockIndex: number;
}

export interface ImageGenOptions {
  prompt: string;
  style: 'photorealistic' | 'illustration' | 'minimalist' | '3d' | 'watercolor';
  aspectRatio: '16:9' | '1:1' | '4:3';
  selectedText?: string;
}

export interface AppSettings {
  hasApiKey: boolean;
  maskedApiKey?: string;
  textModel: string;
  imageModel: string;
  defaultLanguage: string;
  defaultTone: string;
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  autoSaveInterval: number; // in seconds
  hasPandoc: boolean;
  hasLibreOffice: boolean;
  autoCheckUpdates?: boolean;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateStatusData {
  status: UpdateStatus;
  version?: string;
  releaseNotes?: string;
  releaseDate?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  message?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  outputModalities?: string[];
  contextLength?: number;
}

export interface FileSaveResult {
  success: boolean;
  docId?: string;
  title?: string;
  error?: string;
  errorCode?: string;
  warning?: string;
  backupFileName?: string;
}

export interface FileOpenResult {
  success: boolean;
  docId?: string;
  title?: string;
  content?: string;
  format?: DocumentFormat;
  error?: string;
  details?: string;
  warning?: string;
}

export interface ShowSaveDialogResult {
  success: boolean;
  canceled: boolean;
  docId?: string;
  title?: string;
  format?: DocumentFormat;
  error?: string;
}

export interface KalemApi {
  window: {
    setTheme: (isDark: boolean) => Promise<boolean>;
    close: (force?: boolean) => Promise<boolean>;
    cancelClose: () => Promise<boolean>;
    promptingClose: () => Promise<boolean>;
    onRequestClose: (callback: () => void) => () => void;
  };
  dialog: {
    confirmClose: (documentTitle: string) => Promise<'save' | 'dont-save' | 'cancel'>;
    confirmOverwrite: (options: { targetTitle: string; isDirty: boolean }) => Promise<'overwrite' | 'cancel'>;
  };
  files: {
    open: () => Promise<FileOpenResult>;
    openDropped: (file: File) => Promise<FileOpenResult>;
    showSaveDialog: (defaultTitle: string, format: DocumentFormat) => Promise<ShowSaveDialogResult>;
    save: (docId: string, content: string | Uint8Array) => Promise<FileSaveResult>;
    unregister: (docId: string) => Promise<boolean>;
    exportPdf: (
      htmlContent: string,
      defaultTitle?: string
    ) => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
    saveAsset: (dataUrl: string) => Promise<any>;
    onOpenFile: (callback: (result: FileOpenResult) => void) => () => void;
  };
  ai: {
    getModels: () => Promise<any>;
    abort: (requestId: string) => Promise<boolean>;
    generateArticle: (
      requestId: string,
      options: GenerateArticleOptions,
      onChunk: (chunk: string) => void,
      onDone: (tokens?: number) => void,
      onError: (err: string) => void
    ) => () => void;
    rewrite: (
      requestId: string,
      options: RewriteOptions,
      onChunk: (chunk: string) => void,
      onDone: (tokens?: number) => void,
      onError: (err: string) => void
    ) => () => void;
    proofread: (
      requestId: string,
      blocks: Array<{ id: string; text: string; index: number }>,
      onProgress?: (progress: { processed: number; total: number }) => void
    ) => Promise<ProofreadItem[]>;
    translate: (
      requestId: string,
      text: string,
      targetLanguage: string,
      onChunk: (chunk: string) => void,
      onDone: (tokens?: number) => void,
      onError: (err: string) => void
    ) => () => void;
    generateImagePrompt: (text: string) => Promise<string>;
    generateImage: (options: ImageGenOptions) => Promise<{ assetUrl: string; totalTokens?: number }>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    save: (settings: Partial<AppSettings>) => Promise<boolean>;
    saveApiKey: (key: string) => Promise<any>;
    testApiKey: () => Promise<any>;
    importedFromPlaintext: () => Promise<boolean>;
    detectTools: () => Promise<any>;
  };
  updater: {
    check: () => Promise<{ success: boolean; isDevelopment?: boolean; message?: string; updateInfo?: any; error?: string }>;
    install: (options?: { hasDirtyTabs?: boolean; force?: boolean }) => Promise<any>;
    getVersion: () => Promise<string>;
    onStatus: (callback: (data: UpdateStatusData) => void) => () => void;
  };
}

