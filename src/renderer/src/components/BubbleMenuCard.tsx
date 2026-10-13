import React, { useState, useRef, useEffect } from 'react';
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
  X,
  ChevronDown
} from 'lucide-react';
import { RewriteAction } from '../../../shared/types';

interface BubbleMenuCardProps {
  editor: Editor | null;
}

export const BubbleMenuCard: React.FC<BubbleMenuCardProps> = ({ editor }) => {
  const {
    isImageOpen,
    isArticleOpen,
    isSettingsOpen,
    isToolbarMenuOpen,
    setImageOpen,
    setAiStatus,
    setCurrentRequestId
  } = useAppStore();
  const [isDismissed, setIsDismissed] = useState(false);
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

  // Re-enable bubble menu on new selection
  useEffect(() => {
    if (!editor) return;
    const handleSel = () => setIsDismissed(false);
    editor.on('selectionUpdate', handleSel);
    return () => {
      editor.off('selectionUpdate', handleSel);
    };
  }, [editor]);

  // Pressing Escape dismisses the bubble menu
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDismissed(true);
        setShowToneSubmenu(false);
        setShowTranslateSubmenu(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
    setShowToneSubmenu(false);
    setShowTranslateSubmenu(false);
    setShowPreviewCard(false);
    setImageOpen(true, text);
  };

  const pillBtn =
    'flex items-center gap-1.5 h-7 px-2 rounded-md text-ink/80 hover:text-ink hover:bg-ink/[0.06] transition-colors whitespace-nowrap';
  const subMenu = 'menu absolute bottom-full mb-2 w-36';

  return (
    <>
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 120,
          placement: 'top',
          offset: [0, 10],
          maxWidth: 'none',
          zIndex: 25,
          popperOptions: {
            modifiers: [
              {
                name: 'flip',
                options: {
                  fallbackPlacements: ['bottom', 'top'],
                  padding: { top: 96, bottom: 24, left: 16, right: 16 }
                }
              },
              {
                name: 'preventOverflow',
                options: {
                  padding: { top: 88, bottom: 24, left: 16, right: 16 }
                }
              }
            ]
          }
        }}
        shouldShow={({ state, from, to }) => {
          if (isToolbarMenuOpen || isImageOpen || isArticleOpen || isSettingsOpen || isDismissed) return false;
          if (showPreviewCard) return false;
          const text = state.doc.textBetween(from, to, ' ');
          return text.trim().length > 2;
        }}
      >
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-paper border border-line shadow-float text-ui text-ink select-none max-w-[95vw] animate-pop">
          <span className="flex items-center gap-1 h-6 pl-1.5 pr-2 mr-0.5 rounded-md bg-marker text-marker-ink text-2xs font-semibold">
            <Sparkles className="w-3 h-3" />
            AI
          </span>

          <button onClick={() => handleRewrite('fix')} className={pillBtn} title="Yazım hatalarını düzelt">
            <CheckCircle className="w-3.5 h-3.5" />
            Düzelt
          </button>
          <button onClick={() => handleRewrite('rephrase')} className={pillBtn} title="Farklı sözcüklerle yeniden yaz">
            <Repeat className="w-3.5 h-3.5" />
            Yeniden yaz
          </button>
          <button onClick={() => handleRewrite('longer')} className={pillBtn} title="Daha uzun yaz">
            <Maximize2 className="w-3.5 h-3.5" />
            Uzat
          </button>
          <button onClick={() => handleRewrite('shorter')} className={pillBtn} title="Daha kısa yaz">
            <Minimize2 className="w-3.5 h-3.5" />
            Kısalt
          </button>

          <span className="w-px h-4 bg-line mx-0.5" />

          <div className="relative">
            <button
              onClick={() => { setShowToneSubmenu(!showToneSubmenu); setShowTranslateSubmenu(false); }}
              className={pillBtn}
              aria-expanded={showToneSubmenu}
            >
              Ton
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {showToneSubmenu && (
              <div className={`${subMenu} left-1/2 -translate-x-1/2`}>
                <button onClick={() => handleRewrite('tone', 'formal')} className="menu-item">Resmi</button>
                <button onClick={() => handleRewrite('tone', 'friendly')} className="menu-item">Samimi</button>
                <button onClick={() => handleRewrite('tone', 'fluent')} className="menu-item">Akıcı</button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowTranslateSubmenu(!showTranslateSubmenu); setShowToneSubmenu(false); }}
              className={pillBtn}
              aria-expanded={showTranslateSubmenu}
            >
              <Globe className="w-3.5 h-3.5" />
              Çevir
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {showTranslateSubmenu && (
              <div className={`${subMenu} right-0`}>
                <button onClick={() => handleRewrite('translate', undefined, 'İngilizce')} className="menu-item">İngilizce</button>
                <button onClick={() => handleRewrite('translate', undefined, 'Almanca')} className="menu-item">Almanca</button>
                <button onClick={() => handleRewrite('translate', undefined, 'İspanyolca')} className="menu-item">İspanyolca</button>
                <button onClick={() => handleRewrite('translate', undefined, 'Türkçe')} className="menu-item">Türkçe</button>
              </div>
            )}
          </div>

          <button onClick={handleGenerateImage} className={pillBtn} title="Seçili metinden görsel oluştur">
            <ImageIcon className="w-3.5 h-3.5" />
            Görsel
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="w-6 h-6 rounded-md text-muted hover:text-ink hover:bg-ink/[0.06] flex items-center justify-center transition-colors ml-0.5 shrink-0"
            title="Kapat (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </BubbleMenu>

      {/* Compare card: original vs. AI suggestion */}
      {showPreviewCard && !isImageOpen && !isArticleOpen && !isSettingsOpen && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[600px] max-w-[calc(100vw-120px)] rounded-2xl bg-paper border border-line shadow-modal z-40 text-ink animate-pop overflow-hidden">
          <div className="flex items-center justify-between px-4 h-11 border-b border-line">
            <div className="flex items-center gap-2 text-ui font-semibold">
              <span className="grid place-items-center w-5 h-5 rounded-md bg-marker text-marker-ink">
                <Sparkles className="w-3 h-3" />
              </span>
              {isRewriting ? 'Öneri yazılıyor…' : 'Öneri hazır'}
            </div>
            <button onClick={handleCancel} className="icon-btn" aria-label="Kapat">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 divide-x divide-line">
            <div className="p-4">
              <div className="mb-2 text-2xs font-medium text-muted">Seçtiğiniz metin</div>
              <div className="max-h-44 overflow-y-auto font-serif text-[14px] leading-relaxed text-ink/70 select-text">
                {originalText}
              </div>
            </div>
            <div className="p-4 bg-marker/[0.09]">
              <div className="mb-2 flex items-center gap-1.5 text-2xs font-medium text-ink">
                Öneri
                {isRewriting && <Loader2 className="w-3 h-3 animate-spin text-muted" />}
              </div>
              <div className="max-h-44 overflow-y-auto font-serif text-[14px] leading-relaxed select-text">
                {rewrittenText || (
                  <span className="block h-4 w-3/4 rounded marker-sweep bg-ink/[0.05]" aria-label="Yazılıyor" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-t border-line bg-chrome/60">
            <button onClick={handleRetry} disabled={isRewriting} className="btn-quiet">
              <RotateCcw className="w-3.5 h-3.5" />
              Tekrar dene
            </button>
            <div className="flex-1" />
            <button onClick={handleCancel} className="btn-quiet">Vazgeç</button>
            <button onClick={handleApplyAppend} disabled={isRewriting || !rewrittenText} className="btn-outline">
              <PlusCircle className="w-3.5 h-3.5" />
              Altına ekle
            </button>
            <button onClick={handleApplyReplace} disabled={isRewriting || !rewrittenText} className="btn-primary">
              <Check className="w-3.5 h-3.5" />
              Metnin yerine koy
            </button>
          </div>
        </div>
      )}
    </>
  );
};
