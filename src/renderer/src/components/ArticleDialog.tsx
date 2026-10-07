import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Editor } from '@tiptap/react';
import { Sparkles, X, Loader2, StopCircle, ArrowRight } from 'lucide-react';
import { WordCountOption } from '../../../shared/types';
import { markdownToHtml } from '../io/markdown';

interface ArticleDialogProps {
  editor: Editor | null;
}

export const ArticleDialog: React.FC<ArticleDialogProps> = ({ editor }) => {
  const { isArticleOpen, setArticleOpen, setAiStatus, setCurrentRequestId } = useAppStore();

  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState<WordCountOption>('400-600');
  const [customWordCount, setCustomWordCount] = useState('500');
  const [tone, setTone] = useState('informative');
  const [language, setLanguage] = useState('tr');
  const [instructions, setInstructions] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMarkdown, setGeneratedMarkdown] = useState('');
  const [actualWordCount, setActualWordCount] = useState<number | null>(null);
  const [currentReqId, setCurrentReqIdState] = useState<string | null>(null);

  // Store cleanup function for IPC listeners
  const cleanupRef = useRef<(() => void) | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isArticleOpen) {
      setGeneratedMarkdown('');
      setActualWordCount(null);
      setIsGenerating(false);
      setCurrentReqIdState(null);
    } else {
      // Clean up listeners when dialog closes
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }
  }, [isArticleOpen]);

  if (!isArticleOpen) return null;

  const handleGenerate = () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setGeneratedMarkdown('');
    setActualWordCount(null);

    const requestId = `art-${Date.now()}`;
    setCurrentReqIdState(requestId);
    setCurrentRequestId(requestId);
    setAiStatus('working', 'Makale üretiliyor...');

    let accumulatedMd = '';

    if (window.kalem?.ai) {
      const cleanup = window.kalem.ai.generateArticle(
        requestId,
        {
          topic,
          wordCount,
          customWordCount,
          tone,
          language,
          instructions
        },
        (chunk) => {
          accumulatedMd += chunk;
          setGeneratedMarkdown(accumulatedMd);
          const count = accumulatedMd.trim().split(/\s+/).filter(Boolean).length;
          setActualWordCount(count);
        },
        (tokens) => {
          setIsGenerating(false);
          setAiStatus('idle', undefined, tokens);
          setCurrentRequestId(undefined);
          setCurrentReqIdState(null);

          // Clean up listeners
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }

          // Insert directly into editor
          if (editor && accumulatedMd) {
            const html = markdownToHtml(accumulatedMd);
            editor.commands.insertContent(html);
            setArticleOpen(false);
          }
        },
        (err) => {
          setIsGenerating(false);
          setAiStatus('error', err);
          setCurrentRequestId(undefined);
          setCurrentReqIdState(null);
          // Clean up listeners
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }
          alert(`Hata: ${err}`);
        }
      );
      cleanupRef.current = cleanup;
    }
  };

  const handleStop = () => {
    if (currentReqId && window.kalem?.ai) {
      window.kalem.ai.abort(currentReqId);
      setIsGenerating(false);
      setAiStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-[560px] max-w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-content-light dark:text-content-dark">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light dark:border-border-dark bg-canvas-light/50 dark:bg-canvas-dark/50">
          <div className="flex items-center gap-2 font-semibold text-sm text-accent">
            <Sparkles className="w-4 h-4" />
            <span>✨ AI ile Makale Yazdır</span>
          </div>
          <button
            onClick={() => setArticleOpen(false)}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-content-mutedLight dark:text-content-mutedDark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Konu */}
          <div>
            <label className="block font-medium mb-1.5 text-content-light dark:text-content-dark">
              Makale Konusu <span className="text-red-500">*</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Örn: Yapay zekanın modern yazarlık ve üretkenlik süreçlerine etkileri..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none"
            />
          </div>

          {/* Kelime Sayısı ve Ton */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1.5">Hedef Kelime Sayısı</label>
              <select
                value={wordCount}
                onChange={(e) => setWordCount(e.target.value as WordCountOption)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent outline-none cursor-pointer"
              >
                <option value="200-400">200 – 400 Kelime (Kısa)</option>
                <option value="400-600">400 – 600 Kelime (Standart)</option>
                <option value="600-800">600 – 800 Kelime (Kapsamlı)</option>
                <option value="800+">800+ Kelime (Derinlemesine)</option>
                <option value="custom">Özel Sayı...</option>
              </select>
              {wordCount === 'custom' && (
                <input
                  type="text"
                  placeholder="Örn: 1200"
                  value={customWordCount}
                  onChange={(e) => setCustomWordCount(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark outline-none"
                />
              )}
            </div>

            <div>
              <label className="block font-medium mb-1.5">Üslup ve Ton</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent outline-none cursor-pointer"
              >
                <option value="informative">Bilgilendirici (Net ve eğitici)</option>
                <option value="friendly">Samimi (Sıcak ve konuşma dili)</option>
                <option value="formal">Resmi (Profesyonel ve kurumsal)</option>
                <option value="persuasive">İkna Edici (Etkileyici ve iddialı)</option>
              </select>
            </div>
          </div>

          {/* Dil ve Ek Talimatlar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1.5">Makale Dili</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent outline-none cursor-pointer"
              >
                <option value="tr">🇹🇷 Türkçe</option>
                <option value="en">🇬🇧 İngilizce</option>
                <option value="de">🇩🇪 Almanca</option>
                <option value="es">🇪🇸 İspanyolca</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1.5">İsteğe Bağlı Talimatlar</label>
              <input
                type="text"
                placeholder="Örn: Girişimciler için, 3 ana madde içersin"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent outline-none"
              />
            </div>
          </div>

          {/* Live generation progress banner if working */}
          {isGenerating && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Yazılıyor... ({actualWordCount || 0} kelime)</span>
              </div>
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Durdur</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-light dark:border-border-dark bg-canvas-light/30 dark:bg-canvas-dark/30 text-xs">
          <button
            onClick={() => setArticleOpen(false)}
            className="px-4 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-content-mutedLight dark:text-content-mutedDark"
          >
            İptal
          </button>
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || isGenerating}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 shadow-sm transition-all"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isGenerating ? 'Yazılıyor...' : 'Makaleyi Oluştur'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
