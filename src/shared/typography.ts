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
  page: {
    size: 'A4',
    widthMm: 210,
    heightMm: 297,
    widthPt: 595.28,
    heightPt: 841.89,
    widthDxa: 11906,
    heightDxa: 16838,
    widthPx: 793.7,
    heightPx: 1122.5,
    contentWidthPx: 601.7,
    // Normal / standard sayfa kenar boşluğu: 25.4mm (1.0 inç / 72 pt / 1440 dxa / 96 px)
    marginMm: 25.4,
    marginIn: 1.0,
    marginPt: 72,
    marginDxa: 1440,
    marginPx: 96,
    marginCss: '25.4mm'
  },
  /**
   * Word / OpenXML ve CSS satır aralığı birimleri için TEK kaynak (I1):
   * Font metrikleri fontTools ile C:\Windows\Fonts\calibri.ttf ve Carlito-Regular.ttf
   * dosyalarının hhea/OS2 tablolarından okunmuştur:
   * unitsPerEm: 2048, hhea.ascent: 1536, hhea.descent: -512 (büyüklük: 512), lineGap: 452
   * Doğal font satır yüksekliği: (1536 + 512 + 452) / 2048 = 2500 / 2048 = 1.220703125 em.
   */
  metrics: {
    unitsPerEm: 2048,
    ascent: 1536,
    descent: 512,
    lineGap: 452,
    fontNaturalMultiplier: (1536 + 512 + 452) / 2048 // 1.220703125
  },
  body: {
    pt: 12,
    px: 16,
    halfPoints: 24,
    // Word tek kaynak:
    wordLineMultiple: 1.15,
    paragraphAfterPt: 6,
    get spaceAfterPt(): number {
      return this.paragraphAfterPt;
    },
    // DOCX w:line = round(wordLineMultiple * 240) -> 276
    get lineSpacingDxa(): number {
      return Math.round(this.wordLineMultiple * 240);
    },
    // Paragraf sonu dxa = round(paragraphAfterPt * 20) -> 120
    get spaceAfterDxa(): number {
      return Math.round(this.paragraphAfterPt * 20);
    },
    // cssLineHeight = wordLineMultiple * (ascent+descent+lineGap)/unitsPerEm
    // 1.15 * 1.220703125 = 1.40380859375
    get cssLineHeight(): number {
      return this.wordLineMultiple * this.fontNaturalMultiplier;
    },
    get fontNaturalMultiplier(): number {
      return (1536 + 512 + 452) / 2048;
    },
    get lineHeight(): number {
      return Math.round(this.cssLineHeight * 10) / 10;
    },
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
