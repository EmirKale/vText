import React from 'react';
import { Editor, BubbleMenu } from '@tiptap/react';
import { AlignLeft, AlignCenter, AlignRight, Trash2, Image as ImageIcon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface ImageBubbleMenuProps {
  editor: Editor | null;
}

export const ImageBubbleMenu: React.FC<ImageBubbleMenuProps> = ({ editor }) => {
  const { isToolbarMenuOpen } = useAppStore();

  if (!editor) return null;

  const attrs = editor.getAttributes('image');
  const currentWidth = attrs.width || '100%';
  const currentAlign = attrs.alignment || 'center';

  const setWidth = (width: string) => {
    editor.chain().focus().updateAttributes('image', { width }).run();
  };

  const setAlign = (alignment: 'left' | 'center' | 'right') => {
    editor.chain().focus().updateAttributes('image', { alignment }).run();
  };

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const handleChangeSrc = () => {
    const currentSrc = attrs.src || '';
    const newSrc = prompt('Yeni görsel adresi veya dosya yolu:', currentSrc);
    if (newSrc && newSrc !== currentSrc) {
      editor.chain().focus().updateAttributes('image', { src: newSrc }).run();
    }
  };

  const sizeBtn = (w: string, label: string) => {
    const isActive = currentWidth === w;
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setWidth(w)}
        className={`px-2 py-1 text-2xs rounded-md font-medium transition-colors ${
          isActive
            ? 'bg-ink text-paper shadow-sm'
            : 'text-muted hover:text-ink hover:bg-ink/[0.06]'
        }`}
        title={`Görsel genişliği: ${label}`}
      >
        {label}
      </button>
    );
  };

  const alignBtn = (a: 'left' | 'center' | 'right', icon: React.ReactNode, title: string) => {
    const isActive = currentAlign === a;
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setAlign(a)}
        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
          isActive
            ? 'bg-accent/15 text-accent'
            : 'text-muted hover:text-ink hover:bg-ink/[0.06]'
        }`}
        title={title}
      >
        {icon}
      </button>
    );
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="imageBubbleMenu"
      tippyOptions={{
        duration: 150,
        zIndex: 35,
        offset: [0, 10],
        placement: 'top',
        popperOptions: {
          modifiers: [
            {
              name: 'preventOverflow',
              options: {
                padding: { top: 88, bottom: 24, left: 16, right: 16 }
              }
            }
          ]
        }
      }}
      shouldShow={({ editor }) => {
        if (isToolbarMenuOpen) return false;
        return editor.isActive('image');
      }}
    >
      <div className="flex items-center gap-1 p-1 rounded-xl bg-paper border border-line shadow-float text-ui text-ink select-none animate-pop">
        <span className="flex items-center gap-1 h-6 px-1.5 mr-0.5 rounded-md bg-accent/10 text-accent text-2xs font-semibold">
          <ImageIcon className="w-3 h-3" />
          Görsel
        </span>

        {/* Sizes */}
        <div className="flex items-center gap-0.5 px-0.5">
          {sizeBtn('25%', '%25')}
          {sizeBtn('50%', '%50')}
          {sizeBtn('75%', '%75')}
          {sizeBtn('100%', '%100')}
        </div>

        <span className="w-px h-4 bg-line mx-0.5" />

        {/* Alignments */}
        <div className="flex items-center gap-0.5">
          {alignBtn('left', <AlignLeft className="w-3.5 h-3.5" />, 'Sola hizala')}
          {alignBtn('center', <AlignCenter className="w-3.5 h-3.5" />, 'Ortala')}
          {alignBtn('right', <AlignRight className="w-3.5 h-3.5" />, 'Sağa hizala')}
        </div>

        <span className="w-px h-4 bg-line mx-0.5" />

        {/* Change URL */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleChangeSrc}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-ink hover:bg-ink/[0.06] transition-colors"
          title="Görsel adresini değiştir"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-danger hover:bg-danger/10 transition-colors"
          title="Görseli kaldır"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </BubbleMenu>
  );
};
