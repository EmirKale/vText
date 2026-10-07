import React, { useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react';
import { useAppStore } from '../store/useAppStore';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCircle,
  Repeat,
  Image as ImageIcon,
  Globe,
  Loader2,
  Check,
  PlusCircle,
  RotateCcw,
  X
} from 'lucide-react';
import { RewriteAction } from '../../../shared/types';

interface BubbleMenuCardProps {
  editor: Editor | null;
}

export const BubbleMenuCard: React.FC<BubbleMenuCardProps> = ({ editor }) => {
  const { setImageOpen, setAiStatus, setCurrentRequestId } = useAppStore();
  const [isRewriting, setIsRewriting] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [showPreviewCard, setShowPreviewCard] = useState(false);
  const [lastAction, setLastAction] = useState<{ action: RewriteAction; tone?: string; language?: string } | null>(null);
  const [showToneSubmenu, setShowToneSubmenu] = useState(false);
  const [showTranslateSubmenu, setShowTranslateSubmenu] = useState(false);

  // Store original selection positions so they don't go stale
  const selectionRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });
  // Store cleanup function for IPC listeners
  const cleanupRef = useRef<(() => void) | null>(null);

  if (!editor) return null;

  const handleRewrite = (action: RewriteAction, tone?: string, language?: string) => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text || text.trim().length === 0) return;

    // Save the selection positions at rewrite initiation time
    selectionRef.current = { from, to };

    setOriginalText(text);
    setRewrittenText('');
    setShowPreviewCard(true);
    setIsRewriting(true);
    setLastAction({ action, tone, language });
    setShowToneSubmenu(false);
    setShowTranslateSubmenu(false);

    // Clean up any previous listeners
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (window.kalem?.ai) {
      const requestId = `rw-${Date.now()}`;
      setCurrentRequestId(requestId);
      setAiStatus('working', 'Metin yeniden yazılıyor...');

      let accumulated = '';
      const cleanup = window.kalem.ai.rewrite(
        requestId,
        { text, action, tone, language },
        (chunk) => {
          accumulated += chunk;
          setRewrittenText(accumulated);
        },
        (tokens) => {
          setIsRewriting(false);
          setAiStatus('idle', undefined, tokens);
          setCurrentRequestId(undefined);
          // Clean up listeners after done
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }
        },
        (err) => {
          setIsRewriting(false);
          setAiStatus('error', err);
          setCurrentRequestId(undefined);
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }
        }
      );
      cleanupRef.current = cleanup;
    }
  };

  const handleApplyReplace = () => {
    if (editor && rewrittenText) {
      // Use the stored selection positions, not current ones
      const { from, to } = selectionRef.current;
      editor.chain().focus().insertContentAt({ from, to }, rewrittenText).run();
      setShowPreviewCard(false);
    }
  };

  const handleApplyAppend = () => {
    if (editor && rewrittenText) {
      // Use the stored position
      const { to } = selectionRef.current;
      editor.chain().focus().insertContentAt(to, `\n\n${rewrittenText}`).run();
      setShowPreviewCard(false);
    }
  };

  const handleRetry = () => {
    if (lastAction) {
      handleRewrite(lastAction.action, lastAction.tone, lastAction.language);
    }
  };

  const handleCancel = () => {
    setShowPreviewCard(false);
    setRewrittenText('');
    // Clean up listeners on cancel
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  };

  const handleGenerateImage = () => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    setImageOpen(true, text);
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 150,
          placement: 'top',
          offset: [0, 8],
          maxWidth: 'none'
        }}
        shouldShow={({ state, from, to }) => {
          const text = state.doc.textBetween(from, to, ' ');
          return !showPreviewCard && text.trim().length > 2;
        }}
      >
        <div className="flex flex-wrap items-center gap-0.5 p-1 rounded-lg shadow-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-xs text-content-light dark:text-content-dark select-none animate-in fade-in zoom-in-95 duration-150 max-w-[95vw]">
          {/* Daha uzun yaz */}
          <button
            onClick={() => handleRewrite('longer')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            title="Daha Uzun Yaz"
          >
            <Maximize2 className="w-3.5 h-3.5 text-accent" />
            <span>Uzat</span>
          </button>

          {/* Daha kısa yaz */}
          <button
            onClick={() => handleRewrite('shorter')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            title="Daha Kısa Yaz"
          >
            <Minimize2 className="w-3.5 h-3.5 text-accent" />
            <span>Kısalt</span>
          </button>

          {/* Yazımı düzelt */}
          <button
            onClick={() => handleRewrite('fix')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            title="Yazımı Düzelt"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Düzelt</span>
          </button>

          {/* Tonu değiştir */}
          <div className="relative">
            <button
              onClick={() => { setShowToneSubmenu(!showToneSubmenu); setShowTranslateSubmenu(false); }}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Ton ▾</span>
            </button>
            {showToneSubmenu && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-28 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-lg py-1 z-[60]">
                <button
                  onClick={() => handleRewrite('tone', 'formal')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Resmi
                </button>
                <button
                  onClick={() => handleRewrite('tone', 'friendly')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Samimi
                </button>
                <button
                  onClick={() => handleRewrite('tone', 'fluent')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Akıcı
                </button>
              </div>
            )}
          </div>

          {/* Yeniden ifade et */}
          <button
            onClick={() => handleRewrite('rephrase')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            title="Yeniden İfade Et"
          >
            <Repeat className="w-3.5 h-3.5 text-blue-500" />
            <span>Yeniden Yaz</span>
          </button>

          {/* Görsel oluştur */}
          <button
            onClick={handleGenerateImage}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-purple-600 dark:text-purple-400 transition-colors whitespace-nowrap"
            title="Seçili Metinle İlgili Görsel Oluştur"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Görsel</span>
          </button>

          {/* Seçimi çevir */}
          <div className="relative">
            <button
              onClick={() => { setShowTranslateSubmenu(!showTranslateSubmenu); setShowToneSubmenu(false); }}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 text-teal-500" />
              <span>Çevir ▾</span>
            </button>
            {showTranslateSubmenu && (
              <div className="absolute right-0 bottom-full mb-1 w-28 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-lg py-1 z-[60]">
                <button
                  onClick={() => handleRewrite('translate', undefined, 'İngilizce')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  🇬🇧 İngilizce
                </button>
                <button
                  onClick={() => handleRewrite('translate', undefined, 'Almanca')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  🇩🇪 Almanca
                </button>
                <button
                  onClick={() => handleRewrite('translate', undefined, 'İspanyolca')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  🇪🇸 İspanyolca
                </button>
              </div>
            )}
          </div>
        </div>
      </BubbleMenu>

      {/* Comparison Preview Card (Yol Haritası Madde 313) */}
      {showPreviewCard && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[540px] max-w-[90vw] p-4 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl z-50 text-xs text-content-light dark:text-content-dark animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-light dark:border-border-dark font-medium">
            <div className="flex items-center gap-1.5 text-accent">
              <Sparkles className="w-4 h-4" />
              <span>Yapay Zeka Metin Karşılaştırması</span>
            </div>
            <button onClick={handleCancel} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 my-3">
            {/* Orijinal Metin */}
            <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5">
              <div className="text-[10px] uppercase font-semibold text-content-mutedLight dark:text-content-mutedDark mb-1">
                Orijinal
              </div>
              <div className="max-h-36 overflow-y-auto leading-relaxed select-text">
                {originalText}
              </div>
            </div>

            {/* Yeni / Yeniden Yazılan Metin */}
            <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-accent mb-1">
                <span>Yeni Öneri</span>
                {isRewriting && <Loader2 className="w-3 h-3 animate-spin" />}
              </div>
              <div className="max-h-36 overflow-y-auto leading-relaxed select-text font-medium">
                {rewrittenText || (isRewriting ? 'Yazılıyor...' : '')}
              </div>
            </div>
          </div>

          {/* Action buttons: Değiştir, Altına ekle, Tekrar dene, Vazgeç */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light dark:border-border-dark">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded text-content-mutedLight dark:text-content-mutedDark hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleRetry}
              disabled={isRewriting}
              className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tekrar Dene</span>
            </button>
            <button
              onClick={handleApplyAppend}
              disabled={isRewriting || !rewrittenText}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 transition-colors disabled:opacity-50 font-medium"
            >
              <PlusCircle className="w-3 h-3" />
              <span>Altına Ekle</span>
            </button>
            <button
              onClick={handleApplyReplace}
              disabled={isRewriting || !rewrittenText}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm disabled:opacity-50 font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Değiştir</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
