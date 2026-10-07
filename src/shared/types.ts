export type DocumentFormat = 'docx' | 'md' | 'txt' | 'html' | 'odt' | 'rtf' | 'doc' | 'pdf';

export interface DocumentTab {
  id: string;
  title: string;
  filePath?: string;
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
  updateRepo?: string;
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
  filePath?: string;
  error?: string;
  warning?: string;
}

export interface FileOpenResult {
  success: boolean;
  filePath?: string;
  title?: string;
  content?: string;
  format?: DocumentFormat;
  error?: string;
  warning?: string;
}
