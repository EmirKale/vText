import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { useAppStore } from '../store/useAppStore';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Terminal,
  Info,
  Undo2,
  Redo2,
  Plus,
  ChevronDown,
  Minus,
  Check,
  AlignJustify,
  Subscript as SubIcon,
  Superscript as SupIcon,
  RemoveFormatting,
  Baseline,
  Highlighter,
  ArrowUpDown,
  FileDown,
  Trash2
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
}

const BLOCK_TYPES = [
  { id: 'p', label: 'Paragraf', preview: 'text-[13px]' },
  { id: 'h1', label: 'Başlık 1', preview: 'text-[17px] font-semibold' },
  { id: 'h2', label: 'Başlık 2', preview: 'text-[15px] font-semibold' },
  { id: 'h3', label: 'Başlık 3', preview: 'text-[13.5px] font-semibold' }
] as const;

const FONT_FAMILIES = [
  { label: 'Varsayılan', value: '' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Calibri', value: 'Calibri' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Segoe UI', value: 'Segoe UI' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Cambria', value: 'Cambria' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Consolas', value: 'Consolas' }
];

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'];

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#FFFFFF',
  '#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#2980B9', '#8E44AD',
  '#E6B0AA', '#F5CBA7', '#F9E79F', '#A9DFBF', '#AED6F1', '#D2B4DE',
  '#7B241C', '#9C640C', '#9A7D0A', '#196F3D', '#1B4F72', '#512E5F'
];

const HIGHLIGHT_COLORS = [
  '#FFF59D', '#C5E1A5', '#80DEEA', '#F8BBD0', '#FFCC80', '#CE93D8',
  '#FFEB3B', '#8BC34A', '#00BCD4', '#F06292', '#FF9800', '#BA68C8'
];

const LINE_HEIGHTS = ['1.0', '1.15', '1.5', '1.7', '2.0', '2.5', '3.0'];

/** Close a popover when clicking outside of it. */
function useOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, onOutside, ref]);
}

const Sep = () => <span className="w-px h-4 bg-line mx-1 shrink-0" />;

