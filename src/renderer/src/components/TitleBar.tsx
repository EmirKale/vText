import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Moon, Sun, Monitor, Maximize2, Minimize2, FileText } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const { tabs, activeTabId, viewMode, setViewMode, isFocusMode, toggleFocusMode, settings, updateSettings } = useAppStore();
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const handleThemeToggle = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
    if (window.kalem?.settings) {
      window.kalem.settings.save({ theme: nextTheme });
    }
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="h-[38px] flex items-center justify-between px-3 select-none border-b border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-xs text-content-mutedLight dark:text-content-mutedDark z-50">
      {/* Brand & Active Document Name */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-content-light dark:text-content-dark">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block"></span>
          <span>Kalem</span>
        </div>
        <span className="text-border-light dark:text-border-dark">/</span>
        <span className="font-medium text-content-light dark:text-content-dark truncate max-w-[240px]">
          {activeTab ? activeTab.title : 'Yeni Belge'}
          {activeTab?.isDirty && <span className="text-accent ml-1 font-bold">•</span>}
        </span>
      </div>

      {/* Center / Right Controls (Leaving space for Windows titleBarOverlay on far right) */}
      <div className="flex items-center gap-1 pr-[140px]">
        {/* View Mode Toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'page' ? 'stream' : 'page')}
          title={viewMode === 'page' ? 'Akış Görünümüne Geç' : 'A4 Sayfa Görünümüne Geç'}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{viewMode === 'page' ? 'A4 Sayfa' : 'Akış'}</span>
        </button>

        {/* Focus Mode Toggle */}
        <button
          onClick={toggleFocusMode}
          title={isFocusMode ? 'Odak Modundan Çık (F11)' : 'Odak Modu (F11)'}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {isFocusMode ? <Minimize2 className="w-3.5 h-3.5 text-accent" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          title="Temayı Değiştir"
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {settings.theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};
