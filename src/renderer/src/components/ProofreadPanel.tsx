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
    <aside
      aria-label="Yazım ve dil bilgisi denetimi"
      className="w-80 h-full border-l border-line bg-paper flex flex-col z-20 shadow-float text-ink select-none animate-drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-line bg-chrome/40 shrink-0">
        <div className="flex items-center gap-2 font-semibold text-ui text-ink">
          <span className="grid place-items-center w-5 h-5 rounded-md bg-marker text-marker-ink">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <span>Yazım ve Dil Bilgisi</span>
        </div>
        <button
          onClick={() => setProofreadOpen(false)}
          className="icon-btn"
          aria-label="Paneli kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action / Progress bar */}
      <div className="p-3 border-b border-line bg-chrome/20 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-2xs font-medium text-muted truncate">
            {proofreadItems.length > 0
              ? `${proofreadItems.length} öneri bulundu`
              : isScanning
              ? 'Belge taranıyor…'
              : 'Taramaya hazır'}
          </span>
          <button
            onClick={startProofread}
            disabled={isScanning}
            className="btn-primary h-7 px-2.5 text-2xs"
          >
            {isScanning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span>{isScanning ? 'Taranıyor…' : 'Belgeyi Tara'}</span>
          </button>
        </div>

        {proofreadProgress && (
          <div className="w-full bg-ink/10 rounded-full h-1 overflow-hidden">
            <div
              className="bg-accent h-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (proofreadProgress.processed / Math.max(1, proofreadProgress.total)) * 100
                )}%`
              }}
            />
          </div>
        )}
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {proofreadItems.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-xl border border-line bg-chrome/30 hover:bg-chrome/60 transition-colors text-ui space-y-2 shadow-xs"
          >
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="line-through text-danger font-medium px-1.5 py-0.5 rounded bg-danger/10 text-2xs">
                {item.original}
              </span>
              <span className="text-muted text-2xs font-bold">→</span>
              <span className="text-success font-semibold px-1.5 py-0.5 rounded bg-success/10 text-2xs">
                {item.corrected}
              </span>
            </div>

            {item.reason && (
              <p className="text-2xs text-muted leading-relaxed">
                {item.reason}
              </p>
            )}

            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-line/60">
              <button
                onClick={() => handleReject(item)}
                className="btn-quiet h-6 px-2 text-2xs"
              >
                Yoksay
              </button>
              <button
                onClick={() => handleAccept(item)}
                className="btn-outline h-6 px-2.5 text-2xs text-success border-success/30 hover:bg-success/10"
              >
                <Check className="w-3 h-3 mr-1" />
                Kabul et
              </button>
            </div>
          </div>
        ))}

        {!isScanning && proofreadItems.length === 0 && (
          <div className="text-center py-14 px-4 text-ui text-muted">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-marker/15 text-marker-ink grid place-items-center">
              <Sparkles className="w-5 h-5 text-marker-ink" />
            </div>
            <p className="font-semibold text-ink text-ui">Tertemiz Metinler</p>
            <p className="mt-1 text-2xs text-muted max-w-[200px] mx-auto leading-relaxed">
              Yapay zekâ ile belgenizdeki imla ve anlatım bozukluklarını yakalamak için yukarıdaki butona tıklayın.
            </p>
          </div>
        )}
      </div>

      {/* Footer All Accept button */}
      {proofreadItems.length > 0 && (
        <div className="p-3 border-t border-line bg-chrome/40 shrink-0">
          <button
            onClick={handleAcceptAll}
            className="w-full btn-primary h-8 text-ui shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Tümünü Kabul Et ({proofreadItems.length})</span>
          </button>
        </div>
      )}
    </aside>
  );
};

