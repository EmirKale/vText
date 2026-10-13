import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Moon,
  Sun,
  Maximize2,
  Minimize2,
  FileText,
  AlignJustify,
  Printer,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { VTextLogo } from './VTextLogo';
import { TabBar } from './TabBar';
import { applyTheme, isDarkActive } from '../lib/theme';

export const TitleBar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    viewMode,
    setViewMode,
    isFocusMode,
    toggleFocusMode,
    updateSettings,
    pageMargin,
    setPageMargin,
    pageOrientation,
    setPageOrientation
  } = useAppStore();
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const dark = isDarkActive();
  const [showPageSetup, setShowPageSetup] = useState(false);
  const setupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPageSetup) return;
    const handler = (e: MouseEvent) => {
      if (setupRef.current && !setupRef.current.contains(e.target as Node)) {
        setShowPageSetup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPageSetup]);

  const handleThemeToggle = () => {
    const nextTheme = dark ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
    window.kalem?.settings?.save({ theme: nextTheme });
    applyTheme(nextTheme);
  };

  return (
    <div className="drag relative h-10 flex items-end gap-2 pl-3 bg-chrome border-b border-line select-none z-40 shrink-0">
      <div className="h-full flex items-center shrink-0">
        <VTextLogo size={20} />
      </div>

      <div className="flex-1 min-w-0 h-full flex items-end">
        {isFocusMode ? (
          <div className="h-full flex items-center text-ui text-muted truncate">
            {activeTab?.title}
            {activeTab?.isDirty && <span className="ml-2 w-[7px] h-[7px] rounded-full bg-accent inline-block" />}
          </div>
        ) : (
          <div className="-mb-px h-[33px] min-w-0">
            <TabBar />
          </div>
        )}
      </div>

      {/* Right controls — 140px reserved for the native window buttons */}
      <div className="h-full flex items-center gap-0.5 pr-[146px] no-drag shrink-0">
        {/* Print button */}
        <button
          onClick={() => window.print()}
          title="Yazdır (Ctrl+P)"
          className="icon-btn"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>

        {/* View mode toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'page' ? 'stream' : 'page')}
          title={viewMode === 'page' ? 'Akış görünümüne geç' : 'Sayfa görünümüne geç'}
          className="icon-btn w-auto px-2 gap-1.5 text-2xs font-medium"
        >
          {viewMode === 'page' ? <FileText className="w-3.5 h-3.5" /> : <AlignJustify className="w-3.5 h-3.5" />}
          <span>{viewMode === 'page' ? 'Sayfa' : 'Akış'}</span>
        </button>

        {/* Page Setup popover (active when in page view) */}
        {viewMode === 'page' && (
          <div className="relative shrink-0" ref={setupRef}>
            <button
              onClick={() => setShowPageSetup(!showPageSetup)}
              data-active={showPageSetup}
              title="Sayfa Yapısı (Kenar Boşluğu & Yön)"
              className="icon-btn"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {showPageSetup && (
              <div
                className="menu absolute right-0 top-full mt-2 w-56 p-2 text-ui z-50 animate-pop"
                role="menu"
              >
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted px-2 py-1">
                  Sayfa Yönü
                </div>
                <button
                  onClick={() => {
                    setPageOrientation('portrait');
                    setShowPageSetup(false);
                  }}
                  className="menu-item h-8"
                >
                  <span className="flex-1">Dikey (Portrait)</span>
                  {pageOrientation === 'portrait' && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
                <button
                  onClick={() => {
                    setPageOrientation('landscape');
                    setShowPageSetup(false);
                  }}
                  className="menu-item h-8"
                >
                  <span className="flex-1">Yatay (Landscape)</span>
                  {pageOrientation === 'landscape' && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>

                <div className="w-full h-px bg-line my-1.5" />

                <div className="text-2xs font-semibold uppercase tracking-wider text-muted px-2 py-1">
                  Kenar Boşlukları
                </div>
                <button
                  onClick={() => {
                    setPageMargin('normal');
                    setShowPageSetup(false);
                  }}
                  className="menu-item h-8"
                >
                  <span className="flex-1">Normal (2,5 cm)</span>
                  {pageMargin === 'normal' && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
                <button
                  onClick={() => {
                    setPageMargin('narrow');
                    setShowPageSetup(false);
                  }}
                  className="menu-item h-8"
                >
                  <span className="flex-1">Dar (1,27 cm)</span>
                  {pageMargin === 'narrow' && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
                <button
                  onClick={() => {
                    setPageMargin('wide');
                    setShowPageSetup(false);
                  }}
                  className="menu-item h-8"
                >
                  <span className="flex-1">Geniş (5,0 cm)</span>
                  {pageMargin === 'wide' && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={toggleFocusMode}
          data-active={isFocusMode}
          title={isFocusMode ? 'Odak modundan çık (F11)' : 'Odak modu (F11)'}
          className="icon-btn"
        >
          {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        <button onClick={handleThemeToggle} title={dark ? 'Açık temaya geç' : 'Koyu temaya geç'} className="icon-btn">
          {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <span className="w-px h-4 bg-line ml-1.5" />
      </div>
    </div>
  );
};
