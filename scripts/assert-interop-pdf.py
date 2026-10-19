import sys
import os
import fitz

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

if len(sys.argv) < 2:
    print("Usage: python assert-interop-pdf.py <pdf-path>")
    sys.exit(1)

pdf_path = sys.argv[1]
if not os.path.exists(pdf_path):
    print(f"Error: {pdf_path} not found")
    sys.exit(1)

doc = fitz.open(pdf_path)
page = doc[0]
text = page.get_text()
links = page.get_links()
images = page.get_images()

print("--- TEXT ---")
print(text.strip())
print("--- STATS ---")
print(f"PAGES: {len(doc)}")
print(f"LINKS_COUNT: {len(links)}")
for l in links:
    print("LINK:", l.get("uri"))
print(f"IMAGES_COUNT: {len(images)}")
