import JSZip from 'jszip';

export interface UnsupportedFeaturesResult {
  hasUnsupported: boolean;
  features: string[];
  warningMessage?: string;
}

/**
 * DOCX zip içeriğini tarayarak henüz tam desteklenmeyen öğeleri tespit eder:
 * - Üstbilgi/Altbilgi (word/header*.xml, word/footer*.xml)
 * - Dipnot/Sonnot (word/footnotes.xml, word/endnotes.xml - ayırıcı olmayan)
 * - Sayfa Sonu (w:br w:type="page")
 * - Yorumlar (word/comments.xml, w:comment)
 * - Değişiklik İzleme (w:ins, w:del)
 * - İçerik Denetimleri (w:sdt)
 * - Gömülü Nesneler (w:object, word/embeddings/)
 */
export async function detectUnsupportedDocxFeatures(
  zip: JSZip,
  mammothMessages?: Array<{ type?: string; message: string }>
): Promise<UnsupportedFeaturesResult> {
  const detected = new Set<string>();

  // 1. Üstbilgi ve Altbilgi (word/header*.xml, word/footer*.xml)
  for (const relativePath of Object.keys(zip.files)) {
    if (/^word\/(header|footer)\d*\.xml$/i.test(relativePath)) {
      try {
        const xml = await zip.files[relativePath].async('string');
        const textMatches = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)];
        const hasText = textMatches.some((m) => m[1] && m[1].trim().length > 0);
        if (hasText) {
          detected.add('üstbilgi/altbilgi');
          break;
        }
      } catch {}
    }
  }

  // 2. Dipnot ve Sonnot (word/footnotes.xml, word/endnotes.xml)
  for (const fnPath of ['word/footnotes.xml', 'word/endnotes.xml']) {
    const fnFile = zip.file(fnPath);
    if (fnFile) {
      try {
        const xml = await fnFile.async('string');
        // w:type="separator" ve "continuationSeparator" hariç notları incele
        const noteBlocks = [...xml.matchAll(/<w:(footnote|endnote)\b([^>]*)>([\s\S]*?)<\/w:\1>/gi)];
        const hasUserNotes = noteBlocks.some((nb) => {
          const attrs = nb[2] || '';
          const body = nb[3] || '';
          if (/w:type=["'](separator|continuationSeparator)["']/i.test(attrs)) {
            return false;
          }
          const textMatches = [...body.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)];
          return textMatches.some((m) => m[1] && m[1].trim().length > 0);
        });
        if (hasUserNotes) {
          detected.add('dipnot/sonnot');
          break;
        }
      } catch {}
    }
  }

  // word/document.xml incelemesi
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    try {
      const docXml = await docFile.async('string');

      // 3. Sayfa Sonu (w:br w:type="page")
      if (/<w:br\b[^>]*w:type=["']page["']/i.test(docXml)) {
        detected.add('sayfa sonu');
      }

      // 4. Yorumlar (w:commentReference veya word/comments.xml)
      if (/<w:commentReference\b/i.test(docXml) || /<w:commentRangeStart\b/i.test(docXml)) {
        detected.add('yorumlar');
      }

      // 5. Değişiklik İzleme (w:ins, w:del)
      if (/<w:ins\b/i.test(docXml) || /<w:del\b/i.test(docXml)) {
        detected.add('değişiklik izleme');
      }

      // 6. İçerik Denetimleri (w:sdt)
      if (/<w:sdt\b/i.test(docXml)) {
        detected.add('içerik denetimleri');
      }

      // 7. Gömülü Nesneler (w:object, w:control, word/embeddings/)
      if (/<w:object\b/i.test(docXml) || /<w:control\b/i.test(docXml)) {
        detected.add('gömülü nesneler');
      }

      // 8. Denklemler (w:oMath / m:oMath)
      if (/<(?:w|m):oMath\b/i.test(docXml)) {
        detected.add('denklemler');
      }

      // 9. Metin kutuları (w:txbxContent)
      if (/<w:txbxContent\b/i.test(docXml)) {
        detected.add('metin kutuları');
      }

      // 10. Grafik (w:drawing içinde c:chart)
      if (/<c:chart\b/i.test(docXml) || Object.keys(zip.files).some((k) => /^word\/charts\//i.test(k))) {
        detected.add('grafik');
      }

      // 11. Şekil (wps:)
      if (/<wps:(?:wsp|spPr|txbx)\b/i.test(docXml) || /<wps:\b/i.test(docXml)) {
        detected.add('şekil');
      }

      // 12. SmartArt (dgm:)
      if (/<dgm:\b/i.test(docXml) || Object.keys(zip.files).some((k) => /^word\/diagrams\//i.test(k))) {
        detected.add('SmartArt');
      }

      // 13. Çok sütun (w:cols num > 1)
      const colsMatch = docXml.match(/<w:cols\b[^>]*w:num=["'](\d+)["']/i);
      if (colsMatch && parseInt(colsMatch[1], 10) > 1) {
        detected.add('çok sütun');
      }

      // 14. Alanlar: TOC, PAGE, NUMPAGES (w:fldSimple veya w:instrText)
      if (
        /<w:fldSimple\b[^>]*w:instr=["'][^"']*\b(?:TOC|PAGE|NUMPAGES)\b/i.test(docXml) ||
        /<w:instrText\b[^>]*>[^<]*\b(?:TOC|PAGE|NUMPAGES)\b/i.test(docXml)
      ) {
        detected.add('alanlar (TOC/PAGE/NUMPAGES)');
      }

      // 15. ptab (w:ptab)
      if (/<w:ptab\b/i.test(docXml)) {
        detected.add('ptab');
      }

      // 16. Çapraz başvurular (REF / PAGEREF ile w:bookmarkStart)
      if (
        /<w:bookmarkStart\b/i.test(docXml) &&
        (/<w:fldSimple\b[^>]*w:instr=["'][^"']*\b(?:REF|PAGEREF)\b/i.test(docXml) ||
         /<w:instrText\b[^>]*>[^<]*\b(?:REF|PAGEREF)\b/i.test(docXml))
      ) {
        detected.add('çapraz başvurular (REF/PAGEREF)');
      }
    } catch {}
  }

  // word/comments.xml kontrolü (eğer document.xml'den yakalanmadıysa)
  if (!detected.has('yorumlar')) {
    const commentsFile = zip.file('word/comments.xml');
    if (commentsFile) {
      try {
        const cXml = await commentsFile.async('string');
        if (/<w:comment\b/i.test(cXml)) {
          detected.add('yorumlar');
        }
      } catch {}
    }
  }

  // Gömülü nesne dosyaları (word/embeddings/ altındaki OLE, excel, vb.)
  if (!detected.has('gömülü nesneler')) {
    for (const key of Object.keys(zip.files)) {
      if (/^word\/embeddings\//i.test(key)) {
        detected.add('gömülü nesneler');
        break;
      }
    }
  }

  // Mammoth mesajları (varsa ve ek kritik uyarılar içeriyorsa)
  if (mammothMessages && mammothMessages.length > 0) {
    for (const m of mammothMessages) {
      const msg = (m.message || '').toLowerCase();
      if (msg.includes('footnote') || msg.includes('endnote')) {
        detected.add('dipnot/sonnot');
      } else if (msg.includes('comment')) {
        detected.add('yorumlar');
      }
    }
  }

  const features = Array.from(detected);
  if (features.length === 0) {
    return {
      hasUnsupported: false,
      features: []
    };
  }

  const listStr = features.join(', ');
  const warningMessage = `Bu belgede vText'in henüz desteklemediği öğeler var (${listStr}). Kaydederseniz bu öğeler kaybolabilir. Orijinalin yedeği kaydetmeden önce alınır.`;

  return {
    hasUnsupported: true,
    features,
    warningMessage
  };
}
