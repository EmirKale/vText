import fitz
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

if len(sys.argv) < 2:
    print("Usage: python check-pdf-fonts.py <pdf-path>")
    sys.exit(1)

doc = fitz.open(sys.argv[1])
page = doc[0]
fonts = page.get_fonts()
print("FONTS:", fonts)

d = page.get_text("dict")
found_calibri = False
for b in d.get("blocks", []):
    for line in b.get("lines", []):
        for s in line.get("spans", []):
            font_name = s.get("font", "")
            print(f"SPAN TEXT: '{s.get('text', '')}' | FONT: '{font_name}' | SIZE: {s.get('size')}")
            if any(c in font_name.lower() for c in ["calibri", "carlito"]):
                found_calibri = True

print("CALIBRI_OR_CARLITO_FOUND:", found_calibri)
