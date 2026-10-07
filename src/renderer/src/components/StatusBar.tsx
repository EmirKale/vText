import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Sparkles, Loader2, AlertCircle, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import { UpdateStatusData } from '../../../shared/types';

interface StatusBarProps {
  text: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ text }) => {
  const { aiStatus, aiStatusMessage, lastTokensUsed, currentRequestId } = useAppStore();
  const [updateData, setUpdateData] = useState<UpdateStatusData | null>(null);

  useEffect(() => {
    if (!window.kalem?.updater) return;
    const unsub = window.kalem.updater.onStatus((data) => setUpdateData(data));
    return () => unsub();
  }, []);

  // Statistics calculation
  const cleanText = text.replace(/<[^>]*>/g, ' ').trim();
  const words = cleanText.length > 0 ? cleanText.split(/\s+/).filter(Boolean).length : 0;
  const chars = cleanText.length;
  const readingTime = Math.ceil(words / 200);

  const handleAbort = () => {
    if (currentRequestId && window.kalem?.ai) {
      window.kalem.ai.abort(currentRequestId);
    }
  };

  return (
    <div className="h-6 flex items-center justify-between px-3 text-[11px] border-t border-border-light dark:border-border-dark bg-canvas-light/90 dark:bg-canvas-dark/90 text-content-mutedLight dark:text-content-mutedDark select-none">
      {/* Left stats */}
      <div className="flex items-center gap-3">
        <span>Sayfa 1</span>
        <span>•</span>
        <span><strong>{words.toLocaleString()}</strong> Kelime</span>
        <span>•</span>
        <span><strong>{chars.toLocaleString()}</strong> Karakter</span>
        <span>•</span>
        <span>~{readingTime} dk okuma</span>
      </div>

      {/* Right AI & Token & Update status */}
      <div className="flex items-center gap-3">
        {updateData?.status === 'downloaded' && (
          <button
            onClick={() => window.kalem?.updater?.install()}
            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
            title="Uygulamayı yeniden başlat ve güncellemeyi uygula"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>v{updateData.version} hazır (Yükle)</span>
          </button>
        )}
        {updateData?.status === 'downloading' && (
          <div className="flex items-center gap-1 text-accent font-medium">
            <ArrowUpCircle className="w-3 h-3 animate-pulse" />
            <span>Güncelleme (%{updateData.percent ?? 0})</span>
          </div>
        )}

        {lastTokensUsed !== undefined && (
          <span className="opacity-80">Son Token: {lastTokensUsed.toLocaleString()}</span>
        )}

        {aiStatus === 'working' ? (
          <div className="flex items-center gap-1.5 text-accent font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{aiStatusMessage || 'Yapay Zeka Çalışıyor...'}</span>
            <button
              onClick={handleAbort}
              className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              Durdur
            </button>
          </div>
        ) : aiStatus === 'error' ? (
          <div className="flex items-center gap-1 text-red-500 font-medium">
            <AlertCircle className="w-3 h-3" />
            <span className="truncate max-w-[200px]">{aiStatusMessage || 'AI Hatası'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <Sparkles className="w-3 h-3" />
            <span>AI Hazır</span>
          </div>
        )}
      </div>
    </div>
  );
};
