// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { App } from '../src/renderer/src/App';
import { useAppStore } from '../src/renderer/src/store/useAppStore';

vi.mock('../src/renderer/src/components/BubbleMenuCard', () => ({
  BubbleMenuCard: () => null
}));

vi.mock('../src/renderer/src/components/ImageBubbleMenu', () => ({
  ImageBubbleMenu: () => null
}));

describe('App.tsx Component Level Render Tests (Testing Library)', () => {
  let closeCallback: (() => void) | null = null;
  let mockConfirmClose: ReturnType<typeof vi.fn>;
  let mockConfirmOverwrite: ReturnType<typeof vi.fn>;
  let mockShowSaveDialog: ReturnType<typeof vi.fn>;
  let mockSaveFile: ReturnType<typeof vi.fn>;
  let mockCloseWindow: ReturnType<typeof vi.fn>;
  let mockCancelClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup jsdom globals
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // Range / selection polyfills for TipTap in jsdom
    document.createRange = () => {
      const range = new Range();
      range.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        toJSON: () => {}
      });
      range.getClientRects = () => ({
        item: () => null,
        length: 0,
        [Symbol.iterator]: function* () {}
      });
      return range;
    };

    // Reset mocks
    closeCallback = null;
    mockConfirmClose = vi.fn();
    mockConfirmOverwrite = vi.fn();
    mockShowSaveDialog = vi.fn();
    mockSaveFile = vi.fn().mockResolvedValue({ success: true });
    mockCloseWindow = vi.fn().mockResolvedValue(true);
    mockCancelClose = vi.fn().mockResolvedValue(true);

    // Mock window.kalem
    (window as any).kalem = {
      window: {
        setTheme: vi.fn(),
        close: mockCloseWindow,
        cancelClose: mockCancelClose,
        onRequestClose: (cb: () => void) => {
          closeCallback = cb;
          return () => {
            closeCallback = null;
          };
        }
      },
      dialog: {
        confirmClose: mockConfirmClose,
        confirmOverwrite: mockConfirmOverwrite
      },
      files: {
        open: vi.fn(),
        showSaveDialog: mockShowSaveDialog,
        save: mockSaveFile,
        unregister: vi.fn().mockResolvedValue(true),
        exportPdf: vi.fn().mockResolvedValue({ success: true, canceled: false }),
        onOpenFile: vi.fn().mockReturnValue(() => {})
      },
      settings: {
        get: vi.fn().mockResolvedValue({
          theme: 'light',
          fontSize: 16,
          autoSaveInterval: 30,
          hasApiKey: false,
          textModel: 'model-a',
          imageModel: 'model-b',
          defaultLanguage: 'tr',
          defaultTone: 'informative',
          hasPandoc: false,
          hasLibreOffice: false
        }),
        save: vi.fn()
      },
      ai: {
        getModels: vi.fn().mockResolvedValue([])
      }
    };

    // Reset store state
    useAppStore.setState({
      tabs: [
        {
          id: 'tab-1',
          title: 'Adsız Belge 1',
          content: '<p>Merhaba Dunya</p>',
          isDirty: false,
          format: 'docx',
          docId: undefined
        }
      ],
      activeTabId: 'tab-1'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. App Bileşeni Render Testi: handleSaveFile akışı diyalog açar, dosyayı kaydeder ve tab meta güncellenir', async () => {
    mockShowSaveDialog.mockResolvedValue({
      success: true,
      canceled: false,
      docId: 'doc-saved-123',
      title: 'rapor.docx',
      format: 'docx'
    });

    render(<App />);

    // Editorün DOM'a monte edilip editorInstance'ın set edilmesini bekle
    await waitFor(() => {
      expect(document.querySelector('[contenteditable="true"]')).not.toBeNull();
    });

    // Sekmeyi kirli (isDirty) yapalım
    act(() => {
      useAppStore.getState().updateTabContent('tab-1', '<p>Yeni degisiklik</p>');
    });
    expect(useAppStore.getState().tabs[0].isDirty).toBe(true);

    // Ctrl+S tuş kombinasyonuyla handleSaveFile tetiklenir
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    });

    await waitFor(() => {
      expect(mockShowSaveDialog).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSaveFile).toHaveBeenCalledWith('doc-saved-123', expect.any(Object));
    });

    await waitFor(() => {
      const tab = useAppStore.getState().tabs[0];
      expect(tab.docId).toBe('doc-saved-123');
      expect(tab.title).toBe('rapor.docx');
      expect(tab.isDirty).toBe(false);
    });
  });

  it('2. App Bileşeni Render Testi: Kapatma akışında isDirty sekme varsa confirmClose sorulur, iptal edilirse kapanmaz, onaylanırsa kapanır', async () => {
    render(<App />);

    // Sekmeyi kirli (isDirty) yapalım
    act(() => {
      useAppStore.getState().updateTabContent('tab-1', '<p>Kaydedilmemis degisiklik</p>');
    });
    expect(useAppStore.getState().tabs[0].isDirty).toBe(true);

    expect(closeCallback).toBeDefined();

    // 2a. Kullanıcı 'cancel' derse:
    mockConfirmClose.mockResolvedValueOnce('cancel');

    await act(async () => {
      if (closeCallback) closeCallback();
    });

    await waitFor(() => {
      expect(mockConfirmClose).toHaveBeenCalled();
    });

    // İptal edildiği için pencere kapatma çağrılmamalı, cancelClose bildirilmeli
    expect(mockCloseWindow).not.toHaveBeenCalled();
    expect(mockCancelClose).toHaveBeenCalled();
    expect(useAppStore.getState().tabs.length).toBe(1);

    // 2b. Kullanıcı 'dont-save' derse:
    mockConfirmClose.mockResolvedValueOnce('dont-save');

    await act(async () => {
      if (closeCallback) closeCallback();
    });

    await waitFor(() => {
      expect(mockCloseWindow).toHaveBeenCalledWith(true);
    });
  });

  it('3. App Bileşeni Render Testi: Farklı Kaydet hedefi başka bir açık sekmeye aitse confirmOverwrite sorulur, iptal edilirse işlem durdurulur', async () => {
    // İki açık sekme oluşturalım: biri 'tab-1', diğeri 'tab-2' (docId: 'doc-target-456')
    act(() => {
      useAppStore.setState({
        tabs: [
          {
            id: 'tab-1',
            title: 'Adsız Belge 1',
            content: '<p>Sekme 1 icerik</p>',
            isDirty: true,
            format: 'docx'
          },
          {
            id: 'tab-2',
            title: 'hedef.docx',
            content: '<p>Sekme 2 icerik</p>',
            isDirty: true,
            format: 'docx',
            docId: 'doc-target-456'
          }
        ],
        activeTabId: 'tab-1'
      });
    });

    render(<App />);

    // Farklı kaydet hedefi olarak tab-2'nin docId'si seçilsin
    mockShowSaveDialog.mockResolvedValue({
      success: true,
      canceled: false,
      docId: 'doc-target-456',
      title: 'hedef.docx',
      format: 'docx'
    });

    // 3a. Kullanıcı üzerine yazmayı reddederse ('cancel'):
    mockConfirmOverwrite.mockResolvedValueOnce('cancel');

    await act(async () => {
      // Ctrl+Shift+S ile Farklı Kaydet tetiklenir
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true }));
    });

    await waitFor(() => {
      expect(mockConfirmOverwrite).toHaveBeenCalledWith({
        targetTitle: 'hedef.docx',
        isDirty: true
      });
    });

    // İptal edildiği için tab-2 kapatılmamalıdır!
    expect(useAppStore.getState().tabs.length).toBe(2);
    expect(mockSaveFile).not.toHaveBeenCalled();

    // 3b. Kullanıcı üzerine yazmayı kabul ederse ('overwrite'):
    mockConfirmOverwrite.mockResolvedValueOnce('overwrite');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true }));
    });

    await waitFor(() => {
      expect(mockSaveFile).toHaveBeenCalled();
    });

    // Üzerine yazıldığı için diğer sekme kapatılmış ve tek sekme kalmış olmalıdır
    expect(useAppStore.getState().tabs.length).toBe(1);
    expect(useAppStore.getState().tabs[0].docId).toBe('doc-target-456');
  });

  it('4. App Bileşeni Render Testi: Kaydedilmemiş sekme yokken pencere çarpısı doğrudan onaysız kapanır', async () => {
    render(<App />);

    // Sekme temiz (isDirty = false)
    expect(useAppStore.getState().tabs[0].isDirty).toBe(false);

    // Kapatma sinyali tetiklenir
    await act(async () => {
      if (closeCallback) closeCallback();
    });

    // Onay penceresi çağrılmamalı, doğrudan close(true) çağrılmalıdır
    expect(mockConfirmClose).not.toHaveBeenCalled();
    expect(mockCloseWindow).toHaveBeenCalledWith(true);
  });
});
