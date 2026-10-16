import { create } from 'zustand';
import { DocumentTab, AppSettings, ProofreadItem, DocumentFormat } from '../../../shared/types';

export interface SavedFormat {
  marks: Array<{ type: string; attrs?: Record<string, any> }>;
  textStyle?: Record<string, any>;
  textAlign?: string;
  lineHeight?: string;
}

interface AppState {
  tabs: DocumentTab[];
  activeTabId: string;
  viewMode: 'page' | 'stream';
  isFocusMode: boolean;
  pageMargin: 'normal' | 'narrow' | 'wide';
  pageOrientation: 'portrait' | 'landscape';
  
  // AI Status
  aiStatus: 'idle' | 'working' | 'error';
  aiStatusMessage?: string;
  lastTokensUsed?: number;
  currentRequestId?: string;

  // Dialogs & Panels
  isArticleOpen: boolean;
  isProofreadOpen: boolean;
  isImageOpen: boolean;
  isSettingsOpen: boolean;
  isToolbarMenuOpen: boolean;
  isNavigatorOpen: boolean;
  isSymbolsOpen: boolean;
  isStatsOpen: boolean;
  isFormatPainterActive: boolean;
  savedFormat: SavedFormat | null;
  selectedTextForAi?: string;

  // Proofread Results
  proofreadItems: ProofreadItem[];
  proofreadProgress: { processed: number; total: number } | null;

  // Settings
  settings: AppSettings;

  // Actions
  addTab: (title?: string, content?: string, docId?: string, format?: DocumentFormat) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  updateTabMeta: (id: string, meta: Partial<DocumentTab>) => void;
  setViewMode: (mode: 'page' | 'stream') => void;
  setPageMargin: (margin: 'normal' | 'narrow' | 'wide') => void;
  setPageOrientation: (orientation: 'portrait' | 'landscape') => void;
  toggleFocusMode: () => void;
  setAiStatus: (status: 'idle' | 'working' | 'error', message?: string, tokens?: number) => void;
  setCurrentRequestId: (id?: string) => void;
  setArticleOpen: (open: boolean) => void;
  setProofreadOpen: (open: boolean) => void;
  setImageOpen: (open: boolean, text?: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setToolbarMenuOpen: (open: boolean) => void;
  setNavigatorOpen: (open: boolean) => void;
  toggleNavigator: () => void;
  setSymbolsOpen: (open: boolean) => void;
  setStatsOpen: (open: boolean) => void;
  setSavedFormat: (format: SavedFormat | null, active?: boolean) => void;
  clearFormatPainter: () => void;
  setProofreadItems: (items: ProofreadItem[]) => void;
  removeProofreadItem: (id: string) => void;
  setProofreadProgress: (p: { processed: number; total: number } | null) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  hasApiKey: false,
  textModel: 'deepseek/deepseek-v4.1-flash',
  imageModel: 'bytedance-seed/seedream-5-0-lite',
  defaultLanguage: 'tr',
  defaultTone: 'informative',
  theme: 'system',
  fontSize: 16,
  autoSaveInterval: 30,
  hasPandoc: false,
  hasLibreOffice: false
};

const initialTabId = 'tab-1';
const initialTab: DocumentTab = {
  id: initialTabId,
  title: 'Adsız Belge 1',
  content: '<h1>Yapay Zeka Destekli Belgeye Hoş Geldiniz</h1><p>Yazmaya hemen başlayabilir veya üst kısımdaki <strong>✨ AI ile Makale</strong> butonunu kullanabilirsiniz.</p>',
  isDirty: false,
  format: 'docx'
};

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTabId,
  viewMode: 'page',
  isFocusMode: false,
  pageMargin: 'normal',
  pageOrientation: 'portrait',

  aiStatus: 'idle',
  aiStatusMessage: undefined,
  lastTokensUsed: undefined,
  currentRequestId: undefined,

