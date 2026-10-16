import React, { useState, useEffect, useRef } from 'react';
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
    setActiveTab,
    closeTab,
    setRequestCloseTab,
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
        // Ctrl+W: Sekmeyi kapat (kaydedilmemiş değişiklik kontrolüyle)
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          closeTabWithConfirmation(activeTab?.id);
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

        // Ctrl+Alt+P veya Ctrl+Shift+D: PDF Olarak Dışa Aktar
        if ((e.altKey && (e.key === 'p' || e.key === 'P')) || (e.shiftKey && (e.key === 'd' || e.key === 'D'))) {
          e.preventDefault();
          handleExportPdf();
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
  }, [activeTab, tabs, editorInstance, isProofreadOpen]);

  const handleOpenFile = async () => {
    if (!window.kalem) return;
    const res = await window.kalem.files.open();
    if (res.success && res.content !== undefined) {
      addTab(res.title, res.content, res.docId, res.format);
    }
  };

  const handleSaveFile = async (saveAs: boolean = false, targetTab?: any): Promise<boolean> => {
    const currentTab = targetTab || activeTab;
    if (!currentTab || !editorInstance || !window.kalem) return false;

    if (currentTab.id !== activeTab?.id) {
      setActiveTab(currentTab.id);
    }

    const oldDocId = currentTab.docId;
    let docId = currentTab.docId;
    let format = currentTab.format || 'docx';
    let docTitle = currentTab.title;

    if (!docId || saveAs) {
      const chosen = await window.kalem.files.showSaveDialog(currentTab.title, format);
      if (!chosen || chosen.canceled || !chosen.docId) return false;
      docId = chosen.docId;
      format = chosen.format ?? format;
      docTitle = chosen.title || currentTab.title;

      // Farklı kaydet yapılıyorsa ve önceki docId varsa eskisini registry'den sil
      if (saveAs && oldDocId && oldDocId !== docId) {
        window.kalem.files.unregister(oldDocId).catch(() => {});
      }

      // Eğer seçilen dosya başka bir sekmede zaten açıksa, kullanıcıya sor
      const duplicateOpenTab = tabs.find(
        (t) => t.id !== currentTab.id && t.docId === chosen.docId
      );
      if (duplicateOpenTab) {
        const overwriteDecision = window.kalem?.dialog?.confirmOverwrite
          ? await window.kalem.dialog.confirmOverwrite({
              targetTitle: duplicateOpenTab.title,
              isDirty: duplicateOpenTab.isDirty
            })
          : (window.confirm(
              duplicateOpenTab.isDirty
                ? `Bu dosya ("${duplicateOpenTab.title}") başka bir sekmede açık ve kaydedilmemiş değişiklikleri var. Üzerine yazılırsa o sekme kapatılacak ve değişiklikler kaybolacaktır.`
                : `Bu dosya ("${duplicateOpenTab.title}") başka bir sekmede açık. Üzerine yazılırsa o sekme kapatılacak.`
            ) ? 'overwrite' : 'cancel');

        if (overwriteDecision !== 'overwrite') {
          return false; // İptal edildi: kaydetme durdurulur ve diğer sekme kapatılmaz!
        }

        // Kullanıcı onayladıysa eski sekme kapatılır
        closeTab(duplicateOpenTab.id);
      }

      updateTabMeta(currentTab.id, {
        docId: chosen.docId,
        title: docTitle,
        format: format
      });
    }

    if (!docId) return false;

    try {
      let saveRes;

      if (format === 'docx') {
        const json = editorInstance.getJSON();
        const docxBuffer = await exportTipTapJsonToDocx(json, docTitle, {
          margin: pageMargin,
          orientation: pageOrientation
        });
        saveRes = await window.kalem.files.save(docId, docxBuffer);
      } else if (format === 'md') {
        const json = editorInstance.getJSON();
        const mdText = tipTapJsonToMarkdown(json);
        saveRes = await window.kalem.files.save(docId, mdText);
      } else if (format === 'txt') {
        const text = editorInstance.getText();
        saveRes = await window.kalem.files.save(docId, text);
      } else {
        const html = editorInstance.getHTML();
        saveRes = await window.kalem.files.save(docId, html);
      }

      if (saveRes && saveRes.success) {
        updateTabMeta(currentTab.id, {
          title: saveRes.title || docTitle,
          isDirty: false,
          lastSavedAt: Date.now()
        });
        return true;
      } else if (saveRes && saveRes.error) {
        alert(`Kaydetme hatası: ${saveRes.error}`);
        return false;
      }
      return false;
    } catch (err: any) {
      alert(`Kaydetme hatası: ${err.message}`);
      return false;
    }
  };

  // Tek noktada tanımlı kapatma onay mantığı:
  // Ctrl+W, sekme çarpısı, pencere çarpısı, Alt+F4 ve app.quit bu akıştan geçer
  const closeTabWithConfirmation = async (tabId?: string): Promise<boolean> => {
    const targetId = tabId || activeTabId;
    const tab = tabs.find((t) => t.id === targetId);
    if (!tab) return true;

    if (tab.isDirty) {
      setActiveTab(tab.id);

      const decision = window.kalem?.dialog?.confirmClose
        ? await window.kalem.dialog.confirmClose(tab.title)
        : confirm(`"${tab.title}" belgesinde kaydedilmemiş değişiklikler var. Kaydetmek istiyor musunuz?`)
        ? 'save'
        : 'dont-save';

      if (decision === 'cancel') {
        return false; // Kapatmayı durdur
      }

      if (decision === 'save') {
        const saved = await handleSaveFile(false, tab);
        if (!saved) {
          return false; // Kaydetme başarısız veya diyalog iptal edildi, kapatma durdurulur
        }
      }
    }

    closeTab(tab.id);
    return true;
  };

  const isClosingWindowRef = useRef(false);

  // Pencere / Uygulama kapatma isteği (Pencere X, Alt+F4, app.quit)
  const closeWindowWithConfirmation = async (): Promise<boolean> => {
    if (isClosingWindowRef.current) return false;
    isClosingWindowRef.current = true;

    try {
      const dirtyTabs = tabs.filter((t) => t.isDirty);
      // Kaydedilmemiş sekme yokken pencere çarpısı doğrudan onaysız kapanır
      if (dirtyTabs.length === 0) {
        await window.kalem?.window?.close(true);
        return true;
      }

      for (const dirtyTab of dirtyTabs) {
        const closed = await closeTabWithConfirmation(dirtyTab.id);
        if (!closed) {
          // Kullanıcı iptal etti, ana sürece bildir ve pencereyi açık bırak
          await window.kalem?.window?.cancelClose?.();
          return false;
        }
      }

      // Tüm sekmeler ya kaydedildi ya da kaydedilmeden kapatıldı
      await window.kalem?.window?.close(true);
      return true;
    } finally {
      isClosingWindowRef.current = false;
    }
  };

  // Kapatma fonksiyonunu useAppStore'a tek merkez olarak bağla
  useEffect(() => {
    setRequestCloseTab(closeTabWithConfirmation);
  }, [tabs, activeTabId, editorInstance]);

  // Ana süreçten gelen pencere kapatma sinyalini dinle
  useEffect(() => {
    if (window.kalem?.window?.onRequestClose) {
      const cleanup = window.kalem.window.onRequestClose(() => {
        closeWindowWithConfirmation();
      });
      return cleanup;
    }
  }, [tabs, editorInstance]);

  const handleExportPdf = async () => {
    if (!activeTab || !editorInstance || !window.kalem) return;
    try {
      const html = editorInstance.getHTML();
      const res = await window.kalem.files.exportPdf(html, activeTab.title);
      if (res && res.error) {
        alert(`PDF aktarma hatası: ${res.error}`);
      }
    } catch (err: any) {
      alert(`PDF aktarma hatası: ${err.message}`);
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
