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
import { TYPOGRAPHY } from '../../../shared/typography';
import { PageSetup } from '../../../shared/types';

export const DOCX_TABLE_BORDER_COLOR = '9CA3AF';
export const DOCX_TABLE_BORDER_SIZE = 4; // 0.5 pt (in eighths of a point)
export const DOCX_TABLE_HEADER_SHADING_COLOR = 'F3F4F6';

export interface DocxExportOptions {
  margin?: 'normal' | 'narrow' | 'wide';
  orientation?: 'portrait' | 'landscape';
  pageSetup?: PageSetup;
}

export async function exportTipTapJsonToDocx(
  docJson: any,
  documentTitle: string = 'Belge',
  options?: DocxExportOptions
): Promise<Uint8Array> {
  const children: any[] = [];

  const DEFAULT_FONT_FALLBACK = TYPOGRAPHY.fontFamily.name;

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

  function convertList(listNode: any, currentLevel: number = 0): any[] {
    const isBullet = listNode.type === 'bulletList';
    const listItems: any[] = [];
    const items = listNode.content || [];

    items.forEach((item: any, idx: number) => {
      const isLastItem = idx === items.length - 1;
      const subNodes = item.content || [];

      subNodes.forEach((subNode: any, subIdx: number) => {
        const isLastSub = subIdx === subNodes.length - 1;

        if (subNode.type === 'bulletList' || subNode.type === 'orderedList') {
          listItems.push(...convertList(subNode, currentLevel + 1));
        } else {
          const runs = (subNode.content || []).map((c: any) => processMarks(c.text, c.marks));
          listItems.push(
            new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun('')],
              bullet: isBullet ? { level: Math.min(currentLevel, 5) } : undefined,
              numbering: !isBullet
                ? { reference: 'numbered-list', level: Math.min(currentLevel, 5) }
                : undefined,
              spacing: { after: isLastItem && isLastSub ? 160 : 80 }
            })
          );
        }
      });
    });

    return listItems;
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
        return convertList(node, 0);
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
    options?.margin === 'narrow' ? 720 : options?.margin === 'wide' ? 2880 : TYPOGRAPHY.page.marginDxa;

  const isLandscape = options?.pageSetup
    ? options.pageSetup.orientation === 'landscape' || options.pageSetup.widthDxa > options.pageSetup.heightDxa
    : options?.orientation === 'landscape';

  let pageWidth = options?.pageSetup
    ? options.pageSetup.widthDxa
    : isLandscape ? TYPOGRAPHY.page.heightDxa : TYPOGRAPHY.page.widthDxa;

  let pageHeight = options?.pageSetup
    ? options.pageSetup.heightDxa
    : isLandscape ? TYPOGRAPHY.page.widthDxa : TYPOGRAPHY.page.heightDxa;

  // npm 'docx' paketi orientation: LANDSCAPE olduğunda width ve height değerlerini
  // XML'e yazarken tersine çevirir (w:w = height, w:h = width).
  // Bu nedenle OpenXML standardına ve w:w > w:h kuralına uygun çıktı üretmesi için:
  const exportWidth = isLandscape ? Math.min(pageWidth, pageHeight) : Math.min(pageWidth, pageHeight);
  const exportHeight = isLandscape ? Math.max(pageWidth, pageHeight) : Math.max(pageWidth, pageHeight);

  const pageMargins = options?.pageSetup?.margins
    ? {
        top: options.pageSetup.margins.top,
        bottom: options.pageSetup.margins.bottom,
        left: options.pageSetup.margins.left,
        right: options.pageSetup.margins.right,
        header: options.pageSetup.margins.header ?? 708,
        footer: options.pageSetup.margins.footer ?? 708,
        gutter: options.pageSetup.margins.gutter ?? 0
      }
    : {
        top: marginDxa,
        bottom: marginDxa,
        left: marginDxa,
        right: marginDxa,
        header: 708,
        footer: 708,
        gutter: 0
      };

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
            },
            {
              level: 3,
              format: LevelFormat.DECIMAL,
              text: '%4.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 2880, hanging: 360 }
                }
              }
            },
            {
              level: 4,
              format: LevelFormat.LOWER_LETTER,
              text: '%5.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 3600, hanging: 360 }
                }
              }
            },
            {
              level: 5,
              format: LevelFormat.LOWER_ROMAN,
              text: '%6.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 4320, hanging: 360 }
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
            font: TYPOGRAPHY.fontFamily.name,
            size: TYPOGRAPHY.body.halfPoints, // 12pt
            color: TYPOGRAPHY.body.colorHex
          },
          paragraph: {
            spacing: {
              line: TYPOGRAPHY.body.lineSpacingDxa,
              after: TYPOGRAPHY.body.spaceAfterDxa
            }
          }
        }
      },
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          quickFormat: true,
          run: {
            font: TYPOGRAPHY.fontFamily.name,
            size: TYPOGRAPHY.body.halfPoints,
            color: TYPOGRAPHY.body.colorHex
          },
          paragraph: {
            spacing: {
              line: TYPOGRAPHY.body.lineSpacingDxa,
              after: TYPOGRAPHY.body.spaceAfterDxa
            }
          }
        },
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
            font: TYPOGRAPHY.fontFamily.name
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
            size: TYPOGRAPHY.h1.halfPoints, // 24pt
            bold: true,
            color: TYPOGRAPHY.h1.colorHex,
            font: TYPOGRAPHY.fontFamily.name
          },
          paragraph: {
            spacing: { before: TYPOGRAPHY.h1.spaceBeforeDxa, after: TYPOGRAPHY.h1.spaceAfterDxa }
          }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: TYPOGRAPHY.h2.halfPoints, // 18pt
            bold: true,
            color: TYPOGRAPHY.h2.colorHex,
            font: TYPOGRAPHY.fontFamily.name
          },
          paragraph: {
            spacing: { before: TYPOGRAPHY.h2.spaceBeforeDxa, after: TYPOGRAPHY.h2.spaceAfterDxa }
          }
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: TYPOGRAPHY.h3.halfPoints, // 15pt
            bold: true,
            color: TYPOGRAPHY.h3.colorHex,
            font: TYPOGRAPHY.fontFamily.name
          },
          paragraph: {
            spacing: { before: TYPOGRAPHY.h3.spaceBeforeDxa, after: TYPOGRAPHY.h3.spaceAfterDxa }
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
              width: exportWidth,
              height: exportHeight
            },
            margin: pageMargins
          }
        },
        children
      }
    ]
  });

  const buffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(buffer);
}
