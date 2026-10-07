import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { useAppStore } from '../store/useAppStore';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
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
  Sparkles,
  CheckCircle,
  Globe,
  Settings,
  Terminal,
  Info
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  const { setArticleOpen, setProofreadOpen, setSettingsOpen, isProofreadOpen, addTab, tabs, activeTabId } = useAppStore();
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);

  if (!editor) return null;

  const handleTranslate = async (lang: string, langName: string) => {
    setShowTranslateMenu(false);
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!editor) return;

    // Convert editor content to markdown for cleaner AI translation
    const { tipTapJsonToMarkdown } = await import('../io/markdown');
    const mdContent = tipTapJsonToMarkdown(editor.getJSON());

    const newTabTitle = `${activeTab ? activeTab.title.replace(/\.[^/.]+$/, '') : 'Belge'} (${lang.toUpperCase()})`;
    const newTabId = addTab(newTabTitle, '<p>Çeviri hazırlanıyor...</p>');

    if (window.kalem?.ai) {
      const requestId = `tr-${Date.now()}`;
      let accumulatedMd = '';

      const cleanup = window.kalem.ai.translate(
        requestId,
        mdContent,
        langName,
        (chunk) => {
          accumulatedMd += chunk;
          // Convert accumulated markdown to HTML and update tab content
          const { markdownToHtml } = require('../io/markdown');
          const html = markdownToHtml(accumulatedMd);
          useAppStore.getState().updateTabContent(newTabId, html);
        },
        () => {
          // Done - final update
          if (cleanup) cleanup();
        },
        (err) => {
          alert(`Çeviri hatası: ${err}`);
          if (cleanup) cleanup();
        }
      );
    }
  };

  const handleAddImage = () => {
    const url = prompt('Görsel URL veya dosya yolu girin:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleAddLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = prompt('Web Bağlantısı (URL):', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark select-none text-xs gap-2 overflow-x-auto">
      {/* Formatting tools */}
      <div className="flex items-center gap-0.5">
        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-accent/15 text-accent font-bold' : ''
          }`}
          title="Başlık 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-accent/15 text-accent font-bold' : ''
          }`}
          title="Başlık 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-accent/15 text-accent font-bold' : ''
          }`}
          title="Başlık 3"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 bg-border-light dark:bg-border-dark mx-1"></span>

        {/* Text styling */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('bold') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Kalın (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('italic') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="İtalik (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('underline') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Altı Çizili (Ctrl+U)"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('strike') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Üstü Çizili"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 bg-border-light dark:bg-border-dark mx-1"></span>

        {/* Alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Sola Hizala"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Ortala"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Sağa Hizala"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 bg-border-light dark:bg-border-dark mx-1"></span>

        {/* Lists & Quotes */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('bulletList') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Madde İşaretli Liste"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('orderedList') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Numaralı Liste"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('taskList') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Görev Listesi"
        >
          <ListTodo className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('blockquote') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Alıntı"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 bg-border-light dark:bg-border-dark mx-1"></span>

        {/* Insert Elements */}
        <button
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Tablo Ekle"
        >
          <TableIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('codeBlock') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Kod Bloğu"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => (editor.chain().focus() as any).insertContent({ type: 'promptBlock', content: [{ type: 'text', text: 'Prompt metnini buraya yazın...' }] }).run()}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-accent transition-colors"
          title="Prompt Bloğu Ekle"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => (editor.chain().focus() as any).insertContent({ type: 'callout', attrs: { type: 'info' }, content: [{ type: 'text', text: 'Önemli bilgi notu...' }] }).run()}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Bilgi / Callout Kutusu"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleAddImage}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Görsel Ekle"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleAddLink}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            editor.isActive('link') ? 'bg-accent/15 text-accent' : ''
          }`}
          title="Bağlantı (Link)"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* AI Features & Settings */}
      <div className="flex items-center gap-1.5 relative">
        {/* Translate dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTranslateMenu(!showTranslateMenu)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-content-light dark:text-content-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Belgeyi Yeni Sekmede Çevir"
          >
            <Globe className="w-3.5 h-3.5 text-accent" />
            <span>Çevir</span>
          </button>
          {showTranslateMenu && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-lg py-1 z-50">
              <button
                onClick={() => handleTranslate('en', 'İngilizce')}
                className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-xs transition-colors"
              >
                🇬🇧 İngilizce
              </button>
              <button
                onClick={() => handleTranslate('de', 'Almanca')}
                className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-xs transition-colors"
              >
                🇩🇪 Almanca
              </button>
              <button
                onClick={() => handleTranslate('es', 'İspanyolca')}
                className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-xs transition-colors"
              >
                🇪🇸 İspanyolca
              </button>
            </div>
          )}
        </div>

        {/* Proofread Page Button */}
        <button
          onClick={() => setProofreadOpen(!isProofreadOpen)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
            isProofreadOpen
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium'
              : 'hover:bg-black/5 dark:hover:bg-white/5 text-content-light dark:text-content-dark'
          }`}
          title="Sayfa Genelinde Hataları Düzelt (Ctrl+Shift+E)"
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>Hataları Düzelt</span>
        </button>

        {/* AI Article Button */}
        <button
          onClick={() => setArticleOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-white font-medium hover:bg-accent-hover shadow-sm transition-all"
          title="Yapay Zeka ile Makale Yazdır (Ctrl+J)"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>✨ AI ile Makale</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-content-mutedLight dark:text-content-mutedDark hover:text-content-light dark:hover:text-content-dark transition-colors"
          title="Ayarlar (API, Model, Tema)"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
