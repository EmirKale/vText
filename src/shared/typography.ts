/**
 * src/shared/typography.ts
 *
 * Paylaşılan tipografi sabitleri:
 * - Editör CSS (globals.css / TipTap)
 * - DOCX dışa aktarımı (docxExport.ts)
 * - PDF dışa aktarımı (src/main/pdf.ts)
 *
 * Değerler OpenXML styles.xml ve Word standartları ile tam uyumludur.
 */

export const TYPOGRAPHY = {
  fontFamily: {
    name: 'Calibri',
    fallback: 'Carlito',
    stack: 'Calibri, Carlito, "Segoe UI", sans-serif',
    stackCss: "'Calibri', 'Carlito', 'Segoe UI', sans-serif"
  },
  body: {
    pt: 12,
    px: 16,
    halfPoints: 24,
    lineHeight: 1.15,
    lineSpacingDxa: 276, // 1.15 * 240
    spaceAfterPt: 6,
    spaceAfterDxa: 120,
    spaceAfterEm: '0.5em',
    colorHex: '1C2523'
  },
  h1: {
    pt: 24,
    px: 32,
    halfPoints: 48,
    ratioToBody: 2.0, // 24 / 12
    em: '2.0em',
    lineHeight: 1.15,
    spaceBeforePt: 14,
    spaceBeforeDxa: 280,
    spaceAfterPt: 7,
    spaceAfterDxa: 140,
    spaceBeforeEm: '0.6em',
    spaceAfterEm: '0.3em',
    colorHex: '111827'
  },
  h2: {
    pt: 18,
    px: 24,
    halfPoints: 36,
    ratioToBody: 1.5, // 18 / 12
    em: '1.5em',
    lineHeight: 1.15,
    spaceBeforePt: 12,
    spaceBeforeDxa: 240,
    spaceAfterPt: 6,
    spaceAfterDxa: 120,
    spaceBeforeEm: '0.65em',
    spaceAfterEm: '0.3em',
    colorHex: '1F2937'
  },
  h3: {
    pt: 15,
    px: 20,
    halfPoints: 30,
    ratioToBody: 1.25, // 15 / 12
    em: '1.25em',
    lineHeight: 1.15,
    spaceBeforePt: 10,
    spaceBeforeDxa: 200,
    spaceAfterPt: 5,
    spaceAfterDxa: 100,
    spaceBeforeEm: '0.65em',
    spaceAfterEm: '0.3em',
    colorHex: '374151'
  }
} as const;
