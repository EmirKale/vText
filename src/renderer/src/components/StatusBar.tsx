import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertCircle, ArrowUpCircle, RotateCw, Square } from 'lucide-react';
import { UpdateStatusData } from '../../../shared/types';

interface StatusBarProps {
  text: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ text }) => {
  const { aiStatus, aiStatusMessage, lastTokensUsed, currentRequestId, settings, setStatsOpen } = useAppStore();
  const [updateData, setUpdateData] = useState<UpdateStatusData | null>(null);

  useEffect(() => {
    if (!window.kalem?.updater) return;
    const unsub = window.kalem.updater.onStatus((data) => setUpdateData(data));
    return () => {
      unsub();
    };
  }, []);

  const { words, chars, readingTime } = useMemo(() => {
    const clean = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const w = clean.length > 0 ? clean.split(' ').filter(Boolean).length : 0;
    return { words: w, chars: clean.length, readingTime: Math.max(1, Math.ceil(w / 200)) };
  }, [text]);

  const handleAbort = () => {
    if (currentRequestId && window.kalem?.ai) window.kalem.ai.abort(currentRequestId);
  };

  const modelShort = settings.textModel?.split('/').pop();

  return (
    <footer className="h-7 shrink-0 flex items-center justify-between px-3 text-2xs text-muted bg-chrome border-t border-line select-none tabular-nums">
      <button
        type="button"
        onClick={() => setStatsOpen(true)}
        className="flex items-center gap-3.5 hover:bg-ink/5 px-2 py-0.5 -ml-1 rounded transition-colors text-left group cursor-pointer"
        title="Ayrıntılı belge istatistiklerini görüntüle (Sözcük, karakter, sayfa)"
      >
        <span><span className="text-ink font-medium group-hover:text-accent transition-colors">{words.toLocaleString('tr-TR')}</span> kelime</span>
        <span><span className="text-ink font-medium group-hover:text-accent transition-colors">{chars.toLocaleString('tr-TR')}</span> karakter</span>
        <span>yaklaşık {readingTime} dk okuma</span>
      </button>

      <div className="flex items-center gap-4">
        {updateData?.status === 'downloaded' && (
          <button
            onClick={() => window.kalem?.updater?.install()}
            className="flex items-center gap-1 text-success font-medium hover:underline"
            title="Yeniden başlat ve güncellemeyi yükle"
          >
            <RotateCw className="w-3 h-3" />
            v{updateData.version} hazır, yeniden başlat
          </button>
        )}
        {updateData?.status === 'downloading' && (
          <span className="flex items-center gap-1 text-accent">
            <ArrowUpCircle className="w-3 h-3" />
            Güncelleme indiriliyor %{updateData.percent ?? 0}
          </span>
        )}

        {lastTokensUsed !== undefined && aiStatus !== 'working' && (
          <span title="Son istekte kullanılan token">{lastTokensUsed.toLocaleString('tr-TR')} token</span>
        )}

        {aiStatus === 'working' ? (
          <div className="flex items-center gap-2 text-ink">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-marker animate-ping opacity-70" />
              <span className="relative w-2 h-2 rounded-full bg-marker" />
            </span>
            <span className="font-medium">{aiStatusMessage || 'Yapay zekâ çalışıyor…'}</span>
            {currentRequestId && (
              <button
                onClick={handleAbort}
                className="flex items-center gap-1 h-5 px-1.5 rounded text-danger hover:bg-danger/10 transition-colors"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                Durdur
              </button>
            )}
          </div>
        ) : aiStatus === 'error' ? (
          <div className="flex items-center gap-1.5 text-danger font-medium" title={aiStatusMessage}>
            <AlertCircle className="w-3 h-3" />
            <span className="truncate max-w-[260px]">{aiStatusMessage || 'Yapay zekâ isteği başarısız oldu'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5" title={settings.textModel}>
            <span className={`w-2 h-2 rounded-full ${settings.hasApiKey ? 'bg-marker' : 'bg-line'}`} />
            <span>{settings.hasApiKey ? modelShort : 'API anahtarı eklenmedi'}</span>
          </div>
        )}
      </div>
    </footer>
  );
};
