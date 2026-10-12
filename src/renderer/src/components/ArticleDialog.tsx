import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Editor } from '@tiptap/react';
import { Sparkles, Loader2, StopCircle, ArrowRight, PenLine } from 'lucide-react';
import { WordCountOption } from '../../../shared/types';
import { markdownToHtml } from '../io/markdown';
import { Modal, Chips } from './ui/Modal';

interface ArticleDialogProps {
  editor: Editor | null;
}

const WORD_COUNT_OPTIONS: Array<{ value: WordCountOption; label: string }> = [
  { value: '200-400', label: '200–400 kelime' },
  { value: '400-600', label: '400–600 kelime' },
  { value: '600-800', label: '600–800 kelime' },
  { value: '800+', label: '800+ kelime' },
  { value: 'custom', label: 'Özel…' }
];

const TONE_OPTIONS = [
  { value: 'informative', label: 'Bilgilendirici' },
  { value: 'friendly', label: 'Samimi' },
  { value: 'formal', label: 'Resmi' },
  { value: 'persuasive', label: 'İkna Edici' }
];

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

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isArticleOpen) {
      setGeneratedMarkdown('');
      setActualWordCount(null);
      setIsGenerating(false);
      setCurrentReqIdState(null);
    } else {
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
    setAiStatus('working', 'Makale üretiliyor…');

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

          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }

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
    <Modal
      open={isArticleOpen}
      onClose={() => setArticleOpen(false)}
      locked={isGenerating}
      width={580}
      icon={
        <div className="w-8 h-8 rounded-xl bg-marker text-marker-ink grid place-items-center">
          <PenLine className="w-4 h-4" />
        </div>
      }
      title="Yapay Zekâ ile Makale Yazdır"
      description="Konuyu ve istediğiniz yapıyı belirtin; vText belgenize doğrudan eklesin."
      footer={
        <>
          <button
            type="button"
            onClick={() => setArticleOpen(false)}
            disabled={isGenerating}
            className="btn-quiet"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!topic.trim() || isGenerating}
            className="btn-primary"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isGenerating ? 'Yazılıyor…' : 'Makaleyi Oluştur'}</span>
            {!isGenerating && <ArrowRight className="w-4 h-4 ml-0.5" />}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Konu */}
        <div>
          <label className="field-label">
            Makale Konusu <span className="text-danger">*</span>
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Örn: Yapay zekanın modern yazarlık ve üretkenlik süreçlerine etkileri…"
            rows={3}
            className="field"
            autoFocus
          />
        </div>

        {/* Kelime Sayısı */}
        <div>
          <label className="field-label">Hedef Uzunluk</label>
          <Chips
            value={wordCount}
            onChange={(v) => setWordCount(v)}
            options={WORD_COUNT_OPTIONS}
          />
          {wordCount === 'custom' && (
            <input
              type="text"
              placeholder="Örn: 1200 kelime"
              value={customWordCount}
              onChange={(e) => setCustomWordCount(e.target.value)}
              className="field mt-2 max-w-[200px]"
            />
          )}
        </div>

        {/* Üslup ve Ton */}
        <div>
          <label className="field-label">Üslup ve Ton</label>
          <Chips
            value={tone}
            onChange={(v) => setTone(v)}
            options={TONONE_OPTIONS(TONE_OPTIONS)}
          />
        </div>

        {/* Dil ve Ek Talimatlar */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="field-label">Makale Dili</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="field"
            >
              <option value="tr">🇹🇷 Türkçe</option>
              <option value="en">🇬🇧 İngilizce</option>
              <option value="de">🇩🇪 Almanca</option>
              <option value="es">🇪🇸 İspanyolca</option>
              <option value="fr">🇫🇷 Fransızca</option>
            </select>
          </div>

          <div>
            <label className="field-label">İsteğe Bağlı Yönergeler</label>
            <input
              type="text"
              placeholder="Örn: 3 ana başlık, pratik ipuçları…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="field"
            />
          </div>
        </div>

        {/* Live generation progress banner if working */}
        {isGenerating && (
          <div className="p-3.5 rounded-xl bg-marker/15 border border-marker/40 flex items-center justify-between text-ui">
            <div className="flex items-center gap-2.5 text-marker-ink font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-marker-ink" />
              <span>Yazılıyor… ({actualWordCount || 0} kelime aktarıldı)</span>
            </div>
            <button
              type="button"
              onClick={handleStop}
              className="btn-quiet h-7 px-2 text-danger hover:bg-danger/10"
            >
              <StopCircle className="w-3.5 h-3.5 mr-1" />
              Durdur
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

function TONONE_OPTIONS(opts: Array<{ value: string; label: string }>) {
  return opts;
}
