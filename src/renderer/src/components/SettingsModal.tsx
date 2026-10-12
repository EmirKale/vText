import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Key,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cpu,
  FileCode,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  GitBranch,
  Settings2
} from 'lucide-react';
import { OpenRouterModel, UpdateStatusData } from '../../../shared/types';
import { Modal } from './ui/Modal';
import { applyTheme } from '../lib/theme';

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
        setUpdateFeedback({
          type: 'success',
          message: `Yeni sürüm hazır (v${data.version || ''})! Yüklemek için yeniden başlatın.`
        });
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

    const current = await window.kalem.settings.get();
    updateSettings(current);
    setUpdateRepoInput(current.updateRepo || '');

    setIsLoadingModels(true);
    try {
      const models = await window.kalem.ai.getModels();
      setTextModels(models.textModels || []);
      setImageModels(models.imageModels || []);
    } catch {
      // Fallbacks handled in main
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
          message: `Bağlantı başarılı! Kalan / Harcanan: $${(res.usage || 0).toFixed(4)}`
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
    setUpdateFeedback({ type: 'success', message: 'GitHub deposu kaydedildi.' });
  };

  const handleSettingChange = (field: keyof typeof settings, val: any) => {
    updateSettings({ [field]: val });
    if (field === 'theme') {
      applyTheme(val);
    }
    if (window.kalem) {
      window.kalem.settings.save({ [field]: val });
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <Modal
      open={isSettingsOpen}
      onClose={() => setSettingsOpen(false)}
      width={620}
      icon={
        <div className="w-8 h-8 rounded-xl bg-ink/[0.08] text-ink grid place-items-center">
          <Settings2 className="w-4 h-4" />
        </div>
      }
      title="Ayarlar"
      description="Yapay zekâ anahtarları, model seçimleri, tema ve belge tercihleri."
      footer={
        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className="btn-primary"
        >
          Tamam
        </button>
      }
    >
      <div className="space-y-4">
        {/* OpenRouter API Key Section */}
        <div className="p-4 rounded-xl border border-line bg-chrome/30 space-y-3">
          <div className="flex items-center justify-between font-semibold text-ui">
            <div className="flex items-center gap-1.5 text-ink">
              <Key className="w-4 h-4 text-accent" />
              <span>OpenRouter API Anahtarı</span>
            </div>
            {settings.hasApiKey ? (
              <span className="flex items-center gap-1 text-2xs text-success font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aktif ({settings.maskedApiKey})</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-2xs text-danger font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Tanımlanmadı</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder={settings.hasApiKey ? 'Yeni anahtar yapıştırın…' : 'sk-or-v1-…'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="field flex-1"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim()}
              className="btn-primary h-9 px-3"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTestingKey || !settings.hasApiKey}
              className="btn-outline h-9 px-3"
            >
              {isTestingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              <span>Test Et</span>
            </button>
          </div>

          {keyTestResult && (
            <div
              className={`p-2.5 rounded-lg text-2xs flex items-center gap-2 ${
                keyTestResult.valid
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-danger/10 text-danger border border-danger/20'
              }`}
            >
              {keyTestResult.valid ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{keyTestResult.message}</span>
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5 font-medium text-ui">
              <span className="flex items-center gap-1.5 text-ink">
                <Cpu className="w-3.5 h-3.5 text-accent" />
                <span>Metin Modeli</span>
              </span>
              {isLoadingModels && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
            </div>
            <select
              value={settings.textModel}
              onChange={(e) => handleSettingChange('textModel', e.target.value)}
              className="field"
            >
              {textModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 font-medium text-ui">
              <span className="flex items-center gap-1.5 text-ink">
                <Cpu className="w-3.5 h-3.5 text-accent" />
                <span>Görsel Modeli</span>
              </span>
            </div>
            <select
              value={settings.imageModel}
              onChange={(e) => handleSettingChange('imageModel', e.target.value)}
              className="field"
            >
              {imageModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preferences */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Uygulama Teması</label>
            <select
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value)}
              className="field"
            >
              <option value="system">Sistem ile Senkronize</option>
              <option value="light">Açık Tema (Doğal Kağıt)</option>
              <option value="dark">Koyu Tema (Derin Mürekkep)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="field-label mb-0">Yazı Boyutu</label>
              <span className="text-2xs font-mono text-muted">{settings.fontSize} px</span>
            </div>
            <input
              type="range"
              min="13"
              max="22"
              value={settings.fontSize}
              onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
              className="w-full cursor-pointer accent-accent mt-2.5"
            />
          </div>
        </div>

        {/* External Tools (Pandoc & LibreOffice) */}
        <div className="p-3.5 rounded-xl border border-line bg-chrome/20 space-y-2">
          <span className="font-semibold text-ui text-ink flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-accent" />
            <span>Harici Dönüştürücüler</span>
          </span>
          <div className="grid grid-cols-2 gap-3 text-2xs">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-paper border border-line">
              {settings.hasPandoc ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-muted shrink-0" />
              )}
              <div>
                <div className="font-medium text-ink">Pandoc</div>
                <div className="text-muted">
                  {settings.hasPandoc ? 'Yüklü (ODT & RTF desteği aktif)' : 'Yüklü değil'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-paper border border-line">
              {settings.hasLibreOffice ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-muted shrink-0" />
              )}
              <div>
                <div className="font-medium text-ink">LibreOffice</div>
                <div className="text-muted">
                  {settings.hasLibreOffice ? 'Yüklü (Eski .doc & ODT aktif)' : 'Yüklü değil'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sürüm ve Otomatik Güncelleme */}
        <div className="p-4 rounded-xl border border-line bg-chrome/30 space-y-3">
          <div className="flex items-center justify-between font-semibold text-ui">
            <div className="flex items-center gap-1.5 text-ink">
              <ArrowUpCircle className="w-4 h-4 text-accent" />
              <span>Sürüm & Güncelleme</span>
            </div>
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-ink/[0.06] text-ink">
              v{appVersion}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-2xs text-muted leading-relaxed">
              Yeni sürüm yayınlandığında arka planda indirilip onayınızla uygulanır.
            </p>
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdate}
              className="btn-outline h-8 px-3 shrink-0 text-ui"
            >
              {isCheckingUpdate ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              <span>Denetle</span>
            </button>
          </div>

          {currentUpdateStatus?.status === 'downloaded' && (
            <div className="p-2.5 rounded-lg bg-success/10 border border-success/20 text-success flex items-center justify-between">
              <div className="flex items-center gap-2 text-2xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Yeni sürüm indirildi (v{currentUpdateStatus.version}).</span>
              </div>
              <button
                type="button"
                onClick={handleInstallUpdate}
                className="btn-primary h-7 px-2.5 text-2xs bg-success hover:bg-success/90"
              >
                Yeniden Başlat ve Yükle
              </button>
            </div>
          )}

          {updateFeedback && currentUpdateStatus?.status !== 'downloaded' && (
            <div
              className={`p-2.5 rounded-lg text-2xs flex items-center gap-2 ${
                updateFeedback.type === 'success'
                  ? 'bg-success/10 text-success border border-success/20'
                  : updateFeedback.type === 'error'
                  ? 'bg-danger/10 text-danger border border-danger/20'
                  : 'bg-accent/10 text-accent border border-accent/20'
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

          <div className="pt-2 border-t border-line/60 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-2xs text-ink">
              <input
                type="checkbox"
                checked={settings.autoCheckUpdates !== false}
                onChange={(e) => handleSettingChange('autoCheckUpdates', e.target.checked)}
                className="rounded border-line text-accent focus:ring-0"
              />
              <span>Açılışta güncellemeleri otomatik denetle</span>
            </label>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-muted shrink-0 text-2xs">
                <GitBranch className="w-3.5 h-3.5" />
                <span>GitHub Deposu:</span>
              </div>
              <input
                type="text"
                placeholder="örn: EmirKale/vText"
                value={updateRepoInput}
                onChange={(e) => setUpdateRepoInput(e.target.value)}
                className="field h-8 flex-1 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={handleSaveRepo}
                className="btn-ghost h-8 px-2.5 text-2xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
