import sys
import os
import fitz  # PyMuPDF
import json

def convert_pdf_to_png(pdf_path, png_path, assert_styles=False):
    if not os.path.exists(pdf_path):
        print(f"HATA: {pdf_path} dosyası bulunamadı", file=sys.stderr)
        sys.exit(1)
        
    doc = fitz.open(pdf_path)
    if len(doc) == 0:
        print("HATA: Boş PDF", file=sys.stderr)
        sys.exit(1)
        
    page = doc[0]
    out_dir = os.path.dirname(png_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    pix = page.get_pixmap(dpi=150)
    pix.save(png_path)
    
    fonts = page.get_fonts()
    d = page.get_text("dict")
    
    spans = []
    for b in d.get("blocks", []):
        for line in b.get("lines", []):
            for s in line.get("spans", []):
                txt = s.get("text", "").strip()
                if txt:
                    spans.append({
                        "text": txt,
                        "font": s.get("font", ""),
                        "size": round(s.get("size", 0), 1),
                        "flags": s.get("flags", 0),
                        "color": s.get("color", 0),
                        "color_hex": f"#{s.get('color', 0):06X}"
                    })
                    
    print(f"SUCCESS: Rendered page 1 to {png_path} ({pix.width}x{pix.height})")
    print("FONTS:", fonts)
    print("EXTRACTED SPANS COUNT:", len(spans))
    
    if assert_styles:
        print("\n--- GÖRÜNÜM DOĞRULAMA (STYLE ASSERTION) ---")
        if not spans:
            print("HATA: PDF içinde metin span'ı bulunamadı!", file=sys.stderr)
            sys.exit(1)
            
        errors = []

        # 1. Başlık 1 span'ı (vText Proje Raporu veya >= 20pt)
        h1_spans = [s for s in spans if "vText Proje Raporu" in s["text"] or s["size"] >= 20.0]
        if not h1_spans:
            errors.append("Başlık 1 span'ı bulunamadı!")
        else:
            h1 = h1_spans[0]
            print(f"Başlık 1 Spanı: '{h1['text']}' | Font: {h1['font']} | Boyut: {h1['size']}pt | Renk: {h1['color_hex']} | Flags: {h1['flags']}")
            if not any(f in h1['font'] for f in ['Calibri', 'Carlito']):
                errors.append(f"Başlık 1 fontu Calibri veya Carlito olmalıdır, bulunan: '{h1['font']}'")
            if h1['size'] < 20.0:
                errors.append(f"Başlık 1 boyutu >= 20pt olmalıdır, bulunan: {h1['size']}pt")
            is_bold = bool(h1['flags'] & 16) or ('Bold' in h1['font']) or bool(h1['flags'] & 2)
            if not is_bold:
                errors.append(f"Başlık 1 kalın (bold) olmalıdır (flags: {h1['flags']}, font: '{h1['font']}')")
            if h1['color_hex'].upper() == '#2E74B5':
                errors.append("Başlık 1 rengi varsayılan mavi (#2E74B5) OLMAMALIDIR!")

        # 2. Başlık 2 span'ı (Bölüm 1: Özellikler veya >= 16pt)
        h2_spans = [s for s in spans if "Bölüm 1:" in s["text"] or (16.0 <= s["size"] < 22.0 and "Raporu" not in s["text"])]
        if not h2_spans:
            errors.append("Başlık 2 span'ı bulunamadı!")
        else:
            h2 = h2_spans[0]
            print(f"Başlık 2 Spanı: '{h2['text']}' | Font: {h2['font']} | Boyut: {h2['size']}pt | Renk: {h2['color_hex']} | Flags: {h2['flags']}")
            if h2['size'] < 16.0:
                errors.append(f"Başlık 2 boyutu >= 16pt olmalıdır, bulunan: {h2['size']}pt")
            is_h2_bold = bool(h2['flags'] & 16) or ('Bold' in h2['font']) or bool(h2['flags'] & 2)
            if not is_h2_bold:
                errors.append(f"Başlık 2 kalın (bold) olmalıdır, bulunan: '{h2['font']}'")

        # 3. Başlık 3 span'ı (Bölüm 1.1: Sıralı veya >= 14pt)
        h3_spans = [s for s in spans if "Bölüm 1.1:" in s["text"] or (14.0 <= s["size"] < 16.5 and "Raporu" not in s["text"])]
        if not h3_spans:
            errors.append("Başlık 3 span'ı bulunamadı!")
        else:
            h3 = h3_spans[0]
            print(f"Başlık 3 Spanı: '{h3['text']}' | Font: {h3['font']} | Boyut: {h3['size']}pt | Renk: {h3['color_hex']} | Flags: {h3['flags']}")
            if h3['size'] < 14.0:
                errors.append(f"Başlık 3 boyutu >= 14pt olmalıdır, bulunan: {h3['size']}pt")
            is_h3_bold = bool(h3['flags'] & 16) or ('Bold' in h3['font']) or bool(h3['flags'] & 2)
            if not is_h3_bold:
                errors.append(f"Başlık 3 kalın (bold) olmalıdır, bulunan: '{h3['font']}'")

        # 4. Gövde spanı kontrolü (11-12pt, Calibri/Carlito)
        body_spans = [s for s in spans if (10.5 <= s['size'] <= 13.0) and "Başlık" not in s['text'] and "Bölüm" not in s['text']]
        if not body_spans:
            errors.append("Gövde span'ı bulunamadı!")
        else:
            body_span = body_spans[0]
            print(f"Gövde Spanı: '{body_span['text']}' | Font: {body_span['font']} | Boyut: {body_span['size']}pt | Renk: {body_span['color_hex']}")
            if not any(f in body_span['font'] for f in ['Calibri', 'Carlito']):
                errors.append(f"Gövde fontu Calibri veya Carlito olmalıdır, bulunan: '{body_span['font']}'")
            if not (10.5 <= body_span['size'] <= 13.0):
                errors.append(f"Gövde boyutu 11-12pt aralığında olmalıdır, bulunan: {body_span['size']}pt")

        # 5. İtalik span kontrolü
        italic_spans = [s for s in spans if "italik" in s["text"].lower() or ("Italic" in s["font"]) or (bool(s["flags"] & 2))]
        if not italic_spans:
            errors.append("İtalik metin span'ı bulunamadı!")
        else:
            it_span = italic_spans[0]
            print(f"İtalik Spanı: '{it_span['text']}' | Font: {it_span['font']} | Flags: {it_span['flags']}")
            is_it = ("Italic" in it_span["font"]) or bool(it_span["flags"] & 2)
            if not is_it:
                errors.append(f"İtalik span'ın fontu veya flag'i italik olmalıdır, bulunan: '{it_span['font']}'")

        if errors:
            print("\n[FAIL] GORUNUM DOGRULAMA BASARISIZ OLDU:")
            for e in errors:
                print(f"  [X] {e}")
            sys.exit(1)
        else:
            print("\n[PASS] GORUNUM DOGRULAMA BASARILI: Başlık 1/2/3, gövde ve italik stilleri beklenen kurallara uygundur.")
            
    return True

if __name__ == "__main__":
    assert_flag = "--assert-styles" in sys.argv
    pos_args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(pos_args) < 2:
        print("Usage: python pdf-to-image.py [--assert-styles] <input.pdf> <output.png>")
        sys.exit(1)
    convert_pdf_to_png(pos_args[0], pos_args[1], assert_styles=assert_flag)
