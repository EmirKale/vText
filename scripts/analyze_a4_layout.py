import fitz, json, sys, os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

lo_pdf = r"c:\Users\User\Desktop\vText\test-artifacts\a4_comparison\lo_600words.pdf"
vt_pdf = r"c:\Users\User\Desktop\vText\test-artifacts\a4_comparison\vtext_600words.pdf"

def analyze_doc(pdf_path, name):
    doc = fitz.open(pdf_path)
    pages_data = []
    total_lines = 0
    total_words = 0
    for p_idx, page in enumerate(doc):
        blocks = page.get_text("blocks")
        lines_on_page = []
        for b in blocks:
            # b: (x0, y0, x1, y1, text, block_no, block_type)
            if b[6] == 0:  # text block
                b_lines = [l.strip() for l in b[4].split('\n') if l.strip()]
                lines_on_page.extend(b_lines)
        total_lines += len(lines_on_page)
        p_words = sum(len(l.split()) for l in lines_on_page)
        total_words += p_words
        pages_data.append({
            "page_num": p_idx + 1,
            "line_count": len(lines_on_page),
            "word_count": p_words,
            "first_line": lines_on_page[0] if lines_on_page else "",
            "last_line": lines_on_page[-1] if lines_on_page else ""
        })
    return {
        "name": name,
        "page_count": len(doc),
        "total_lines": total_lines,
        "total_words": total_words,
        "pages": pages_data
    }

lo_res = analyze_doc(lo_pdf, "LibreOffice PDF")
vt_res = analyze_doc(vt_pdf, "vText (Chromium) PDF")

print("--- A4 MİZANPAJ KARŞILAŞTIRMA SONUÇLARI ---")
print(json.dumps({"libreoffice": lo_res, "vtext": vt_res}, indent=2, ensure_ascii=False))
