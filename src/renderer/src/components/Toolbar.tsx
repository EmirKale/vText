import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
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
  Check
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
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [openMenu, setOpenMenu] = useState<null | 'block' | 'insert'>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);

  useOutside(blockRef, () => setOpenMenu(null), openMenu === 'block');
  useOutside(insertRef, () => setOpenMenu(null), openMenu === 'insert');

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
    }
  ];

  const blockLabel = BLOCK_TYPES.find((b) => b.id === currentBlock)?.label;

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
      <Btn onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Tablo ekle">
        <TableIcon className="w-4 h-4" />
      </Btn>

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
