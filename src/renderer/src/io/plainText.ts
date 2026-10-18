/**
 * plainText.ts - TipTap JSON to clean plain text serializer.
 * Conforms to Group B Item B1:
 * - No Markdown marks (#, **, *, ~~, etc.)
 * - Blank lines between blocks (headings, paragraphs, etc.)
 * - List items formatted with "- " (bullet) or "1. " (ordered)
 */

export function tipTapJsonToPlainText(node: any): string {
  if (!node) return '';

  function serialize(n: any): string {
    switch (n.type) {
      case 'doc':
        return (n.content || [])
          .map((c: any) => serialize(c))
          .join('\n\n');

      case 'heading': {
        return (n.content || []).map((c: any) => serialize(c)).join('');
      }

      case 'paragraph': {
        return (n.content || []).map((c: any) => serialize(c)).join('');
      }

      case 'blockquote': {
        return (n.content || []).map((c: any) => serialize(c)).join('\n');
      }

      case 'codeBlock':
      case 'promptBlock': {
        return (n.content || []).map((c: any) => c.text || '').join('');
      }

      case 'bulletList': {
        return (n.content || [])
          .map((item: any) => {
            const itemText = (item.content || []).map((c: any) => serialize(c)).join('\n');
            return `- ${itemText}`;
          })
          .join('\n');
      }

      case 'orderedList': {
        return (n.content || [])
          .map((item: any, i: number) => {
            const itemText = (item.content || []).map((c: any) => serialize(c)).join('\n');
            return `${i + 1}. ${itemText}`;
          })
          .join('\n');
      }

      case 'table': {
        return (n.content || [])
          .map((row: any) => {
            return (row.content || [])
              .map((cell: any) => (cell.content || []).map((c: any) => serialize(c)).join(' '))
              .join('\t');
          })
          .join('\n');
      }

      case 'callout': {
        return (n.content || []).map((c: any) => serialize(c)).join('\n');
      }

      case 'hardBreak':
        return '\n';

      case 'horizontalRule':
        return '---';

      case 'text':
        return n.text || '';

      default:
        return (n.content || []).map((c: any) => serialize(c)).join('');
    }
  }

  return serialize(node);
}
