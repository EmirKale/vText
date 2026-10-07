import React, { useState, useEffect } from 'react';
import { DownloadCloud, RefreshCw, CheckCircle2, X, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { UpdateStatusData } from '../../../shared/types';

export const UpdateNotification: React.FC = () => {
  const [updateData, setUpdateData] = useState<UpdateStatusData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (!window.kalem?.updater) return;

    const unsubscribe = window.kalem.updater.onStatus((data) => {
      setUpdateData(data);
      // When a new download starts or completes, reopen banner if dismissed
      if (data.status === 'downloading' || data.status === 'downloaded') {
        setIsDismissed(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (isDismissed || !updateData) return null;

  // Only show the floating banner for active downloading, downloaded, or available states
  if (
    updateData.status !== 'downloading' &&
    updateData.status !== 'downloaded' &&
    updateData.status !== 'available'
  ) {
    return null;
  }

  const handleInstallNow = async () => {
    if (!window.kalem?.updater) return;
    setIsInstalling(true);
    await window.kalem.updater.install();
  };

  return (
    <div className="fixed bottom-10 right-6 z-50 max-w-sm w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl p-4 text-content-light dark:text-content-dark animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {updateData.status === 'downloaded' ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <ArrowUpCircle className="w-5 h-5 animate-pulse" />
            </div>
          )}
          <div>
            <h4 className="text-xs font-semibold text-content-light dark:text-content-dark">
              {updateData.status === 'downloaded'
                ? `Güncelleme Hazır (v${updateData.version || ''})`
                : updateData.status === 'downloading'
                  ? `Güncelleme İndiriliyor (v${updateData.version || ''})`
                  : 'Yeni Sürüm Bulundu'}
            </h4>
            <p className="text-[11px] text-content-mutedLight dark:text-content-mutedDark mt-0.5">
              {updateData.status === 'downloaded'
                ? 'Yeni sürüm indirildi. Yeniden başlatarak hemen yükleyebilirsiniz.'
                : updateData.status === 'downloading'
                  ? `Arka planda indiriliyor... %${updateData.percent ?? 0}`
                  : 'Yeni güncelleme paketi hazırlanıyor...'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-content-mutedLight dark:text-content-mutedDark hover:text-content-light dark:hover:text-content-dark p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Kapat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress Bar when downloading */}
      {updateData.status === 'downloading' && (
        <div className="mt-3">
          <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-accent h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, updateData.percent || 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions when downloaded */}
      {updateData.status === 'downloaded' && (
        <div className="mt-3.5 flex items-center gap-2">
          <button
            onClick={handleInstallNow}
            disabled={isInstalling}
            className="flex-1 py-1.5 px-3 bg-accent hover:bg-accent-hover active:bg-accent-active text-white rounded-lg text-xs font-medium transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isInstalling ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Yükleniyor...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Yeniden Başlat ve Yükle</span>
              </>
            )}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="py-1.5 px-2.5 rounded-lg border border-border-light dark:border-border-dark hover:bg-black/5 dark:hover:bg-white/5 text-xs text-content-mutedLight dark:text-content-mutedDark transition-colors"
          >
            Daha Sonra
          </button>
        </div>
      )}
    </div>
  );
};
