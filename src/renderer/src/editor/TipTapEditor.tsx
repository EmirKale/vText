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
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { common, createLowlight } from 'lowlight';

import { PromptBlock } from './extensions/PromptBlock';
import { Callout } from './extensions/Callout';
import { FontSize } from './extensions/FontSize';
import { SearchReplace } from './extensions/SearchReplace';
import { LineHeight, PageBreak } from './extensions/Layout';
import { BubbleMenuCard } from '../components/BubbleMenuCard';
import { useAppStore } from '../store/useAppStore';

const lowlight = createLowlight(common);

interface TipTapEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  onEditorReady?: (editor: any) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({ content, onUpdate, onEditorReady }) => {
  const { viewMode, settings, isFocusMode, pageMargin, pageOrientation } = useAppStore();
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
      Image.configure({
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
    ],
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
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sync content when active tab changes or content is updated externally (e.g., translation streaming)
  useEffect(() => {
    if (editor && content !== lastContentRef.current) {
      lastContentRef.current = content;
      editor.commands.setContent(content, false);
    }
  }, [content]);

  return (
    <div
      className={`flex-1 w-full h-full overflow-y-auto flex justify-center px-6 bg-desk ${
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
      {editor && <BubbleMenuCard editor={editor} />}

      <div
        style={{ fontSize: `${settings.fontSize}px` }}
        className={`w-full h-fit transition-[max-width,padding] duration-200 ${
          viewMode === 'page' && !isFocusMode
            ? `${pageOrientation === 'landscape' ? 'max-w-[1056px] min-h-[816px]' : 'max-w-[816px] min-h-[1056px]'} ${
                pageMargin === 'narrow'
                  ? 'px-[44px] py-[40px]'
                  : pageMargin === 'wide'
                  ? 'px-[132px] py-[120px]'
                  : 'px-[88px] py-[80px]'
              } bg-paper rounded-[3px] shadow-paper ring-1 ring-line/60`
            : 'max-w-[700px] px-2 py-4'
        }`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

