import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { PenLine, SpellCheck2, Languages, ImagePlus, Settings2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { markdownToHtml, tipTapJsonToMarkdown } from '../io/markdown';

interface AiRailProps {
  editor: Editor | null;
}

const LANGUAGES = [
  { code: 'en', name: 'İngilizce', label: 'İngilizce' },
  { code: 'de', name: 'Almanca', label: 'Almanca' },
  { code: 'es', name: 'İspanyolca', label: 'İspanyolca' },
  { code: 'fr', name: 'Fransızca', label: 'Fransızca' },
  { code: 'tr', name: 'Türkçe', label: 'Türkçe' }
];

const RailButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, title, active, onClick }) => (
  <button
    onClick={onClick}
    title={title}
    aria-pressed={active}
    className={`group relative w-[52px] flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
      active ? 'bg-marker/25 text-ink' : 'text-muted hover:text-ink hover:bg-ink/[0.05]'
    }`}
  >
    {active && <span className="absolute -left-[5px] top-2.5 bottom-2.5 w-[3px] rounded-full bg-marker" />}
    <span className="grid place-items-center w-5 h-5">{icon}</span>
    <span className="text-[10.5px] leading-none font-medium">{label}</span>
  </button>
);

/** Right-hand assistant rail: everything AI lives here and wears the highlighter colour. */
export const AiRail: React.FC<AiRailProps> = ({ editor }) => {
  const {
    setArticleOpen,
    isArticleOpen,
    setProofreadOpen,
    isProofreadOpen,
    setImageOpen,
    isImageOpen,
    setSettingsOpen,
    addTab,
    tabs,
    activeTabId,
    aiStatus,
    setAiStatus,
    setCurrentRequestId
  } = useAppStore();

  const [showTranslate, setShowTranslate] = useState(false);
  const translateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTranslate) return;
    const handler = (e: MouseEvent) => {
      if (translateRef.current && !translateRef.current.contains(e.target as Node)) setShowTranslate(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTranslate]);

  const handleTranslate = (lang: string, langName: string) => {
    setShowTranslate(false);
    if (!editor || !window.kalem?.ai) return;

    const activeTab = tabs.find((t) => t.id === activeTabId);
    const mdContent = tipTapJsonToMarkdown(editor.getJSON());
    const baseTitle = activeTab ? activeTab.title.replace(/\.[^/.]+$/, '') : 'Belge';
    const newTabId = addTab(`${baseTitle} (${lang.toUpperCase()})`, '<p><em>Çeviri hazırlanıyor…</em></p>');

    const requestId = `tr-${Date.now()}`;
    setCurrentRequestId(requestId);
    setAiStatus('working', `${langName} diline çevriliyor…`);
    let accumulatedMd = '';

    const cleanup = window.kalem.ai.translate(
      requestId,
      mdContent,
      langName,
      (chunk) => {
        accumulatedMd += chunk;
        useAppStore.getState().updateTabContent(newTabId, markdownToHtml(accumulatedMd));
      },
      (tokens) => {
        setAiStatus('idle', undefined, tokens);
        setCurrentRequestId(undefined);
        cleanup?.();
      },
      (err) => {
        setAiStatus('error', err);
        setCurrentRequestId(undefined);
        cleanup?.();
      }
    );
  };

  const handleImage = () => {
    let text = '';
    if (editor) {
      const { from, to } = editor.state.selection;
      text = editor.state.doc.textBetween(from, to, ' ');
    }
    setImageOpen(true, text || undefined);
  };

  return (
    <aside
      aria-label="Yapay zekâ araçları"
      className="relative w-[64px] shrink-0 flex flex-col items-center gap-1 pt-3 pb-2 bg-chrome border-l border-line"
    >
      {/* Working indicator: a highlighter sweep across the top of the rail */}
      <div className="absolute top-0 inset-x-0 h-[2px] overflow-hidden">
        {aiStatus === 'working' && <div className="h-full w-full marker-sweep" />}
      </div>

      <RailButton
        icon={<PenLine className="w-[18px] h-[18px]" />}
        label="Yaz"
        title="Yapay zekâ ile makale yaz (Ctrl+J)"
        active={isArticleOpen}
        onClick={() => setArticleOpen(true)}
      />
      <RailButton
        icon={<SpellCheck2 className="w-[18px] h-[18px]" />}
        label="Düzelt"
        title="Yazım ve dil bilgisi denetimi (Ctrl+Shift+E)"
        active={isProofreadOpen}
        onClick={() => setProofreadOpen(!isProofreadOpen)}
      />

      <div className="relative" ref={translateRef}>
        <RailButton
          icon={<Languages className="w-[18px] h-[18px]" />}
          label="Çevir"
          title="Belgeyi yeni sekmede çevir"
          active={showTranslate}
          onClick={() => setShowTranslate(!showTranslate)}
        />
        {showTranslate && (
          <div className="menu absolute right-full top-0 mr-2 w-52" role="menu">
            <div className="px-2.5 pt-1.5 pb-2 text-2xs text-muted">Çeviri yeni bir sekmede açılır</div>
            {LANGUAGES.map((l) => (
              <button key={l.code} role="menuitem" className="menu-item" onClick={() => handleTranslate(l.code, l.name)}>
                <span className="w-7 text-2xs font-semibold text-muted uppercase">{l.code}</span>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <RailButton
        icon={<ImagePlus className="w-[18px] h-[18px]" />}
        label="Görsel"
        title="Yapay zekâ ile görsel oluştur"
        active={isImageOpen}
        onClick={handleImage}
      />

      <div className="flex-1" />

      <button onClick={() => setSettingsOpen(true)} title="Ayarlar" aria-label="Ayarlar" className="icon-btn w-9 h-9">
        <Settings2 className="w-[18px] h-[18px]" />
      </button>
    </aside>
  );
};
