import React, { useState, useEffect, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { ListTree, Search, X, ChevronRight, FileText, PlusCircle, Compass } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface NavigatorPanelProps {
  editor: Editor | null;
}

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

export const NavigatorPanel: React.FC<NavigatorPanelProps> = ({ editor }) => {
  const { isNavigatorOpen, setNavigatorOpen } = useAppStore();
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [filterText, setFilterText] = useState('');

  // Extract headings from ProseMirror doc whenever editor updates
  useEffect(() => {
    if (!editor) return;

    const extract = () => {
      const items: HeadingItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const text = node.textContent?.trim();
          if (text) {
            items.push({
              id: `h-${pos}`,
              level: node.attrs.level || 1,
              text,
              pos
            });
          }
        }
      });
      setHeadings(items);
    };

    extract();
    editor.on('transaction', extract);
    return () => {
      editor.off('transaction', extract);
    };
  }, [editor]);

  const filteredHeadings = useMemo(() => {
    if (!filterText.trim()) return headings;
    const lower = filterText.toLowerCase();
    return headings.filter((h) => h.text.toLowerCase().includes(lower));
  }, [headings, filterText]);

  if (!isNavigatorOpen) return null;

  const scrollToHeading = (pos: number) => {
    if (!editor) return;
    try {
      const dom = editor.view.domAtPos(pos + 1)?.node as HTMLElement | undefined;
      const el = dom && (dom.nodeType === 3 ? dom.parentElement : dom);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      editor.commands.setTextSelection(pos + 1);
      editor.commands.focus();
    } catch {
      // Fallback
      editor.commands.focus(pos + 1);
    }
  };

  const handleInsertTOC = () => {
    if (!editor) return;
    if (headings.length === 0) {
      alert('İçindekiler tablosu oluşturmak için belgenize en az bir başlık (Başlık 1, 2 veya 3) ekleyin.');
      return;
    }

    const listItems = headings
      .map(
        (h) =>
          `<li style="margin-left: ${(h.level - 1) * 16}px; margin-bottom: 4px;">
            <span>${h.level === 1 ? '• ' : '– '}<strong>${h.text}</strong></span>
          </li>`
      )
      .join('');

    const tocHtml = `
      <div class="callout callout-info" data-callout="info" style="margin: 20px 0; padding: 14px 18px; border-radius: 8px;">
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">
          📑 İÇİNDEKİLER
        </p>
        <ul style="list-style: none; padding-left: 0; margin: 0; font-size: 13.5px; line-height: 1.6;">
          ${listItems}
        </ul>
      </div>
      <p></p>
    `;

    editor.chain().focus().insertContent(tocHtml).run();
  };

  return (
    <aside
      className="w-64 h-full bg-chrome/95 border-r border-line flex flex-col shrink-0 select-none no-print z-20 animate-in fade-in slide-in-from-left-2 duration-150"
      aria-label="Belge Gezgini"
    >
      {/* Header */}
      <div className="h-10 px-3 border-b border-line flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ListTree className="w-4 h-4 text-accent" />
          <span className="text-ui font-semibold text-ink">Gezgin</span>
          <span className="text-2xs px-1.5 py-0.5 rounded-full bg-ink/[0.06] text-muted tabular-nums">
            {headings.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleInsertTOC}
            title="İçindekiler tablosu ekle"
            className="icon-btn w-6 h-6"
          >
            <PlusCircle className="w-3.5 h-3.5 text-accent" />
          </button>
          <button
            onClick={() => setNavigatorOpen(false)}
            title="Gezgini kapat"
            className="icon-btn w-6 h-6"
          >
            <X className="w-3.5 h-3.5 text-muted hover:text-ink" />
          </button>
        </div>
      </div>

      {/* Filter input */}
      {headings.length > 3 && (
        <div className="p-2 border-b border-line shrink-0">
          <div className="flex items-center h-7 px-2 rounded-md bg-paper border border-line focus-within:border-accent transition-colors">
            <Search className="w-3 h-3 text-muted mr-1.5 shrink-0" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Başlıklarda ara..."
              className="w-full bg-transparent text-ui text-ink outline-none placeholder:text-muted/70 text-xs"
            />
            {filterText && (
              <button onClick={() => setFilterText('')} className="text-muted hover:text-ink">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Headings list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredHeadings.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted">
            <Compass className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-ui font-medium text-ink/80 text-xs mb-1">
              {headings.length === 0 ? 'Başlık bulunamadı' : 'Eşleşen başlık yok'}
            </p>
            <p className="text-2xs text-muted/80 leading-relaxed">
              {headings.length === 0
                ? 'Belgenizde Başlık 1, 2 veya 3 kullandığınızda burada hiyerarşik olarak listelenecektir.'
                : 'Arama terimiyle eşleşen başlık bulunamadı.'}
            </p>
          </div>
        ) : (
          filteredHeadings.map((h) => {
            const indentClass =
              h.level === 1 ? 'pl-2 font-medium text-ink' : h.level === 2 ? 'pl-5 text-ink/80' : 'pl-8 text-muted';

            const badgeBg =
              h.level === 1
                ? 'bg-accent/15 text-accent font-semibold'
                : h.level === 2
                ? 'bg-ink/[0.06] text-muted'
                : 'bg-transparent text-muted/60';

            return (
              <button
                key={h.id}
                onClick={() => scrollToHeading(h.pos)}
                className={`w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-left text-xs transition-colors hover:bg-ink/[0.05] group ${indentClass}`}
                title={`${h.text} (Başlık ${h.level})`}
              >
                <span className={`text-[9.5px] px-1 py-0.2 rounded font-mono shrink-0 ${badgeBg}`}>
                  H{h.level}
                </span>
                <span className="truncate flex-1">{h.text}</span>
                <ChevronRight className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            );
          })
        )}
      </div>

      {/* Footer helper */}
      {headings.length > 0 && (
        <div className="p-2 border-t border-line shrink-0 bg-paper/50">
          <button
            onClick={handleInsertTOC}
            className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md text-2xs font-medium text-accent hover:bg-accent/10 transition-colors"
          >
            <FileText className="w-3 h-3" />
            İçindekiler Tablosu Ekle
          </button>
        </div>
      )}
    </aside>
  );
};
