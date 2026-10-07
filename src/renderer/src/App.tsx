import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { TitleBar } from './components/TitleBar';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { ArticleDialog } from './components/ArticleDialog';
import { ImageDialog } from './components/ImageDialog';
import { ProofreadPanel } from './components/ProofreadPanel';
import { SettingsModal } from './components/SettingsModal';
import { UpdateNotification } from './components/UpdateNotification';
import { TipTapEditor } from './editor/TipTapEditor';
import { exportTipTapJsonToDocx } from './io/docxExport';
import { tipTapJsonToMarkdown } from './io/markdown';

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
    updateSettings
  } = useAppStore();

  const [editorInstance, setEditorInstance] = useState<any>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Initialize settings and open-file listener
  useEffect(() => {
    if (window.kalem) {
      window.kalem.settings.get().then((loaded) => {
        updateSettings(loaded);
        // Apply theme class to DOM
        if (loaded.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (loaded.theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // System theme — check OS preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      });

      // Listen for files opened via Windows file association / double-click
      const unsubscribe = window.kalem.files.onOpenFile(async (filePath) => {
        const result = await window.kalem.files.open(filePath);
        if (result.success && result.content !== undefined) {
          addTab(result.title, result.content, result.filePath, result.format);
        }
      });

      return () => unsubscribe();
    }
  }, []);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, editorInstance, isProofreadOpen]);

  const handleOpenFile = async () => {
    if (!window.kalem) return;
    const res = await window.kalem.files.open();
    if (res.success && res.content !== undefined) {
      addTab(res.title, res.content, res.filePath, res.format);
    }
  };

  const handleSaveFile = async (saveAs: boolean = false) => {
    if (!activeTab || !editorInstance || !window.kalem) return;

    let targetPath = activeTab.filePath;
    const format = activeTab.format || 'docx';

    if (!targetPath || saveAs) {
      const chosen = await window.kalem.files.showSaveDialog(activeTab.title, format);
      if (!chosen) return;
      targetPath = chosen;
    }

    try {
      if (targetPath.endsWith('.docx')) {
        const json = editorInstance.getJSON();
        const docxBuffer = await exportTipTapJsonToDocx(json, activeTab.title);
        await window.kalem.files.save(targetPath, docxBuffer);
      } else if (targetPath.endsWith('.md')) {
        const json = editorInstance.getJSON();
        const mdText = tipTapJsonToMarkdown(json);
        await window.kalem.files.save(targetPath, mdText);
      } else if (targetPath.endsWith('.pdf')) {
        const html = editorInstance.getHTML();
        await window.kalem.files.exportPdf(html, targetPath);
      } else {
        const html = editorInstance.getHTML();
        await window.kalem.files.save(targetPath, html);
      }

      const fileName = targetPath.split(/[\\/]/).pop() || activeTab.title;
      updateTabMeta(activeTab.id, {
        filePath: targetPath,
        title: fileName,
        isDirty: false,
        lastSavedAt: Date.now()
      });
    } catch (err: any) {
      alert(`Kaydetme hatası: ${err.message}`);
    }
  };

  // Drag and Drop File handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const filePath = (file as any).path;
      if (filePath && window.kalem) {
        const res = await window.kalem.files.open(filePath);
        if (res.success && res.content !== undefined) {
          addTab(res.title, res.content, res.filePath, res.format);
        }
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen bg-canvas-light dark:bg-canvas-dark text-content-light dark:text-content-dark overflow-hidden font-sans select-none"
    >
      {/* TitleBar */}
      <TitleBar />

      {/* When in Focus Mode, hide Toolbar, TabBar, StatusBar for maximum concentration */}
      {!isFocusMode && (
        <>
          <TabBar />
          <Toolbar editor={editorInstance} />
        </>
      )}

      {/* Editor & Sidebars Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        <TipTapEditor
          key={activeTab.id}
          content={activeTab.content}
          onUpdate={(html) => updateTabContent(activeTab.id, html)}
          onEditorReady={(editor) => setEditorInstance(editor)}
        />

        {/* Proofreading Sidebar Panel */}
        <ProofreadPanel editor={editorInstance} />
      </div>

      {/* StatusBar */}
      {!isFocusMode && <StatusBar text={activeTab.content} />}

      {/* Dialogs */}
      <ArticleDialog editor={editorInstance} />
      <ImageDialog editor={editorInstance} />
      <SettingsModal />
      <UpdateNotification />
    </div>
  );
};
