import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType
} from 'docx';

export async function exportTipTapJsonToDocx(docJson: any, documentTitle: string = 'Belge'): Promise<Uint8Array> {
  const children: any[] = [];

  function processMarks(text: string, marks?: any[]): TextRun {
    let bold = false;
    let italics = false;
    let underline = false;
    let strike = false;
    let font = 'Inter';

    if (marks) {
      for (const m of marks) {
        if (m.type === 'bold') bold = true;
        if (m.type === 'italic') italics = true;
        if (m.type === 'underline') underline = true;
        if (m.type === 'strike') strike = true;
        if (m.type === 'code') font = 'Consolas';
      }
    }

    return new TextRun({
      text: text || '',
      bold,
      italics,
      underline: underline ? {} : undefined,
      strike,
      font,
      size: 24 // 12pt (docx uses half-points)
    });
  }

  function getAlignment(align?: string): AlignmentType {
    if (align === 'center') return AlignmentType.CENTER;
    if (align === 'right') return AlignmentType.RIGHT;
    if (align === 'justify') return AlignmentType.JUSTIFIED;
    return AlignmentType.LEFT;
  }

  function convertNode(node: any): any {
    switch (node.type) {
      case 'heading': {
        const runs = (node.content || []).map((c: any) => processMarks(c.text, c.marks));
        let level = HeadingLevel.HEADING_1;
        if (node.attrs?.level === 2) level = HeadingLevel.HEADING_2;
        if (node.attrs?.level === 3) level = HeadingLevel.HEADING_3;

        return new Paragraph({
          children: runs,
          heading: level,
          alignment: getAlignment(node.attrs?.textAlign),
          spacing: { before: 240, after: 120 }
        });
      }

      case 'paragraph': {
        const runs = (node.content || []).map((c: any) => processMarks(c.text, c.marks));
        return new Paragraph({
          children: runs,
          alignment: getAlignment(node.attrs?.textAlign),
          spacing: { after: 160, line: 360 }
        });
      }

      case 'blockquote': {
        const subParas = (node.content || []).map((c: any) => convertNode(c));
        return subParas;
      }

      // Code Block & Prompt Block -> Single-cell table with gray background & Consolas
      case 'codeBlock':
      case 'promptBlock': {
        const textContent = (node.content || []).map((c: any) => c.text || '').join('');
        const lines = textContent.split('\n');
        const runs = lines.map((line: string, i: number) => [
          new TextRun({
            text: line,
            font: 'Consolas',
            size: 20 // 10pt
          }),
          ...(i < lines.length - 1 ? [new TextRun({ break: 1 })] : [])
        ]).flat();

        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: {
                    type: ShadingType.CLEAR,
                    fill: 'F3F4F6'
                  },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                    left: { style: BorderStyle.SINGLE, size: 24, color: '6366F1' }, // Indigo left stripe
                    right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
                  },
                  margins: { top: 140, bottom: 140, left: 200, right: 200 },
                  children: [
                    new Paragraph({
                      children: runs,
                      spacing: { line: 280 }
                    })
                  ]
                })
              ]
            })
          ]
        });
      }

      case 'bulletList':
      case 'orderedList': {
        const listItems: any[] = [];
        (node.content || []).forEach((item: any, idx: number) => {
          (item.content || []).forEach((subNode: any) => {
            const runs = (subNode.content || []).map((c: any) => processMarks(c.text, c.marks));
            listItems.push(
              new Paragraph({
                children: runs,
                bullet: node.type === 'bulletList' ? { level: 0 } : undefined,
                numbering: node.type === 'orderedList' ? { reference: 'numbered-list', level: 0 } : undefined,
                spacing: { after: 80 }
              })
            );
          });
        });
        return listItems;
      }

      case 'table': {
        const rows = (node.content || []).map((rowNode: any) => {
          const cells = (rowNode.content || []).map((cellNode: any) => {
            const cellChildren = (cellNode.content || []).map((p: any) => convertNode(p)).flat();
            const isHeader = cellNode.type === 'tableHeader';
            return new TableCell({
              children: cellChildren.length > 0 ? cellChildren : [new Paragraph({})],
              shading: isHeader ? { type: ShadingType.CLEAR, fill: 'F9FAFB' } : undefined,
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
              },
              margins: { top: 100, bottom: 100, left: 140, right: 140 }
            });
          });
          return new TableRow({ children: cells });
        });

        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows
        });
      }

      default: {
        if (node.text) {
          return new Paragraph({ children: [processMarks(node.text, node.marks)] });
        }
        return null;
      }
    }
  }

  if (docJson && docJson.content) {
    for (const node of docJson.content) {
      const converted = convertNode(node);
      if (Array.isArray(converted)) {
        children.push(...converted);
      } else if (converted) {
        children.push(converted);
      }
    }
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: '' }));
  }

  const doc = new Document({
    title: documentTitle,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch in dxa
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children
      }
    ]
  });

  return Packer.toUint8Array(doc);
}
