import subprocess
import zipfile
import os
import shutil

soffice = r"C:\Program Files\LibreOffice\program\soffice.exe"
fixtures_dir = r"tests\fixtures"
os.makedirs(fixtures_dir, exist_ok=True)
scratch_dir = r"scratch\h6_gen"
os.makedirs(scratch_dir, exist_ok=True)

# Helper: Convert FODT to DOCX using LibreOffice
def convert_fodt(fodt_content, name):
    fodt_path = os.path.join(scratch_dir, f"{name}.fodt")
    with open(fodt_path, "w", encoding="utf-8") as f:
        f.write(fodt_content)
    subprocess.run([soffice, "--headless", "--convert-to", "docx:Office Open XML Text", "--outdir", fixtures_dir, fodt_path], check=True)
    target_docx = os.path.join(fixtures_dir, f"{name}.docx")
    print(f"Generated {target_docx}: {os.path.exists(target_docx)}")

# 1. Clean fixture
clean_fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 office:mimetype="application/vnd.oasis.opendocument.text" office:version="1.3">
 <office:body>
  <office:text>
   <text:p>Bu temiz bir metin belgesidir, desteklenmeyen oge icermez.</text:p>
  </office:text>
 </office:body>
</office:document>"""
convert_fodt(clean_fodt, "h6-clean")

# 2. Equations (denklemler: w:oMath / m:oMath)
math_fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
 xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
 xmlns:math="http://www.w3.org/1998/Math/MathML"
 office:mimetype="application/vnd.oasis.opendocument.text" office:version="1.3">
 <office:body>
  <office:text>
   <text:p>Denklem belgesi: 
    <draw:frame draw:name="Math1" text:anchor-type="as-char" svg:width="3cm" svg:height="1cm">
     <draw:object>
      <math:math>
       <math:semantics>
        <math:mrow>
         <math:mi>f</math:mi><math:mo>(</math:mo><math:mi>x</math:mi><math:mo>)</math:mo>
         <math:mo>=</math:mo>
         <math:msup><math:mi>x</math:mi><math:mn>2</math:mn></math:msup>
        </math:mrow>
       </math:semantics>
      </math:math>
     </draw:object>
    </draw:frame>
   </text:p>
  </office:text>
 </office:body>
</office:document>"""
convert_fodt(math_fodt, "h6-equations")

# 3. Textboxes (metin kutuları: w:txbxContent)
textbox_fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
 xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
 office:mimetype="application/vnd.oasis.opendocument.text" office:version="1.3">
 <office:body>
  <office:text>
   <text:p>Metin kutusu oncesi metin</text:p>
   <text:p>
    <draw:frame draw:name="Box1" text:anchor-type="paragraph" svg:width="6cm" svg:height="3cm">
     <draw:text-box>
      <text:p>Metin kutusu icerisindeki metin alani</text:p>
     </draw:text-box>
    </draw:frame>
   </text:p>
  </office:text>
 </office:body>
</office:document>"""
convert_fodt(textbox_fodt, "h6-textboxes")

# 4. Shapes (şekil: wps:)
shape_fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
 xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
 office:mimetype="application/vnd.oasis.opendocument.text" office:version="1.3">
 <office:body>
  <office:text>
   <text:p>Sekil belgesi</text:p>
   <text:p>
    <draw:custom-shape draw:name="ShapeRect" text:anchor-type="paragraph" svg:width="4cm" svg:height="4cm">
     <draw:enhanced-geometry draw:type="rectangle"/>
    </draw:custom-shape>
   </text:p>
  </office:text>
 </office:body>
</office:document>"""
convert_fodt(shape_fodt, "h6-shapes")

# 5. Multi-column (çok sütun: w:cols num>1)
cols_fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 office:mimetype="application/vnd.oasis.opendocument.text" office:version="1.3">
 <office:automatic-styles>
  <style:style style:name="SectCols2" style:family="section">
   <style:section-properties>
    <style:columns fo:column-count="2" fo:column-gap="0.6cm"/>
   </style:section-properties>
  </style:style>
 </office:automatic-styles>
 <office:body>
  <office:text>
   <text:section text:name="Section2Cols" text:style-name="SectCols2">
    <text:p>Birinci sutun metni buraya yazilmaktadir.</text:p>
    <text:p>Ikinci sutun metni buraya akmaktadir.</text:p>
   </text:section>
  </office:text>
 </office:body>
</office:document>"""
convert_fodt(cols_fodt, "h6-columns")

# 6. Fields: TOC, PAGE, NUMPAGES (alanlar)
fields_fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 office:mimetype="application/vnd.oasis.opendocument.text" office:version="1.3">
 <office:body>
  <office:text>
   <text:table-of-content text:name="TOC1">
    <text:table-of-content-source text:outline-level="3"/>
    <text:index-body>
     <text:p text:style-name="Heading">İçindekiler Tablosu</text:p>
    </text:index-body>
   </text:table-of-content>
   <text:h text:outline-level="1">Giriş Bölümü</text:h>
   <text:p>Sayfa: <text:page-number>1</text:page-number> / Toplam: <text:page-count>1</text:page-count></text:p>
  </office:text>
 </office:body>
</office:document>"""
convert_fodt(fields_fodt, "h6-fields")

# 7. Cross-references (çapraz başvurular: w:bookmarkStart ile REF/PAGEREF)
crossref_fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 office:mimetype="application/vnd.oasis.opendocument.text" office:version="1.3">
 <office:body>
  <office:text>
   <text:p><text:bookmark-start text:name="BolumHedefi"/>Hedeflenmis Bolum Metni<text:bookmark-end text:name="BolumHedefi"/></text:p>
   <text:p>Bkz sayfa: <text:reference-ref text:reference-format="page" text:ref-name="BolumHedefi">1</text:reference-ref></text:p>
  </office:text>
 </office:body>
</office:document>"""
convert_fodt(crossref_fodt, "h6-crossref")

# 8. ptab (w:ptab): Create based on clean docx with injected <w:ptab/>
base_clean_docx = os.path.join(fixtures_dir, "h6-clean.docx")

def inject_xml(source_docx, target_docx, replacer_fn):
    with zipfile.ZipFile(source_docx, 'r') as zin:
        with zipfile.ZipFile(target_docx, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == 'word/document.xml':
                    data = replacer_fn(data.decode('utf-8')).encode('utf-8')
                zout.writestr(item, data)
    print(f"Generated {target_docx}: {os.path.exists(target_docx)}")

inject_xml(
    base_clean_docx,
    os.path.join(fixtures_dir, "h6-ptab.docx"),
    lambda xml: xml.replace("</w:r>", '<w:ptab w:alignment="right" w:relativeTo="margin" w:leader="none"/></w:r>')
)

# 9. Chart (c:chart):
inject_xml(
    base_clean_docx,
    os.path.join(fixtures_dir, "h6-chart.docx"),
    lambda xml: xml.replace("</w:p>", '<w:r><w:drawing><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart1"/></w:drawing></w:r></w:p>')
)

# 10. SmartArt (dgm:):
inject_xml(
    base_clean_docx,
    os.path.join(fixtures_dir, "h6-smartart.docx"),
    lambda xml: xml.replace("</w:p>", '<w:r><w:drawing><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rId1"/></w:drawing></w:r></w:p>')
)

print("All H6 fixtures generated successfully.")
