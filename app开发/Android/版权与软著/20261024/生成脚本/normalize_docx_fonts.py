from pathlib import Path
from docx import Document
from docx.shared import RGBColor
from docx.oxml.ns import qn
b=Path('app开发/Android/版权与软著/20261024')
files=list((b/'软著登记').glob('*.docx'))+list((b/'待签章').glob('*.docx'))
for path in files:
 if path.name.startswith("._"):continue
 d=Document(path)
 for root in [d.styles.element,d.element]:
  for border in root.xpath('.//w:pBdr'):border.getparent().remove(border)
  for fonts in root.xpath('.//w:rFonts'):
   for k in list(fonts.attrib):
    if 'Theme' in k or 'theme' in k:del fonts.attrib[k]
   for k in ['ascii','hAnsi','eastAsia','cs']:fonts.set(qn('w:'+k),'Arial Unicode MS')
 for n in ['Normal','Title','Heading 1','Heading 2']:
  if n not in d.styles:continue
  d.styles[n].font.name='Arial Unicode MS';d.styles[n].font.color.rgb=RGBColor(0,0,0)
 d.save(path)
# Keep the alternative packet byte identical to the corrected editable manual.
import shutil
shutil.copy2(b/'软著登记/操作说明书.docx',b/'电子版权备选/操作说明书.docx')
license=Path('app开发/Android/上架执行/20261024/公司资质原件/营业执照副本_原始照片.jpeg')
(b/'企业资质').mkdir(exist_ok=True);shutil.copy2(license,b/'企业资质/营业执照副本_原始照片.jpeg')
