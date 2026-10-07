import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Editor } from '@tiptap/react';
import { CheckCircle, X, Check, Trash2, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { ProofreadItem } from '../../../shared/types';

interface ProofreadPanelProps {
  editor: Editor | null;
}

export const ProofreadPanel: React.FC<ProofreadPanelProps> = ({ editor }) => {
  const {
    isProofreadOpen,
    setProofreadOpen,
    proofreadItems,
    setProofreadItems,
    removeProofreadItem,
    proofreadProgress,
    setProofreadProgress,
    setAiStatus
  } = useAppStore();

  const [isScanning, setIsScanning] = useState(false);

  if (!isProofreadOpen) return null;

  const startProofread = async () => {
    if (!editor) return;

    setIsScanning(true);
    setProofreadItems([]);
    setProofreadProgress({ processed: 0, total: 1 });
    setAiStatus('working', 'Belge hataları taranıyor...');

    // Extract blocks from TipTap doc ignoring codeBlock and promptBlock
    const blocks: Array<{ id: string; text: string; index: number }> = [];
    editor.state.doc.descendants((node, pos, parent, index) => {
      if (node.isBlock && node.type.name !== 'codeBlock' && node.type.name !== 'promptBlock') {
        const text = node.textContent?.trim();
        if (text && text.length > 5 && !node.hasMarkup(editor.schema.nodes.table)) {
          blocks.push({
            id: `b-${pos}`,
            text,
            index
          });
        }
      }
      return true;
    });

    if (blocks.length === 0) {
      setIsScanning(false);
      setProofreadProgress(null);
      setAiStatus('idle');
      alert('Taranacak uygun metin bloğu bulunamadı.');
      return;
    }

    if (window.kalem?.ai) {
      const requestId = `pf-${Date.now()}`;
      try {
        const results = await window.kalem.ai.proofread(
          requestId,
          blocks,
          (progress) => {
            setProofreadProgress(progress);
          }
        );

        setProofreadItems(results);
        setIsScanning(false);
        setProofreadProgress(null);
        setAiStatus('idle');
      } catch (err: any) {
        setIsScanning(false);
        setProofreadProgress(null);
        setAiStatus('error', err.message);
        alert(`Tarama hatası: ${err.message}`);
      }
    }
  };

  const handleAccept = (item: ProofreadItem) => {
    if (!editor) return;
    // Use ProseMirror's text search to find and replace safely (avoid HTML tag corruption)
    const { doc } = editor.state;
    let found = false;
    doc.descendants((node, pos) => {
      if (found) return false;
      if (node.isText && node.text) {
        const idx = node.text.indexOf(item.original);
        if (idx !== -1) {
          const from = pos + idx;
          const to = from + item.original.length;
          editor.chain().focus().insertContentAt({ from, to }, item.corrected).run();
          found = true;
          return false;
        }
      }
      return true;
    });
    removeProofreadItem(item.id);
  };

  const handleReject = (item: ProofreadItem) => {
    removeProofreadItem(item.id);
  };

  const handleAcceptAll = () => {
    if (!editor) return;
    // Apply all corrections using text positions (process in reverse order to avoid position shifts)
    const corrections = [...proofreadItems];
    
    // Collect all text positions first
    const replacements: Array<{ from: number; to: number; corrected: string }> = [];
    const { doc } = editor.state;
    
    for (const item of corrections) {
      doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const idx = node.text.indexOf(item.original);
          if (idx !== -1) {
            const from = pos + idx;
            const to = from + item.original.length;
            // Check this position hasn't been claimed
            const alreadyClaimed = replacements.some(r => 
              (from >= r.from && from < r.to) || (to > r.from && to <= r.to)
            );
            if (!alreadyClaimed) {
              replacements.push({ from, to, corrected: item.corrected });
              return false; // stop searching for this item
            }
          }
        }
        return true;
      });
    }
    
    // Apply in reverse position order so earlier replacements don't shift later positions
    replacements.sort((a, b) => b.from - a.from);
    
    let chain = editor.chain().focus();
    for (const r of replacements) {
      chain = chain.insertContentAt({ from: r.from, to: r.to }, r.corrected) as any;
    }
    chain.run();
    
    setProofreadItems([]);
  };

  return (
    <div className="w-80 h-full border-l border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark flex flex-col z-20 shadow-lg text-content-light dark:text-content-dark select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light dark:border-border-dark bg-canvas-light/40 dark:bg-canvas-dark/40">
        <div className="flex items-center gap-2 font-semibold text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          <span>Hataları Düzelt</span>
        </div>
        <button
          onClick={() => setProofreadOpen(false)}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-content-mutedLight dark:text-content-mutedDark"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action / Progress bar */}
      <div className="p-3 border-b border-border-light dark:border-border-dark text-xs bg-canvas-light/20 dark:bg-canvas-dark/20">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-content-mutedLight dark:text-content-mutedDark">
            {proofreadItems.length > 0
              ? `${proofreadItems.length} düzeltme önerisi`
              : 'Henüz tarama yapılmadı'}
          </span>
          <button
            onClick={startProofread}
            disabled={isScanning}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-xs"
          >
            {isScanning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span>{isScanning ? 'Taranıyor...' : 'Belgeyi Tara'}</span>
          </button>
        </div>

        {/* Progress indicator */}
        {proofreadProgress && (
          <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-accent h-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (proofreadProgress.processed / Math.max(1, proofreadProgress.total)) * 100
                )}%`
              }}
            ></div>
          </div>
        )}
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {proofreadItems.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-lg border border-border-light dark:border-border-dark bg-canvas-light/50 dark:bg-canvas-dark/50 text-xs space-y-1.5 shadow-xs"
          >
            {/* Comparison */}
            <div className="flex items-center gap-2">
              <span className="line-through text-red-500 font-medium px-1.5 py-0.5 rounded bg-red-500/10">
                {item.original}
              </span>
              <span className="text-content-mutedLight dark:text-content-mutedDark font-bold">→</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10">
                {item.corrected}
              </span>
            </div>

            {/* Reason */}
            {item.reason && (
              <div className="text-[11px] text-content-mutedLight dark:text-content-mutedDark">
                {item.reason}
              </div>
            )}

            {/* Accept / Reject buttons */}
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                onClick={() => handleReject(item)}
                title="Reddet"
                className="flex items-center gap-1 px-2 py-1 rounded text-content-mutedLight dark:text-content-mutedDark hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-3 h-3 text-red-500" />
                <span>Yoksay</span>
              </button>
              <button
                onClick={() => handleAccept(item)}
                title="Kabul Et"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 font-medium transition-colors"
              >
                <Check className="w-3 h-3" />
                <span>Kabul Et</span>
              </button>
            </div>
          </div>
        ))}

        {!isScanning && proofreadItems.length === 0 && (
          <div className="text-center py-10 px-4 text-xs text-content-mutedLight dark:text-content-mutedDark">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-accent opacity-50" />
            <p className="font-medium text-content-light dark:text-content-dark">Yazım ve Dil Bilgisi Denetimi</p>
            <p className="mt-1 text-[11px]">
              Belgenizdeki hataları bulmak için yukarıdaki <strong>Belgeyi Tara</strong> butonuna basın.
            </p>
          </div>
        )}
      </div>

      {/* Footer All Accept button */}
      {proofreadItems.length > 0 && (
        <div className="p-3 border-t border-border-light dark:border-border-dark bg-canvas-light/40 dark:bg-canvas-dark/40">
          <button
            onClick={handleAcceptAll}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Tümünü Kabul Et ({proofreadItems.length})</span>
          </button>
        </div>
      )}
    </div>
  );
};
