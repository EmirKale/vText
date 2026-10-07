import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
});

export function markdownToHtml(markdown: string): string {
  return md.render(markdown);
}

export function tipTapJsonToMarkdown(node: any): string {
  if (!node) return '';

  function processMarks(text: string, marks?: any[]): string {
    let result = text;
    if (!marks) return result;

    for (const m of marks) {
      if (m.type === 'bold') result = `**${result}**`;
      else if (m.type === 'italic') result = `*${result}*`;
      else if (m.type === 'strike') result = `~~${result}~~`;
      else if (m.type === 'code') result = `\`${result}\``;
      else if (m.type === 'link') result = `[${result}](${m.attrs?.href || ''})`;
    }
    return result;
  }

  function serializeNode(n: any): string {
    switch (n.type) {
      case 'doc':
        return (n.content || []).map((c: any) => serializeNode(c)).join('\n\n');

      case 'heading': {
        const hashes = '#'.repeat(n.attrs?.level || 1);
        const text = (n.content || []).map((c: any) => serializeNode(c)).join('');
        return `${hashes} ${text}`;
      }

      case 'paragraph': {
        const text = (n.content || []).map((c: any) => serializeNode(c)).join('');
        return text;
      }

      case 'blockquote': {
        const text = (n.content || []).map((c: any) => serializeNode(c)).join('\n');
        return text.split('\n').map(l => `> ${l}`).join('\n');
      }

      case 'codeBlock': {
        const lang = n.attrs?.language || '';
        const text = (n.content || []).map((c: any) => c.text || '').join('');
        return `\`\`\`${lang}\n${text}\n\`\`\``;
      }

      case 'promptBlock': {
        const text = (n.content || []).map((c: any) => serializeNode(c)).join('');
        return `> **PROMPT:**\n> ${text}`;
      }

      case 'bulletList': {
        return (n.content || []).map((item: any) => {
          const itemText = (item.content || []).map((c: any) => serializeNode(c)).join('\n');
          return `- ${itemText}`;
        }).join('\n');
      }

      case 'orderedList': {
        return (n.content || []).map((item: any, i: number) => {
          const itemText = (item.content || []).map((c: any) => serializeNode(c)).join('\n');
          return `${i + 1}. ${itemText}`;
        }).join('\n');
      }

      case 'horizontalRule':
        return '---';

      case 'image':
        return `![${n.attrs?.alt || 'görsel'}](${n.attrs?.src || ''})`;

      case 'text':
        return processMarks(n.text || '', n.marks);

      default:
        return (n.content || []).map((c: any) => serializeNode(c)).join('');
    }
  }

  return serializeNode(node);
}
