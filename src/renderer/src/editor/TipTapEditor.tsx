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
import { common, createLowlight } from 'lowlight';

import { PromptBlock } from './extensions/PromptBlock';
import { Callout } from './extensions/Callout';
import { BubbleMenuCard } from '../components/BubbleMenuCard';
import { useAppStore } from '../store/useAppStore';

const lowlight = createLowlight(common);

interface TipTapEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  onEditorReady?: (editor: any) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({ content, onUpdate, onEditorReady }) => {
  const { viewMode, settings } = useAppStore();
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
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
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
    <div className="flex-1 w-full h-full overflow-y-auto py-8 px-4 flex justify-center bg-canvas-light dark:bg-canvas-dark">
      {editor && <BubbleMenuCard editor={editor} />}

      {/* Page View vs Stream View */}
      <div
        style={{ fontSize: `${settings.fontSize}px` }}
        className={`w-full transition-all duration-200 ${
          viewMode === 'page'
            ? 'max-w-[760px] p-12 my-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-page'
            : 'max-w-4xl p-6 bg-transparent'
        }`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