const Btn: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    data-active={!!active}
    disabled={disabled}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className="icon-btn shrink-0"
  >
    {children}
  </button>
);

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  const { setToolbarMenuOpen } = useAppStore();
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [openMenu, setOpenMenu] = useState<null | 'block' | 'insert' | 'font' | 'size' | 'color' | 'highlight' | 'spacing' | 'table'>(null);
  const spacingRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);
  const fontRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [sizeInput, setSizeInput] = useState('');

  useOutside(blockRef, () => setOpenMenu(null), openMenu === 'block');
  useOutside(insertRef, () => setOpenMenu(null), openMenu === 'insert');
  useOutside(fontRef, () => setOpenMenu(null), openMenu === 'font');
  useOutside(sizeRef, () => setOpenMenu(null), openMenu === 'size');
  useOutside(colorRef, () => setOpenMenu(null), openMenu === 'color');
  useOutside(highlightRef, () => setOpenMenu(null), openMenu === 'highlight');
  useOutside(spacingRef, () => setOpenMenu(null), openMenu === 'spacing');
  useOutside(tableRef, () => setOpenMenu(null), openMenu === 'table');

  // Sync toolbar menu open state with global store so BubbleMenu hides
  useEffect(() => {
    setToolbarMenuOpen(openMenu !== null);
  }, [openMenu, setToolbarMenuOpen]);

  useEffect(() => {
    return () => setToolbarMenuOpen(false);
  }, []);

  // Re-render on every selection / content change so active states stay accurate
  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', rerender);
    return () => {
      editor.off('transaction', rerender);
    };
  }, [editor]);

  if (!editor) return null;

  const chain = () => editor.chain().focus();

  const currentBlock =
    editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3'
    : 'p';

  const setBlock = (id: string) => {
    if (id === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(id[1]) as 1 | 2 | 3 }).run();
    setOpenMenu(null);
  };

  const handleAddImage = () => {
    const url = prompt('Görsel adresi (URL veya dosya yolu):');
    if (url) chain().setImage({ src: url }).run();
  };

  const handleAddLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = prompt('Bağlantı adresi:', previousUrl);
    if (url === null) return;
    if (url === '') {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }
    chain().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertItems = [
    {
      icon: <Code className="w-4 h-4" />,
      label: 'Kod bloğu',
      run: () => chain().toggleCodeBlock().run()
    },
    {
      icon: <Terminal className="w-4 h-4" />,
      label: 'Prompt bloğu',
      run: () =>
        (chain() as any)
          .insertContent({ type: 'promptBlock', content: [{ type: 'text', text: 'Prompt metnini buraya yazın…' }] })
          .run()
    },
    {
      icon: <Info className="w-4 h-4" />,
      label: 'Bilgi kutusu',
      run: () =>
        (chain() as any)
          .insertContent({ type: 'callout', attrs: { type: 'info' }, content: [{ type: 'text', text: 'Önemli bir not…' }] })
          .run()
    },
    {
      icon: <Minus className="w-4 h-4" />,
      label: 'Ayırıcı çizgi',
      run: () => chain().setHorizontalRule().run()
    },
    {
      icon: <FileDown className="w-4 h-4" />,
      label: 'Sayfa sonu (Ctrl+Enter)',
      run: () => (chain() as any).setPageBreak().run()
    }
  ];

  const blockLabel = BLOCK_TYPES.find((b) => b.id === currentBlock)?.label;

  const ts = editor.getAttributes('textStyle');
  const currentFont: string = ts.fontFamily || '';
  const currentSize: string = ts.fontSize ? String(ts.fontSize).replace('pt', '') : '';
  const currentColor: string = ts.color || '#000000';
  const currentHighlight: string = editor.getAttributes('highlight').color || '#FFF59D';

  const applySize = (v: string) => {
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 1 && n <= 400) (chain() as any).setFontSize(`${n}pt`).run();
    setOpenMenu(null);
  };

  const toggleMenu = (m: typeof openMenu) => setOpenMenu(openMenu === m ? null : m);

  const Swatches: React.FC<{ colors: string[]; onPick: (c: string) => void; onReset: () => void; resetLabel: string }> = ({
    colors,
    onPick,
    onReset,
    resetLabel
  }) => (
    <div className="menu absolute left-0 top-full mt-2 p-2 w-[188px]" role="menu">
      <button onClick={onReset} className="menu-item h-8 mb-1.5 text-ui">
        {resetLabel}
      </button>
      <div className="grid grid-cols-6 gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            title={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
            className="w-6 h-6 rounded border border-line hover:scale-110 transition-transform"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div
      role="toolbar"
      aria-label="Biçimlendirme"
      className="flex items-center h-10 px-1.5 rounded-xl bg-paper/95 border border-line shadow-float backdrop-blur-sm max-w-full"
    >
      <Btn onClick={() => chain().undo().run()} disabled={!editor.can().undo()} title="Geri al (Ctrl+Z)">
        <Undo2 className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().redo().run()} disabled={!editor.can().redo()} title="Yinele (Ctrl+Y)">
        <Redo2 className="w-4 h-4" />
      </Btn>

      <Sep />

      {/* Block type */}
      <div className="relative shrink-0" ref={blockRef}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpenMenu(openMenu === 'block' ? null : 'block')}
          className="flex items-center justify-between gap-1 h-7 w-[104px] pl-2.5 pr-1.5 rounded-md text-ui text-ink hover:bg-ink/[0.06] transition-colors"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'block'}
        >
          <span className="truncate">{blockLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted" />
        </button>
        {openMenu === 'block' && (
          <div className="menu absolute left-0 top-full mt-2 w-48" role="menu">
            {BLOCK_TYPES.map((b) => (
              <button key={b.id} role="menuitem" onClick={() => setBlock(b.id)} className="menu-item h-9">
                <span className={`flex-1 font-serif ${b.preview}`}>{b.label}</span>
                {currentBlock === b.id && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <Sep />

      {/* Font family */}
      <div className="relative shrink-0" ref={fontRef}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('font')}
          className="flex items-center justify-between gap-1 h-7 w-[120px] pl-2.5 pr-1.5 rounded-md text-ui text-ink hover:bg-ink/[0.06] transition-colors"
          title="Yazı tipi"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'font'}
        >
          <span className="truncate" style={{ fontFamily: currentFont || undefined }}>
            {currentFont || 'Varsayılan'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
        </button>
        {openMenu === 'font' && (
          <div className="menu absolute left-0 top-full mt-2 w-56 max-h-80 overflow-y-auto" role="menu">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.label}
                role="menuitem"
                onClick={() => {
                  if (f.value) chain().setFontFamily(f.value).run();
                  else chain().unsetFontFamily().run();
                  setOpenMenu(null);
                }}
                className="menu-item h-8"
              >
                <span className="flex-1" style={{ fontFamily: f.value || undefined }}>{f.label}</span>
                {currentFont === f.value && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font size */}
      <div className="relative shrink-0 ml-1" ref={sizeRef}>
        <div className="flex items-center h-7 rounded-md border border-line hover:border-muted/50 transition-colors">
          <input
            value={openMenu === 'size' ? sizeInput : currentSize}
            placeholder="—"
            onFocus={() => {
              setSizeInput(currentSize);
              setOpenMenu('size');
            }}
            onChange={(e) => setSizeInput(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applySize(sizeInput);
              } else if (e.key === 'Escape') setOpenMenu(null);
            }}
            className="w-8 bg-transparent text-center text-ui text-ink outline-none tabular-nums"
            title="Yazı boyutu (pt)"
            aria-label="Yazı boyutu"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSizeInput(currentSize);
              toggleMenu('size');
            }}
            className="h-full px-0.5 text-muted hover:text-ink"
            aria-label="Boyut listesi"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        {openMenu === 'size' && (
          <div className="menu absolute left-0 top-full mt-2 w-20 max-h-72 overflow-y-auto" role="menu">
            <button role="menuitem" onClick={() => { (chain() as any).unsetFontSize().run(); setOpenMenu(null); }} className="menu-item h-7 text-muted">
              Sıfırla
            </button>
            {FONT_SIZES.map((s) => (
              <button key={s} role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => applySize(s)} className="menu-item h-7 tabular-nums">
                <span className="flex-1">{s}</span>
                {currentSize === s && <Check className="w-3 h-3 text-accent" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <Sep />

      <Btn onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')} title="Kalın (Ctrl+B)">
        <Bold className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')} title="İtalik (Ctrl+I)">
        <Italic className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} title="Altı çizili (Ctrl+U)">
        <UnderlineIcon className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().toggleStrike().run()} active={editor.isActive('strike')} title="Üstü çizili">
        <Strikethrough className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => (chain() as any).unsetSuperscript().toggleSubscript().run()} active={editor.isActive('subscript')} title="Alt simge (Ctrl+,)">
        <SubIcon className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => (chain() as any).unsetSubscript().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Üst simge (Ctrl+.)">
        <SupIcon className="w-4 h-4" />
      </Btn>

      {/* Text color */}
      <div className="relative shrink-0" ref={colorRef}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('color')}
          data-active={openMenu === 'color'}
          className="icon-btn flex-col gap-0"
          title="Yazı rengi"
        >
          <Baseline className="w-4 h-4" />
          <span className="block w-4 h-[3px] -mt-0.5 rounded-sm" style={{ background: currentColor }} />
        </button>
        {openMenu === 'color' && (
          <Swatches
            colors={TEXT_COLORS}
            resetLabel="Otomatik"
            onReset={() => { chain().unsetColor().run(); setOpenMenu(null); }}
            onPick={(c) => { chain().setColor(c).run(); setOpenMenu(null); }}
          />
        )}
      </div>

      {/* Highlight color */}
      <div className="relative shrink-0" ref={highlightRef}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('highlight')}
          data-active={openMenu === 'highlight'}
          className="icon-btn flex-col gap-0"
          title="Vurgu rengi"
        >
          <Highlighter className="w-4 h-4" />
          <span className="block w-4 h-[3px] -mt-0.5 rounded-sm" style={{ background: currentHighlight }} />
        </button>
        {openMenu === 'highlight' && (
          <Swatches
            colors={HIGHLIGHT_COLORS}
            resetLabel="Renk yok"
            onReset={() => { chain().unsetHighlight().run(); setOpenMenu(null); }}
            onPick={(c) => { chain().setHighlight({ color: c }).run(); setOpenMenu(null); }}
          />
        )}
      </div>

      <Btn onClick={() => chain().unsetAllMarks().clearNodes().run()} title="Biçimlendirmeyi temizle">
        <RemoveFormatting className="w-4 h-4" />
      </Btn>

      <Sep />

      <Btn onClick={() => chain().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Sola hizala">
        <AlignLeft className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Ortala">
        <AlignCenter className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Sağa hizala">
        <AlignRight className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="İki yana yasla">
        <AlignJustify className="w-4 h-4" />
      </Btn>

      {/* Line spacing */}
      <div className="relative shrink-0" ref={spacingRef}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('spacing')}
          data-active={openMenu === 'spacing'}
          className="icon-btn"
          title="Satır aralığı"
          aria-haspopup="menu"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
        {openMenu === 'spacing' && (
          <div className="menu absolute left-0 top-full mt-2 w-36" role="menu">
            {LINE_HEIGHTS.map((lh) => {
              const cur = editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight;
              return (
                <button
                  key={lh}
                  role="menuitem"
                  onClick={() => { (chain() as any).setLineHeight(lh).run(); setOpenMenu(null); }}
                  className="menu-item h-8 tabular-nums"
                >
                  <span className="flex-1">{lh.replace('.', ',')}</span>
                  {cur === lh && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              );
            })}
            <button role="menuitem" onClick={() => { (chain() as any).unsetLineHeight().run(); setOpenMenu(null); }} className="menu-item h-8 text-muted">
              Varsayılan
            </button>
          </div>
        )}
      </div>

      <Sep />

      <Btn onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Madde işaretli liste">
        <List className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numaralı liste">
        <ListOrdered className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().toggleTaskList().run()} active={editor.isActive('taskList')} title="Yapılacaklar listesi">
        <ListTodo className="w-4 h-4" />
      </Btn>
      <Btn onClick={() => chain().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Alıntı">
        <Quote className="w-4 h-4" />
      </Btn>

      <Sep />

      <Btn onClick={handleAddLink} active={editor.isActive('link')} title="Bağlantı ekle">
        <LinkIcon className="w-4 h-4" />
      </Btn>
      <Btn onClick={handleAddImage} title="Görsel ekle">
        <ImageIcon className="w-4 h-4" />
      </Btn>
      {/* Table tools button and menu */}
      <div className="relative shrink-0" ref={tableRef}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (editor.isActive('table')) {
              toggleMenu('table');
            } else {
              chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            }
          }}
          data-active={editor.isActive('table') || openMenu === 'table'}
          title={editor.isActive('table') ? 'Tablo araçları (tıklayarak menüyü açın)' : 'Tablo ekle (3x3)'}
          className="icon-btn"
          aria-haspopup="menu"
        >
          <TableIcon className="w-4 h-4" />
        </button>

        {openMenu === 'table' && (
          <div className="menu absolute left-0 top-full mt-2 w-52 p-1.5 z-50 animate-pop text-ui" role="menu">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted px-2 py-1">
              Satır
            </div>
            <button
              role="menuitem"
              onClick={() => { chain().addRowBefore().run(); setOpenMenu(null); }}
              className="menu-item h-7.5"
            >
              Üste satır ekle
            </button>
            <button
              role="menuitem"
              onClick={() => { chain().addRowAfter().run(); setOpenMenu(null); }}
              className="menu-item h-7.5"
            >
              Alta satır ekle
            </button>
            <button
              role="menuitem"
              onClick={() => { chain().deleteRow().run(); setOpenMenu(null); }}
              className="menu-item h-7.5 text-danger"
            >
              Satırı sil
            </button>

            <div className="w-full h-px bg-line my-1" />

            <div className="text-2xs font-semibold uppercase tracking-wider text-muted px-2 py-1">
              Sütun
            </div>
            <button
              role="menuitem"
              onClick={() => { chain().addColumnBefore().run(); setOpenMenu(null); }}
              className="menu-item h-7.5"
            >
              Sola sütun ekle
            </button>
            <button
              role="menuitem"
              onClick={() => { chain().addColumnAfter().run(); setOpenMenu(null); }}
              className="menu-item h-7.5"
            >
              Sağa sütun ekle
            </button>
            <button
              role="menuitem"
              onClick={() => { chain().deleteColumn().run(); setOpenMenu(null); }}
              className="menu-item h-7.5 text-danger"
            >
              Sütunu sil
            </button>

            <div className="w-full h-px bg-line my-1" />

            <div className="text-2xs font-semibold uppercase tracking-wider text-muted px-2 py-1">
              Hücre & Başlık
            </div>
            <button
              role="menuitem"
              onClick={() => { chain().mergeOrSplit().run(); setOpenMenu(null); }}
              className="menu-item h-7.5"
            >
              Hücreleri birleştir / böl
            </button>
            <button
              role="menuitem"
              onClick={() => { chain().toggleHeaderRow().run(); setOpenMenu(null); }}
              className="menu-item h-7.5"
            >
              Başlık satırını aç/kapa
            </button>

            <div className="w-full h-px bg-line my-1" />

            <button
              role="menuitem"
              onClick={() => { chain().deleteTable().run(); setOpenMenu(null); }}
              className="menu-item h-7.5 text-danger font-medium flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Tabloyu sil
            </button>
          </div>
        )}
      </div>

      <div className="relative shrink-0" ref={insertRef}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpenMenu(openMenu === 'insert' ? null : 'insert')}
          data-active={openMenu === 'insert'}
          className="icon-btn w-auto px-1.5 gap-0.5"
          title="Diğer bloklar"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'insert'}
        >
          <Plus className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>
        {openMenu === 'insert' && (
          <div className="menu absolute right-0 top-full mt-2 w-48" role="menu">
            {insertItems.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                onClick={() => {
                  it.run();
                  setOpenMenu(null);
                }}
                className="menu-item"
              >
                <span className="text-muted">{it.icon}</span>
                {it.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
