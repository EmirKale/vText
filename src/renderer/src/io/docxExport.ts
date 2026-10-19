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
  ShadingType,
  PageBreak,
  PageOrientation,
  ImageRun,
  LevelFormat
} from 'docx';

export const DOCX_TABLE_BORDER_COLOR = '9CA3AF';
export const DOCX_TABLE_BORDER_SIZE = 4; // 0.5 pt (in eighths of a point)
export const DOCX_TABLE_HEADER_SHADING_COLOR = 'F3F4F6';

export async function exportTipTapJsonToDocx(
  docJson: any,
  documentTitle: string = 'Belge',
  options?: { margin?: 'normal' | 'narrow' | 'wide'; orientation?: 'portrait' | 'landscape' }
): Promise<Uint8Array> {
  const children: any[] = [];

  const DEFAULT_FONT_FALLBACK = 'Calibri';

  function processMarks(text: string, marks?: any[]): TextRun {
    let bold: boolean | undefined;
    let italics: boolean | undefined;
    let underline: any;
    let strike: boolean | undefined;
    let subScript: boolean | undefined;
    let superScript: boolean | undefined;
    let font: string | undefined;
    let size: number | undefined;
    let color: string | undefined;
    let shading: any;

    if (marks) {
      for (const m of marks) {
        if (m.type === 'bold') bold = true;
        if (m.type === 'italic') italics = true;
        if (m.type === 'underline') underline = {};
        if (m.type === 'strike') strike = true;
        if (m.type === 'subscript') subScript = true;
        if (m.type === 'superscript') superScript = true;
        if (m.type === 'code') font = 'Consolas';
        if (m.type === 'textStyle') {
          if (m.attrs?.fontFamily) {
            const clean = String(m.attrs.fontFamily).split(',')[0].replace(/['"]/g, '').trim();
            if (clean && clean.toLowerCase() !== 'calibri') font = clean;
          }
          if (m.attrs?.fontSize) {
            const n = parseFloat(m.attrs.fontSize);
            if (!isNaN(n)) size = Math.round(String(m.attrs.fontSize).includes('px') ? n * 0.75 * 2 : n * 2);
          }
          if (m.attrs?.color && /^#?[0-9a-f]{6}$/i.test(m.attrs.color)) color = m.attrs.color.replace('#', '');
        }
        if (m.type === 'highlight') {
          const c = (m.attrs?.color || '#FFF59D').replace('#', '');
          if (/^[0-9a-f]{6}$/i.test(c)) shading = { type: ShadingType.CLEAR, color: 'auto', fill: c };
        }
      }
    }

    return new TextRun({
      text: text || '',
      bold,
      italics,
      underline,
      strike,
      subScript,
      superScript,
      font,
      size,
      color,
      shading
    });
  }

  function getAlignment(align?: string): (typeof AlignmentType)[keyof typeof AlignmentType] {
    if (align === 'center') return AlignmentType.CENTER;
    if (align === 'right') return AlignmentType.RIGHT;
    if (align === 'justify') return AlignmentType.JUSTIFIED;
    return AlignmentType.LEFT;
  }

  /** CSS line-height multiplier → docx "line" (240 = single spacing). */
  function lineOf(lh: any, fallback?: number): number | undefined {
    const n = parseFloat(lh);
    return !isNaN(n) && n > 0 ? Math.round(n * 240) : fallback;
  }

  function convertNode(node: any): any {
    switch (node.type) {
      case 'pageBreak':
        return new Paragraph({ children: [new PageBreak()] });

      case 'heading': {
        const levelNum = node.attrs?.level || 1;
        const runs = (node.content || []).map((c: any) => processMarks(c.text, c.marks));
        let level: any = HeadingLevel.HEADING_1;
        if (levelNum === 2) level = HeadingLevel.HEADING_2;
        else if (levelNum === 3) level = HeadingLevel.HEADING_3;
        else if (levelNum === 4) level = HeadingLevel.HEADING_4;
        else if (levelNum === 5) level = HeadingLevel.HEADING_5;
        else if (levelNum === 6) level = HeadingLevel.HEADING_6;
        const indentLeft = node.attrs?.indent ? Math.round(node.attrs.indent * 360) : undefined;

        return new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun('')],
          heading: level,
          alignment: getAlignment(node.attrs?.textAlign),
          indent: indentLeft ? { left: indentLeft } : undefined,
          spacing: {
            before: levelNum === 1 ? 240 : levelNum === 2 ? 200 : 160,
            after: 120, // ~6pt boşluk
            line: lineOf(node.attrs?.lineHeight, 280)
          }
        });
      }

      case 'paragraph': {
        const content = node.content || [];
        const runs = content.length > 0
          ? content.map((c: any) => processMarks(c.text, c.marks))
          : [];
        const indentLeft = node.attrs?.indent ? Math.round(node.attrs.indent * 360) : undefined;
        return new Paragraph({
          children: runs,
          alignment: getAlignment(node.attrs?.textAlign),
          indent: indentLeft ? { left: indentLeft } : undefined,
          spacing: { after: 120, line: lineOf(node.attrs?.lineHeight, 276) }
        });
      }

      case 'blockquote': {
        const subParas = (node.content || []).map((c: any) => convertNode(c));
        return subParas;
      }

      case 'image': {
        const src: string = node.attrs?.src || '';
        if (src.startsWith('data:image/')) {
          try {
            const base64Data = src.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            let targetWidth = 460;
            const wAttr = String(node.attrs?.width || '100%');
            if (wAttr.endsWith('%')) {
              const pct = parseFloat(wAttr) / 100;
              targetWidth = Math.round(500 * (isNaN(pct) ? 1 : pct));
            } else if (!isNaN(parseFloat(wAttr))) {
              targetWidth = Math.min(500, Math.round(parseFloat(wAttr)));
            }

            const imgType: 'png' | 'jpg' | 'gif' | 'bmp' =
              src.includes('jpeg') || src.includes('jpg') ? 'jpg' : src.includes('gif') ? 'gif' : 'png';

            const align = getAlignment(node.attrs?.alignment);
            return new Paragraph({
              alignment: align,
              children: [
                new ImageRun({
                  type: imgType,
                  data: bytes,
                  transformation: {
                    width: targetWidth,
                    height: Math.round(targetWidth * 0.6)
                  }
                })
              ],
              spacing: { before: 160, after: 160 }
            });
          } catch (e) {
            console.error('Failed to export image to docx', e);
          }
        }
        return null;
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
        const items = node.content || [];
        items.forEach((item: any, idx: number) => {
          const isLastItem = idx === items.length - 1;
          const subNodes = item.content || [];
          subNodes.forEach((subNode: any, subIdx: number) => {
            const isLastSub = subIdx === subNodes.length - 1;
            const runs = (subNode.content || []).map((c: any) => processMarks(c.text, c.marks));
            listItems.push(
              new Paragraph({
                children: runs,
                bullet: node.type === 'bulletList' ? { level: 0 } : undefined,
                numbering: node.type === 'orderedList' ? { reference: 'numbered-list', level: 0 } : undefined,
                spacing: { after: isLastItem && isLastSub ? 160 : 80 }
              })
            );
          });
        });
        return listItems;
      }

      case 'table': {
        const tableBorders = {
          top: { style: BorderStyle.SINGLE, size: DOCX_TABLE_BORDER_SIZE, color: DOCX_TABLE_BORDER_COLOR },
          bottom: { style: BorderStyle.SINGLE, size: DOCX_TABLE_BORDER_SIZE, color: DOCX_TABLE_BORDER_COLOR },
          left: { style: BorderStyle.SINGLE, size: DOCX_TABLE_BORDER_SIZE, color: DOCX_TABLE_BORDER_COLOR },
          right: { style: BorderStyle.SINGLE, size: DOCX_TABLE_BORDER_SIZE, color: DOCX_TABLE_BORDER_COLOR },
          insideHorizontal: { style: BorderStyle.SINGLE, size: DOCX_TABLE_BORDER_SIZE, color: DOCX_TABLE_BORDER_COLOR },
          insideVertical: { style: BorderStyle.SINGLE, size: DOCX_TABLE_BORDER_SIZE, color: DOCX_TABLE_BORDER_COLOR }
        };

        const rows = (node.content || []).map((rowNode: any) => {
          const hasHeader = (rowNode.content || []).some((c: any) => c.type === 'tableHeader');
          const cells = (rowNode.content || []).map((cellNode: any) => {
            const cellChildren = (cellNode.content || []).map((p: any) => convertNode(p)).flat();
            const isHeader = cellNode.type === 'tableHeader';
            return new TableCell({
              children: cellChildren.length > 0 ? cellChildren : [new Paragraph({})],
              shading: isHeader
                ? { type: ShadingType.CLEAR, fill: DOCX_TABLE_HEADER_SHADING_COLOR }
                : undefined,
              borders: tableBorders,
              margins: { top: 120, bottom: 160, left: 140, right: 140 }
            });
          });
          return new TableRow({
            children: cells,
            tableHeader: hasHeader ? true : undefined
          });
        });

        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
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

  const marginDxa =
    options?.margin === 'narrow' ? 720 : options?.margin === 'wide' ? 2880 : 1440;
  const isLandscape = options?.orientation === 'landscape';

  const doc = new Document({
    title: documentTitle,
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 }
                }
              }
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: '%2.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 1440, hanging: 360 }
                }
              }
            },
            {
              level: 2,
              format: LevelFormat.LOWER_ROMAN,
              text: '%3.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 2160, hanging: 360 }
                }
              }
            }
          ]
        }
      ]
    },
    styles: {
      default: {
        document: {
          run: {
            font: DEFAULT_FONT_FALLBACK,
            size: 24, // 12pt
            color: '1C2523'
          }
        }
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 56, // 28pt
            bold: true,
            color: '111827',
            font: DEFAULT_FONT_FALLBACK
          },
          paragraph: {
            spacing: { before: 320, after: 160 }
          }
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 48, // 24pt
            bold: true,
            color: '111827',
            font: DEFAULT_FONT_FALLBACK
          },
          paragraph: {
            spacing: { before: 280, after: 140 }
          }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 36, // 18pt
            bold: true,
            color: '1F2937',
            font: DEFAULT_FONT_FALLBACK
          },
          paragraph: {
            spacing: { before: 240, after: 120 }
          }
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 30, // 15pt
            bold: true,
            color: '374151',
            font: DEFAULT_FONT_FALLBACK
          },
          paragraph: {
            spacing: { before: 200, after: 100 }
          }
        },
        {
          id: 'Heading4',
          name: 'Heading 4',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 24, // 12pt
            bold: true,
            color: '374151',
            font: DEFAULT_FONT_FALLBACK
          },
          paragraph: {
            spacing: { before: 160, after: 80 }
          }
        },
        {
          id: 'Heading5',
          name: 'Heading 5',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 22, // 11pt
            bold: true,
            color: '4B5563',
            font: DEFAULT_FONT_FALLBACK
          },
          paragraph: {
            spacing: { before: 120, after: 60 }
          }
        },
        {
          id: 'Heading6',
          name: 'Heading 6',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 20, // 10pt
            bold: true,
            color: '4B5563',
            font: DEFAULT_FONT_FALLBACK
          },
          paragraph: {
            spacing: { before: 100, after: 50 }
          }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
              width: isLandscape ? 16838 : 11906,
              height: isLandscape ? 11906 : 16838
            },
            margin: {
              top: marginDxa,
              bottom: marginDxa,
              left: marginDxa,
              right: marginDxa
            }
          }
        },
        children
      }
    ]
  });

  const buffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(buffer);
}
