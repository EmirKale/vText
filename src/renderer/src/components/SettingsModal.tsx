import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Settings, X, Key, Check, AlertCircle, Loader2, RefreshCw, Cpu, Monitor, FileCode, CheckCircle2, XCircle, DownloadCloud, ArrowUpCircle, GitBranch } from 'lucide-react';
import { OpenRouterModel, UpdateStatusData } from '../../../shared/types';
import { VTextLogo } from './VTextLogo';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setSettingsOpen, settings, updateSettings } = useAppStore();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ valid?: boolean; message?: string } | null>(null);

  const [textModels, setTextModels] = useState<OpenRouterModel[]>([]);
  const [imageModels, setImageModels] = useState<OpenRouterModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const [appVersion, setAppVersion] = useState('1.0.0');
  const [updateRepoInput, setUpdateRepoInput] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [currentUpdateStatus, setCurrentUpdateStatus] = useState<UpdateStatusData | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      loadSettingsAndModels();
      if (window.kalem?.updater) {
        window.kalem.updater.getVersion().then((v) => setAppVersion(v || '1.0.0'));
      }
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!window.kalem?.updater) return;
    const unsub = window.kalem.updater.onStatus((data) => {
      setCurrentUpdateStatus(data);
      if (data.status === 'downloaded') {
        setUpdateFeedback({ type: 'success', message: `Yeni sürüm hazır (v${data.version || ''})! Yüklemek için yeniden başlatın.` });
      } else if (data.status === 'downloading') {
        setUpdateFeedback({ type: 'info', message: `İndiriliyor: %${data.percent ?? 0}` });
      } else if (data.status === 'not-available') {
        setUpdateFeedback({ type: 'info', message: 'Uygulama zaten en güncel sürümde.' });
      } else if (data.status === 'error') {
        setUpdateFeedback({ type: 'error', message: data.message || 'Güncelleme denetlenemedi.' });
      }
    });
    return () => unsub();
  }, []);

  const loadSettingsAndModels = async () => {
    if (!window.kalem) return;

    // Load current settings
    const current = await window.kalem.settings.get();
    updateSettings(current);
    setUpdateRepoInput(current.updateRepo || '');

    // Load live models from OpenRouter
    setIsLoadingModels(true);
    try {
      const models = await window.kalem.ai.getModels();
      setTextModels(models.textModels || []);
      setImageModels(models.imageModels || []);
    } catch {
      // Fallback defaults already handled in main
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!window.kalem) return;
    const res = await window.kalem.settings.saveApiKey(apiKeyInput);
    if (res.success) {
      const current = await window.kalem.settings.get();
      updateSettings(current);
      setApiKeyInput('');
      setKeyTestResult({ valid: true, message: 'Anahtar başarıyla güvenli olarak kaydedildi.' });
    }
  };

  const handleTestKey = async () => {
    if (!window.kalem) return;
    setIsTestingKey(true);
    setKeyTestResult(null);
    try {
      const res = await window.kalem.settings.testApiKey();
      if (res.valid) {
        setKeyTestResult({
          valid: true,
          message: `Bağlantı Başarılı! Kalan / Harcanan: $${(res.usage || 0).toFixed(4)}`
        });
      } else {
        setKeyTestResult({ valid: false, message: res.error || 'Bağlantı kurulamadı.' });
      }
    } catch (err: any) {
      setKeyTestResult({ valid: false, message: err.message });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (!window.kalem?.updater) return;
    setIsCheckingUpdate(true);
    setUpdateFeedback(null);
    try {
      const res = await window.kalem.updater.check();
      if (!res.success) {
        setUpdateFeedback({
          type: res.isDevelopment ? 'info' : 'error',
          message: res.message || res.error || 'Güncelleme denetlenemedi.'
        });
      }
    } catch (err: any) {
      setUpdateFeedback({ type: 'error', message: err.message || 'Hata oluştu.' });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.kalem?.updater) return;
    await window.kalem.updater.install();
  };

  const handleSaveRepo = () => {
    handleSettingChange('updateRepo', updateRepoInput.trim());
    setUpdateFeedback({ type: 'success', message: 'GitHub deposu başarıyla kaydedildi.' });
  };

  const handleSettingChange = (field: keyof typeof settings, val: any) => {
    updateSettings({ [field]: val });
    if (window.kalem) {
      window.kalem.settings.save({ [field]: val });
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-[620px] max-w-full max-h-[90vh] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-content-light dark:text-content-dark">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light dark:border-border-dark bg-canvas-light/50 dark:bg-canvas-dark/50">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <VTextLogo size={18} showText={true} />
            <span className="text-content-mutedLight dark:text-content-mutedDark font-normal">|</span>
            <span>Ayarlar</span>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-content-mutedLight dark:text-content-mutedDark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {/* OpenRouter API Key Section */}
          <div className="p-4 rounded-xl border border-border-light dark:border-border-dark bg-canvas-light/30 dark:bg-canvas-dark/30 space-y-3">
            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-1.5 text-accent">
                <Key className="w-4 h-4" />
                <span>OpenRouter API Anahtarı</span>
              </div>
              {settings.hasApiKey ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aktif ({settings.maskedApiKey})</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Tanımlanmadı</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder={settings.hasApiKey ? 'Yeni anahtar yapıştırın veya değiştirin...' : 'sk-or-v1-...'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark outline-none focus:border-accent"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors shadow-xs"
              >
                Kaydet
              </button>
              <button
                onClick={handleTestKey}
                disabled={isTestingKey || !settings.hasApiKey}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
              >
                {isTestingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span>Test Et</span>
              </button>
            </div>

            {keyTestResult && (
              <div
                className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${
                  keyTestResult.valid
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}
              >
                {keyTestResult.valid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{keyTestResult.message}</span>
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5 font-medium">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-accent" />
                  <span>Metin Modeli (Varsayılan: DeepSeek)</span>
                </span>
                {isLoadingModels && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
              </div>
              <select
                value={settings.textModel}
                onChange={(e) => handleSettingChange('textModel', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark outline-none cursor-pointer"
              >
                {textModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 font-medium">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-500" />
                  <span>Görsel Modeli (Varsayılan: Seedream)</span>
                </span>
              </div>
              <select
                value={settings.imageModel}
                onChange={(e) => handleSettingChange('imageModel', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark outline-none cursor-pointer"
              >
                {imageModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Editor Preferences */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1.5">Varsayılan Tema</label>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark outline-none cursor-pointer"
              >
                <option value="system">Sistem Teması ile Senkronize</option>
                <option value="light">Açık Tema (Minimal Beyaz)</option>
                <option value="dark">Koyu Tema (Göz Yormayan Siyah)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1.5">Yazı Boyutu ({settings.fontSize}px)</label>
              <input
                type="range"
                min="13"
                max="22"
                value={settings.fontSize}
                onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
                className="w-full cursor-pointer accent-accent mt-2"
              />
            </div>
          </div>

          {/* External Tools (Pandoc & LibreOffice) */}
          <div className="p-3.5 rounded-xl border border-border-light dark:border-border-dark bg-canvas-light/20 dark:bg-canvas-dark/20 space-y-2">
            <span className="font-semibold text-content-light dark:text-content-dark flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-blue-500" />
              <span>Harici Belge Dönüştürücü Durumu</span>
            </span>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                {settings.hasPandoc ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-content-mutedLight dark:text-content-mutedDark" />
                )}
                <div>
                  <div className="font-medium">Pandoc</div>
                  <div className="text-[10px] text-content-mutedLight dark:text-content-mutedDark">
                    {settings.hasPandoc ? 'Yüklü (ODT & RTF desteği aktif)' : 'Yüklü değil'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                {settings.hasLibreOffice ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-content-mutedLight dark:text-content-mutedDark" />
                )}
                <div>
                  <div className="font-medium">LibreOffice</div>
                  <div className="text-[10px] text-content-mutedLight dark:text-content-mutedDark">
                    {settings.hasLibreOffice ? 'Yüklü (Eski .doc & ODT aktif)' : 'Yüklü değil'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sürüm ve Otomatik Güncelleme */}
          <div className="p-4 rounded-xl border border-border-light dark:border-border-dark bg-canvas-light/30 dark:bg-canvas-dark/30 space-y-3">
            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-1.5 text-accent">
                <ArrowUpCircle className="w-4 h-4" />
                <span>Sürüm ve Otomatik Güncelleme</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-content-light dark:text-content-dark">
                v{appVersion}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-content-mutedLight dark:text-content-mutedDark">
                Uygulama açıkken yeni sürüm yayınlandığında arka planda indirilip otomatik yüklenmeye hazır hale gelir.
              </div>
              <button
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-xs shrink-0"
              >
                {isCheckingUpdate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Güncellemeleri Denetle</span>
              </button>
            </div>

            {/* If update downloaded */}
            {currentUpdateStatus?.status === 'downloaded' && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Yeni sürüm indirildi (v{currentUpdateStatus.version}).</span>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors"
                >
                  Yeniden Başlat ve Yükle
                </button>
              </div>
            )}

            {/* Update Feedback Alert */}
            {updateFeedback && currentUpdateStatus?.status !== 'downloaded' && (
              <div
                className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${
                  updateFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : updateFeedback.type === 'error'
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                }`}
              >
                {updateFeedback.type === 'success' ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : updateFeedback.type === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{updateFeedback.message}</span>
              </div>
            )}

            {/* GitHub Repo Configuration & Auto-check Toggle */}
            <div className="pt-2 border-t border-border-light/60 dark:border-border-dark/60 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.autoCheckUpdates !== false}
                    onChange={(e) => handleSettingChange('autoCheckUpdates', e.target.checked)}
                    className="rounded border-border-light dark:border-border-dark text-accent focus:ring-0"
                  />
                  <span>Uygulama açılışında güncellemeleri otomatik denetle</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-content-mutedLight dark:text-content-mutedDark shrink-0">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="text-[11px]">GitHub Deposu:</span>
                </div>
                <input
                  type="text"
                  placeholder="örn: kullaniciadi/vText"
                  value={updateRepoInput}
                  onChange={(e) => setUpdateRepoInput(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-[11px] rounded border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark outline-none focus:border-accent font-mono"
                />
                <button
                  onClick={handleSaveRepo}
                  className="px-2.5 py-1 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[11px] font-medium transition-colors"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-border-light dark:border-border-dark bg-canvas-light/30 dark:bg-canvas-dark/30 text-xs">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-5 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors shadow-sm"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
