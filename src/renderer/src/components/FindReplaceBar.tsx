import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { ChevronDown, ChevronUp, X, CaseSensitive, WholeWord, Replace } from 'lucide-react';
import { searchKey } from '../editor/extensions/SearchReplace';

interface FindReplaceBarProps {
  editor: Editor | null;
  mode: 'find' | 'replace';
  onModeChange: (m: 'find' | 'replace') => void;
  onClose: () => void;
}

/** Floating Word/Writer-style Find & Replace bar (Ctrl+F / Ctrl+H). */
export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({ editor, mode, onModeChange, onClose }) => {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [term, setTerm] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);

  // Prefill with the current selection, focus the field
  useEffect(() => {
    if (editor) {
      const { from, to } = editor.state.selection;
      const sel = editor.state.doc.textBetween(from, to, ' ');
      if (sel && sel.length < 100 && !sel.includes('\n')) setTerm(sel);
    }
    setTimeout(() => findRef.current?.select(), 0);
  }, [mode]);

  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', rerender);
    return () => {
      editor.off('transaction', rerender);
    };
  }, [editor]);

  useEffect(() => {
    editor?.commands.setSearch(term, { caseSensitive, wholeWord });
  }, [term, caseSensitive, wholeWord, editor]);

  // Clear highlights on unmount
  useEffect(() => () => void editor?.commands.clearSearch(), [editor]);

  if (!editor) return null;
  const s = searchKey.getState(editor.state);
  const total = s?.matches.length ?? 0;
  const current = total ? (s!.index ?? 0) + 1 : 0;

  const onKey = (e: React.KeyboardEvent, isReplace = false) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      editor.commands.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isReplace) editor.commands.replaceCurrent(replacement);
      else if (e.shiftKey) editor.commands.findPrev();
      else editor.commands.findNext();
    }
  };

  const Toggle: React.FC<{ on: boolean; set: (v: boolean) => void; title: string; children: React.ReactNode }> = ({ on, set, title, children }) => (
    <button onClick={() => set(!on)} data-active={on} title={title} aria-pressed={on} className="icon-btn w-6 h-6">
      {children}
    </button>
  );

  return (
    <div
      className="absolute right-4 top-14 z-30 w-[380px] p-2 rounded-xl bg-paper/95 border border-line shadow-float backdrop-blur-sm animate-in fade-in slide-in-from-top-1"
      role="search"
      aria-label="Bul ve değiştir"
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => onModeChange(mode === 'find' ? 'replace' : 'find')}
          className="icon-btn w-6 h-6"
          title={mode === 'find' ? 'Değiştir alanını göster (Ctrl+H)' : 'Değiştir alanını gizle'}
        >
          {mode === 'find' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        <div className="flex-1 flex items-center h-8 px-2 rounded-md border border-line focus-within:border-accent transition-colors">
          <input
            ref={findRef}
            id="find-input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => onKey(e)}
            placeholder="Bul"
            className="flex-1 min-w-0 bg-transparent text-ui text-ink outline-none"
          />
          <span className={`text-2xs tabular-nums shrink-0 ${term && !total ? 'text-danger' : 'text-muted'}`}>
            {term ? (total ? `${current}/${total}` : 'Sonuç yok') : ''}
          </span>
        </div>
        <Toggle on={caseSensitive} set={setCaseSensitive} title="Büyük/küçük harf duyarlı">
          <CaseSensitive className="w-4 h-4" />
        </Toggle>
        <Toggle on={wholeWord} set={setWholeWord} title="Yalnızca tam sözcük">
          <WholeWord className="w-4 h-4" />
        </Toggle>
        <button onClick={() => editor.commands.findPrev()} disabled={!total} className="icon-btn w-6 h-6" title="Önceki (Shift+Enter)">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button onClick={() => editor.commands.findNext()} disabled={!total} className="icon-btn w-6 h-6" title="Sonraki (Enter)">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="icon-btn w-6 h-6" title="Kapat (Esc)">
          <X className="w-4 h-4" />
        </button>
      </div>

      {mode === 'replace' && (
        <div className="flex items-center gap-1 mt-1.5 pl-7">
          <div className="flex-1 flex items-center h-8 px-2 rounded-md border border-line focus-within:border-accent transition-colors">
            <input
              id="replace-input"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              onKeyDown={(e) => onKey(e, true)}
              placeholder="Değiştir"
              className="flex-1 min-w-0 bg-transparent text-ui text-ink outline-none"
            />
          </div>
          <button
            onClick={() => editor.commands.replaceCurrent(replacement)}
            disabled={!total}
            className="h-8 px-2.5 rounded-md text-ui text-ink hover:bg-ink/[0.06] disabled:opacity-40 flex items-center gap-1"
            title="Bunu değiştir (Enter)"
          >
            <Replace className="w-3.5 h-3.5" />
            Değiştir
          </button>
          <button
            onClick={() => editor.commands.replaceAll(replacement)}
            disabled={!total}
            className="h-8 px-2.5 rounded-md text-ui font-medium text-accent hover:bg-accent/10 disabled:opacity-40"
            title="Tümünü değiştir"
          >
            Tümü
          </button>
        </div>
      )}
    </div>
  );
};
