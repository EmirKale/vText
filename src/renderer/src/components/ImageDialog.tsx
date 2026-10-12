import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Editor } from '@tiptap/react';
import { ImagePlus, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Modal, Chips } from './ui/Modal';

interface ImageDialogProps {
  editor: Editor | null;
}

type ImageStyle = 'photorealistic' | 'illustration' | 'minimalist' | '3d' | 'watercolor';
type AspectRatio = '16:9' | '1:1' | '4:3';

const STYLE_OPTIONS: Array<{ value: ImageStyle; label: string }> = [
  { value: 'photorealistic', label: 'Fotoğraf' },
  { value: 'illustration', label: 'İllüstrasyon' },
  { value: 'minimalist', label: 'Minimal' },
  { value: '3d', label: '3D Render' },
  { value: 'watercolor', label: 'Sulu Boya' }
];

const ASPECT_OPTIONS: Array<{ value: AspectRatio; label: string }> = [
  { value: '16:9', label: '16:9 (Geniş)' },
  { value: '1:1', label: '1:1 (Kare)' },
  { value: '4:3', label: '4:3 (Standart)' }
];

export const ImageDialog: React.FC<ImageDialogProps> = ({ editor }) => {
  const { isImageOpen, setImageOpen, selectedTextForAi, setAiStatus } = useAppStore();

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('photorealistic');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [caption, setCaption] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  useEffect(() => {
    if (isImageOpen && selectedTextForAi && selectedTextForAi.trim().length > 0) {
      generatePromptFromText(selectedTextForAi);
    }
  }, [isImageOpen, selectedTextForAi]);

  const generatePromptFromText = async (text: string) => {
    if (!window.kalem?.ai) return;
    setIsGeneratingPrompt(true);
    try {
      const generated = await window.kalem.ai.generateImagePrompt(text);
      setPrompt(generated);
    } catch {
      setPrompt(text.slice(0, 100));
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim() || !window.kalem?.ai) return;

    setIsGeneratingImage(true);
    setAiStatus('working', 'Görsel üretiliyor (Seedream)…');

    try {
      const result = await window.kalem.ai.generateImage({
        prompt,
        style,
        aspectRatio
      });

      if (editor && result.assetUrl) {
        editor
          .chain()
          .focus()
          .setImage({ src: result.assetUrl, alt: caption || prompt })
          .run();

        if (caption.trim()) {
          editor.chain().focus().insertContent(`<p><em>${caption}</em></p>`).run();
        }
      }

      setAiStatus('idle', undefined, result.totalTokens);
      setImageOpen(false);
    } catch (err: any) {
      setAiStatus('error', err.message);
      alert(`Görsel üretme hatası: ${err.message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  if (!isImageOpen) return null;

  return (
    <Modal
      open={isImageOpen}
      onClose={() => setImageOpen(false)}
      locked={isGeneratingImage}
      width={540}
      icon={
        <div className="w-8 h-8 rounded-xl bg-marker text-marker-ink grid place-items-center">
          <ImagePlus className="w-4 h-4" />
        </div>
      }
      title="Yapay Zekâ ile Görsel Oluştur"
      description="Prompt girin veya seçili metinden türetip belgenize illüstrasyon ekleyin."
      footer={
        <>
          <button
            type="button"
            onClick={() => setImageOpen(false)}
            disabled={isGeneratingImage}
            className="btn-quiet"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleGenerateImage}
            disabled={!prompt.trim() || isGeneratingImage}
            className="btn-primary"
          >
            {isGeneratingImage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isGeneratingImage ? 'Oluşturuluyor…' : 'Görseli Belgeye Ekle'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="field-label mb-0">Görsel Açıklaması (Prompt)</label>
            {selectedTextForAi && (
              <button
                type="button"
                onClick={() => generatePromptFromText(selectedTextForAi)}
                disabled={isGeneratingPrompt}
                className="inline-flex items-center gap-1 text-2xs text-accent hover:underline disabled:opacity-50"
              >
                <Wand2 className="w-3 h-3" />
                <span>{isGeneratingPrompt ? 'Üretiliyor…' : 'Metinden Yeniden Türet'}</span>
              </button>
            )}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Örn: A minimalist, high-contrast illustration of a modern workspace with books and warm sunlight…"
            rows={3}
            className="field font-mono text-[12px]"
            autoFocus
          />
        </div>

        {/* Görsel Stili */}
        <div>
          <label className="field-label">Görsel Stili</label>
          <Chips
            value={style}
            onChange={(v) => setStyle(v)}
            options={STYLE_OPTIONS}
          />
        </div>

        {/* En-Boy Oranı */}
        <div>
          <label className="field-label">En-Boy Oranı</label>
          <Chips
            value={aspectRatio}
            onChange={(v) => setAspectRatio(v)}
            options={ASPECT_OPTIONS}
          />
        </div>

        {/* Caption */}
        <div>
          <label className="field-label">Görsel Altı Açıklaması (İsteğe bağlı)</label>
          <input
            type="text"
            placeholder="Belgede görselin altına italik olarak yerleşecek açıklama metni"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="field"
          />
        </div>

        {/* Loading skeleton */}
        {isGeneratingImage && (
          <div className="p-5 rounded-xl border border-line bg-chrome/40 flex flex-col items-center justify-center gap-2 text-center text-ui">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <p className="font-medium text-ink">Görsel üretiliyor ve yerel varlık olarak kaydediliyor…</p>
            <p className="text-2xs text-muted">Model: Seedream 5.0 Lite</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
