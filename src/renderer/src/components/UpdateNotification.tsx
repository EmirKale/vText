import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, X, ArrowUpCircle } from 'lucide-react';
import { UpdateStatusData } from '../../../shared/types';
import { useAppStore } from '../store/useAppStore';

export const UpdateNotification: React.FC = () => {
  const [updateData, setUpdateData] = useState<UpdateStatusData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (!window.kalem?.updater) return;

    const unsubscribe = window.kalem.updater.onStatus((data) => {
      setUpdateData(data);
      if (data.status === 'downloading' || data.status === 'downloaded') {
        setIsDismissed(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (isDismissed || !updateData) return null;

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
    const tabs = useAppStore.getState().tabs;
    const hasDirtyTabs = tabs.some((t) => t.isDirty);
    const result = await window.kalem.updater.install({ hasDirtyTabs });
    if (result && !result.success) {
      setIsInstalling(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-10 right-6 z-50 max-w-sm w-full bg-paper border border-line rounded-2xl shadow-modal p-4 text-ink animate-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {updateData.status === 'downloaded' ? (
            <div className="w-8 h-8 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <ArrowUpCircle className="w-4 h-4 animate-pulse" />
            </div>
          )}
          <div>
            <h4 className="text-ui font-semibold text-ink">
              {updateData.status === 'downloaded'
                ? `Güncelleme Hazır (v${updateData.version || ''})`
                : updateData.status === 'downloading'
                ? `Güncelleme İndiriliyor (v${updateData.version || ''})`
                : 'Yeni Sürüm Bulundu'}
            </h4>
            <p className="text-2xs text-muted mt-0.5 leading-relaxed">
              {updateData.status === 'downloaded'
                ? 'Yeni sürüm hazır. Yeniden başlatıp hemen geçiş yapabilirsiniz.'
                : updateData.status === 'downloading'
                ? `Arka planda indiriliyor… %${updateData.percent ?? 0}`
                : 'Yeni güncelleme paketi hazırlanıyor…'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="icon-btn -mr-1 -mt-1"
          title="Kapat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {updateData.status === 'downloading' && (
        <div className="mt-3">
          <div className="w-full bg-ink/10 rounded-full h-1 overflow-hidden">
            <div
              className="bg-accent h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, updateData.percent || 0)}%` }}
            />
          </div>
        </div>
      )}

      {updateData.status === 'downloaded' && (
        <div className="mt-3.5 flex items-center gap-2">
          <button
            onClick={handleInstallNow}
            disabled={isInstalling}
            className="flex-1 btn-primary h-8 text-ui gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isInstalling ? 'animate-spin' : ''}`} />
            <span>{isInstalling ? 'Yükleniyor…' : 'Yeniden Başlat ve Yükle'}</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="btn-quiet h-8 text-ui"
          >
            Daha Sonra
          </button>
        </div>
      )}
    </div>
  );
};