  isArticleOpen: false,
  isProofreadOpen: false,
  isImageOpen: false,
  isSettingsOpen: false,
  isToolbarMenuOpen: false,
  isNavigatorOpen: false,
  isSymbolsOpen: false,
  isStatsOpen: false,
  isFormatPainterActive: false,
  savedFormat: null,
  selectedTextForAi: undefined,

  proofreadItems: [],
  proofreadProgress: null,

  settings: DEFAULT_SETTINGS,

  addTab: (title, content, docId, format = 'docx') => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tabNumber = get().tabs.length + 1;
    const newTab: DocumentTab = {
      id,
      title: title || `Adsız Belge ${tabNumber}`,
      content: content || '<p></p>',
      docId,
      isDirty: false,
      format
    };

    set(state => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id
    }));
    return id;
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const tabToClose = tabs.find((t) => t.id === id);
    if (tabToClose?.docId && typeof window !== 'undefined' && (window as any).kalem?.files?.unregister) {
      (window as any).kalem.files.unregister(tabToClose.docId).catch(() => {});
    }

    if (tabs.length === 1) {
      // If closing the only tab, reset to an empty untitled tab
      const newTab: DocumentTab = {
        id: `tab-${Date.now()}`,
        title: 'Adsız Belge 1',
        content: '<p></p>',
        isDirty: false,
        format: 'docx'
      };
      set({ tabs: [newTab], activeTabId: newTab.id });
      return;
    }

    const index = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    let nextActiveId = activeTabId;

    if (activeTabId === id) {
      const nextIndex = Math.max(0, index - 1);
      nextActiveId = newTabs[nextIndex].id;
    }

    set({ tabs: newTabs, activeTabId: nextActiveId });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabContent: (id, content) => {
    set(state => ({
      tabs: state.tabs.map(tab =>
        tab.id === id ? { ...tab, content, isDirty: true } : tab
      )
    }));
  },

  updateTabMeta: (id, meta) => {
    set(state => ({
      tabs: state.tabs.map(tab =>
        tab.id === id ? { ...tab, ...meta } : tab
      )
    }));
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setPageMargin: (margin) => set({ pageMargin: margin }),
  setPageOrientation: (orientation) => set({ pageOrientation: orientation }),
  toggleFocusMode: () => set(state => ({ isFocusMode: !state.isFocusMode })),

  setAiStatus: (status, message, tokens) => set({
    aiStatus: status,
    aiStatusMessage: message,
    lastTokensUsed: tokens !== undefined ? tokens : get().lastTokensUsed
  }),

  setCurrentRequestId: (id) => set({ currentRequestId: id }),

  setArticleOpen: (open) => set({ isArticleOpen: open }),
  setProofreadOpen: (open) => set({ isProofreadOpen: open }),
  setImageOpen: (open, text) => set({ isImageOpen: open, selectedTextForAi: text }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setToolbarMenuOpen: (open) => set({ isToolbarMenuOpen: open }),
  setNavigatorOpen: (open) => set({ isNavigatorOpen: open }),
  toggleNavigator: () => set(state => ({ isNavigatorOpen: !state.isNavigatorOpen })),
  setSymbolsOpen: (open) => set({ isSymbolsOpen: open }),
  setStatsOpen: (open) => set({ isStatsOpen: open }),
  setSavedFormat: (format, active = true) => set({ savedFormat: format, isFormatPainterActive: active }),
  clearFormatPainter: () => set({ savedFormat: null, isFormatPainterActive: false }),

  setProofreadItems: (items) => set({ proofreadItems: items }),
  removeProofreadItem: (id) => set(state => ({
    proofreadItems: state.proofreadItems.filter(item => item.id !== id)
  })),
  setProofreadProgress: (p) => set({ proofreadProgress: p }),

  updateSettings: (newSettings) => set(state => ({
    settings: { ...state.settings, ...newSettings }
  }))
}));
