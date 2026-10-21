import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { common, createLowlight } from 'lowlight';

import { ResizableImage } from './extensions/ResizableImage';
import { PromptBlock } from './extensions/PromptBlock';
import { Callout } from './extensions/Callout';
import { FontSize } from './extensions/FontSize';
import { SearchReplace } from './extensions/SearchReplace';
import { LineHeight, PageBreak } from './extensions/Layout';
import { Indent } from './extensions/Indent';
import { BubbleMenuCard } from '../components/BubbleMenuCard';
import { ImageBubbleMenu } from '../components/ImageBubbleMenu';
import { useAppStore } from '../store/useAppStore';

const lowlight = createLowlight(common);

interface TipTapEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  onEditorReady?: (editor: any) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({ content, onUpdate, onEditorReady }) => {
  const {
    viewMode,
    settings,
    isFocusMode,
    pageMargin,
    pageOrientation,
    isFormatPainterActive,
    savedFormat,
    clearFormatPainter
  } = useAppStore();
  const lastContentRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: 'Yazmaya başlayın...',
      }),
      PromptBlock,
      Callout,
      SearchReplace,
      LineHeight,
      PageBreak,
      Indent,
    ],
    autofocus: 'end',
    content,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[600px] select-text',
      },
      handleClick: (_, __, event) => {
        // Open links with Ctrl+Click in external browser (shell.openExternal via main)
        const target = event.target as HTMLElement;
        if (event.ctrlKey && target.tagName === 'A') {
          const href = target.getAttribute('href');
          if (href && (href.startsWith('http:') || href.startsWith('https:'))) {
            // Use IPC to open externally instead of window.open for security
            try {
              window.open(href, '_blank');
            } catch {
              // Fallback silently
            }
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastContentRef.current = html;
      onUpdate(html);
    },
  });

  useEffect(() => {
    if (editor) {
      if (onEditorReady) {
        onEditorReady(editor);
      }
      requestAnimationFrame(() => {
        if (editor.view?.dom) {
          (editor.view.dom as HTMLElement).focus({ preventScroll: true });
        }
      });
    }
  }, [editor]);

  // Sync content when active tab changes or content is updated externally (e.g., translation streaming)
  useEffect(() => {
    if (editor && content !== lastContentRef.current) {
      lastContentRef.current = content;
      editor.commands.setContent(content, false);
    }
  }, [content]);

  // Format Painter: apply saved format to new selection
  useEffect(() => {
    if (!editor || !isFormatPainterActive || !savedFormat) return;

    const handleSelectionUpdate = () => {
      const { empty } = editor.state.selection;
      if (empty) return;

      const chain = editor.chain().focus();
      chain.unsetAllMarks();

      for (const m of savedFormat.marks) {
        if (m.type === 'bold') chain.setBold();
        else if (m.type === 'italic') chain.setItalic();
        else if (m.type === 'underline') chain.setUnderline();
        else if (m.type === 'strike') chain.setStrike();
        else if (m.type === 'subscript') (chain as any).unsetSuperscript().setSubscript();
        else if (m.type === 'superscript') (chain as any).unsetSubscript().setSuperscript();
        else if (m.type === 'highlight') chain.setHighlight(m.attrs as any);
        else if (m.type === 'textStyle') {
          if (m.attrs?.color) chain.setColor(m.attrs.color);
          if (m.attrs?.fontFamily) chain.setFontFamily(m.attrs.fontFamily);
          if (m.attrs?.fontSize) (chain as any).setFontSize(m.attrs.fontSize);
        }
      }
      if (savedFormat.textStyle) {
        if (savedFormat.textStyle.color) chain.setColor(savedFormat.textStyle.color);
        if (savedFormat.textStyle.fontFamily) chain.setFontFamily(savedFormat.textStyle.fontFamily);
        if (savedFormat.textStyle.fontSize) (chain as any).setFontSize(savedFormat.textStyle.fontSize);
      }
      if (savedFormat.textAlign) chain.setTextAlign(savedFormat.textAlign);
      if (savedFormat.lineHeight) (chain as any).setLineHeight(savedFormat.lineHeight);

      chain.run();
      clearFormatPainter();
    };

    editor.on('selectionUpdate', handleSelectionUpdate);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearFormatPainter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, isFormatPainterActive, savedFormat, clearFormatPainter]);

  return (
    <div
      className={`flex-1 w-full h-full overflow-y-auto flex justify-center px-6 bg-desk print:bg-white print:p-0 print:m-0 print:overflow-visible print:h-auto print:block ${
        isFocusMode ? 'pt-16 pb-24' : 'pt-[76px] pb-24'
      }`}
      onMouseDown={(e) => {
        // Clicking the empty desk focuses the end of the document
        if (e.target === e.currentTarget && editor) {
          e.preventDefault();
          editor.commands.focus('end');
        }
      }}
    >
      {editor && (
        <div className="no-print">
          <BubbleMenuCard editor={editor} />
          <ImageBubbleMenu editor={editor} />
        </div>
      )}

      <div
        style={{ fontSize: `${settings.fontSize}px` }}
        className={`w-full h-fit transition-[max-width,padding] duration-200 print:shadow-none print:ring-0 print:border-none print:m-0 print:p-0 print:max-w-none print:bg-transparent print:text-black print:min-h-0 ${
          viewMode === 'page' && !isFocusMode
            ? `${pageOrientation === 'landscape' ? 'max-w-[1056px] min-h-[816px]' : 'max-w-[816px] min-h-[1056px]'} ${
                pageMargin === 'narrow'
                  ? 'px-[48px] py-[48px]'
                  : pageMargin === 'wide'
                  ? 'px-[144px] py-[144px]'
                  : 'px-[96px] py-[96px]'
              } bg-paper rounded-[3px] shadow-paper ring-1 ring-line/60`
            : 'max-w-[700px] px-2 py-4'
        }`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

