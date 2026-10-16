import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { TitleBar } from './components/TitleBar';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { AiRail } from './components/AiRail';
import { ArticleDialog } from './components/ArticleDialog';
import { ImageDialog } from './components/ImageDialog';
import { ProofreadPanel } from './components/ProofreadPanel';
import { SettingsModal } from './components/SettingsModal';
import { UpdateNotification } from './components/UpdateNotification';
import { SpecialCharactersModal } from './components/SpecialCharactersModal';
import { DocumentStatisticsModal } from './components/DocumentStatisticsModal';
import { TipTapEditor } from './editor/TipTapEditor';
import { FindReplaceBar } from './components/FindReplaceBar';
import { NavigatorPanel } from './components/NavigatorPanel';
import { exportTipTapJsonToDocx } from './io/docxExport';
import { tipTapJsonToMarkdown } from './io/markdown';
import { applyTheme } from './lib/theme';

export const App: React.FC = () => {
  const {
    tabs,
    activeTabId,
    updateTabContent,
    updateTabMeta,
    addTab,
    isFocusMode,
    toggleFocusMode,
    setArticleOpen,
    isProofreadOpen,
    setProofreadOpen,
    settings,
    updateSettings,
    pageMargin,
    pageOrientation,
    toggleNavigator
  } = useAppStore();

  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [findMode, setFindMode] = useState<null | 'find' | 'replace'>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Initialize settings and open-file listener
  useEffect(() => {
    if (window.kalem) {
      window.kalem.settings.get().then((loaded) => {
        updateSettings(loaded);
        applyTheme(loaded.theme);
      });

      // Listen for files opened via Windows file association / double-click
      const unsubscribe = window.kalem.files.onOpenFile((result) => {
        if (result.success && result.content !== undefined) {
          addTab(result.title, result.content, result.docId, result.format);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  // Follow OS theme changes while the preference is "system"
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);

  // Keyboard Shortcuts (Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+J, Ctrl+Shift+E, F11)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // F11: Focus Mode
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      if (e.ctrlKey) {
        // Ctrl+F: Bul / Ctrl+H: Bul ve Değiştir
        if (!e.shiftKey && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          setFindMode('find');
          return;
        }
        if (!e.shiftKey && (e.key === 'h' || e.key === 'H')) {
          e.preventDefault();
          setFindMode('replace');
          return;
        }
        // Ctrl+N: Yeni Belge
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          addTab();
          return;
        }

        // Ctrl+O: Belge Aç
        if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();
          handleOpenFile();
          return;
        }

        // Ctrl+Shift+S: Farklı Kaydet
        if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          handleSaveFile(true);
          return;
        }

        // Ctrl+S: Kaydet
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleSaveFile(false);
          return;
        }

        // Ctrl+P: Yazdır
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          window.print();
          return;
        }

        // Ctrl+J: AI ile Makale
        if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          setArticleOpen(true);
          return;
        }

        // Ctrl+Shift+E: Hataları Düzelt
        if (e.shiftKey && (e.key === 'e' || e.key === 'E')) {
          e.preventDefault();
          setProofreadOpen(!isProofreadOpen);
          return;
        }

        // Ctrl+Shift+O: Belge Gezgini
        if (e.shiftKey && (e.key === 'o' || e.key === 'O')) {
          e.preventDefault();
          toggleNavigator();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, editorInstance, isProofreadOpen]);

  const handleOpenFile = async () => {
    if (!window.kalem) return;
    const res = await window.kalem.files.open();
    if (res.success && res.content !== undefined) {
      addTab(res.title, res.content, res.docId, res.format);
    }
  };

  const handleSaveFile = async (saveAs: boolean = false) => {
    if (!activeTab || !editorInstance || !window.kalem) return;

    let docId = activeTab.docId;
    const format = activeTab.format || 'docx';

    if (!docId || saveAs) {
      const chosen = await window.kalem.files.showSaveDialog(activeTab.title, format);
      if (!chosen || chosen.canceled || !chosen.docId) return;
      docId = chosen.docId;
      updateTabMeta(activeTab.id, {
        docId: chosen.docId,
        title: chosen.title || activeTab.title,
        format: chosen.format || format
      });
    }

    if (!docId) return;

    try {
      const currentFormat = activeTab.format || 'docx';
      let saveRes;

      if (currentFormat === 'docx') {
        const json = editorInstance.getJSON();
        const docxBuffer = await exportTipTapJsonToDocx(json, activeTab.title, {
          margin: pageMargin,
          orientation: pageOrientation
        });
        saveRes = await window.kalem.files.save(docId, docxBuffer);
      } else if (currentFormat === 'md') {
        const json = editorInstance.getJSON();
        const mdText = tipTapJsonToMarkdown(json);
        saveRes = await window.kalem.files.save(docId, mdText);
      } else if (currentFormat === 'pdf') {
        const html = editorInstance.getHTML();
        saveRes = await window.kalem.files.exportPdf(html);
      } else {
        const html = editorInstance.getHTML();
        saveRes = await window.kalem.files.save(docId, html);
      }

      if (saveRes && saveRes.success) {
        updateTabMeta(activeTab.id, {
          title: saveRes.title || activeTab.title,
          isDirty: false,
          lastSavedAt: Date.now()
        });
      } else if (saveRes && saveRes.error) {
        alert(`Kaydetme hatası: ${saveRes.error}`);
      }
    } catch (err: any) {
      alert(`Kaydetme hatası: ${err.message}`);
    }
  };

  // Drag and Drop File handling (File object passed directly to preload)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file && window.kalem) {
        const res = await window.kalem.files.openDropped(file);
        if (res.success && res.content !== undefined) {
          addTab(res.title, res.content, res.docId, res.format);
        } else if (res.error) {
          alert(`Dosya açılamadı: ${res.error}`);
        }
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen bg-desk text-ink overflow-hidden font-sans select-none print:h-auto print:w-auto print:overflow-visible print:bg-white print:text-black print:block"
    >
      <div className="no-print">
        <TitleBar />
      </div>

      <div className="flex-1 flex overflow-hidden relative print:overflow-visible print:h-auto print:block">
        {!isFocusMode && <NavigatorPanel editor={editorInstance} />}

        {/* Document column */}
        <main className="relative flex-1 flex min-w-0 print:overflow-visible print:h-auto print:block">
          {!isFocusMode && (
            <div className="no-print absolute top-3 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
              <div className="pointer-events-auto max-w-full">
                <Toolbar editor={editorInstance} />
              </div>
            </div>
          )}

          <TipTapEditor
            key={activeTab.id}
            content={activeTab.content}
            onUpdate={(html) => updateTabContent(activeTab.id, html)}
            onEditorReady={(editor) => setEditorInstance(editor)}
          />

          {findMode && (
            <div className="no-print">
              <FindReplaceBar
                key={activeTab.id}
                editor={editorInstance}
                mode={findMode}
                onModeChange={setFindMode}
                onClose={() => setFindMode(null)}
              />
            </div>
          )}
        </main>

        <div className="no-print">
          <ProofreadPanel editor={editorInstance} />
        </div>
        {!isFocusMode && (
          <div className="no-print">
            <AiRail editor={editorInstance} />
          </div>
        )}
      </div>

      {!isFocusMode && (
        <div className="no-print">
          <StatusBar text={activeTab.content} />
        </div>
      )}

      <div className="no-print">
        <ArticleDialog editor={editorInstance} />
        <ImageDialog editor={editorInstance} />
        <SettingsModal />
        <UpdateNotification />
        <SpecialCharactersModal editor={editorInstance} />
        <DocumentStatisticsModal content={activeTab.content} />
      </div>
    </div>
  );
};
