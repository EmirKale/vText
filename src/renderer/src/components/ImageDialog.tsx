import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Editor } from '@tiptap/react';
import { Image as ImageIcon, X, Loader2, Sparkles, Wand2 } from 'lucide-react';

interface ImageDialogProps {
  editor: Editor | null;
}

export const ImageDialog: React.FC<ImageDialogProps> = ({ editor }) => {
  const { isImageOpen, setImageOpen, selectedTextForAi, setAiStatus } = useAppStore();

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'photorealistic' | 'illustration' | 'minimalist' | '3d' | 'watercolor'>('photorealistic');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:3'>('16:9');
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
    setAiStatus('working', 'Görsel üretiliyor (Seedream)...');

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-[520px] max-w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-content-light dark:text-content-dark">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light dark:border-border-dark bg-canvas-light/50 dark:bg-canvas-dark/50">
          <div className="flex items-center gap-2 font-semibold text-sm text-purple-600 dark:text-purple-400">
            <ImageIcon className="w-4 h-4" />
            <span>🖼️ Yapay Zeka ile Görsel Oluştur (Seedream)</span>
          </div>
          <button
            onClick={() => setImageOpen(false)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-content-mutedLight dark:text-content-mutedDark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5 font-medium">
              <span>Görsel Prompt'u (İngilizce Açıklama)</span>
              {selectedTextForAi && (
                <button
                  onClick={() => generatePromptFromText(selectedTextForAi)}
                  disabled={isGeneratingPrompt}
                  className="flex items-center gap-1 text-[11px] text-accent hover:underline disabled:opacity-50"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>{isGeneratingPrompt ? 'Oluşturuluyor...' : 'Yeniden Üret'}</span>
                </button>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: A minimalist, high-contrast illustration of a modern workspace with digital tablets and warm lighting..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none font-mono text-[11px]"
            />
          </div>

          {/* Stil ve En-Boy Oranı */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1.5">Görsel Stili</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent outline-none cursor-pointer"
              >
                <option value="photorealistic">Fotoğraf Gerçekçi</option>
                <option value="illustration">İllüstrasyon</option>
                <option value="minimalist">Minimal</option>
                <option value="3d">3D Render</option>
                <option value="watercolor">Sulu Boya</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1.5">En-Boy Oranı</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent outline-none cursor-pointer"
              >
                <option value="16:9">16:9 (Geniş Ekran)</option>
                <option value="1:1">1:1 (Kare)</option>
                <option value="4:3">4:3 (Standart)</option>
              </select>
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="block font-medium mb-1.5">Açıklama Yazısı (Caption - İsteğe bağlı)</label>
            <input
              type="text"
              placeholder="Görsel altına eklenecek küçük açıklama metni"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark focus:border-accent outline-none"
            />
          </div>

          {/* Loading Skeleton */}
          {isGeneratingImage && (
            <div className="p-6 rounded-xl border border-dashed border-accent/40 bg-accent/5 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <span className="font-medium text-accent">Görsel oluşturuluyor ve diske kaydediliyor...</span>
              <span className="text-[10px] text-content-mutedLight dark:text-content-mutedDark">
                Model: Seedream 5.0 Lite
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-light dark:border-border-dark bg-canvas-light/30 dark:bg-canvas-dark/30 text-xs">
          <button
            onClick={() => setImageOpen(false)}
            className="px-4 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-content-mutedLight dark:text-content-mutedDark"
          >
            İptal
          </button>
          <button
            onClick={handleGenerateImage}
            disabled={!prompt.trim() || isGeneratingImage}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 shadow-sm transition-all"
          >
            {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isGeneratingImage ? 'Oluşturuluyor...' : 'Görseli Oluştur'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
