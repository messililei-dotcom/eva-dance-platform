from pathlib import Path
from docx import Document
from docx.text.paragraph import Paragraph
from docx.oxml import OxmlElement
from docx.shared import Pt
b=Path('app开发/Android/版权与软著/20261024');d=Document(b/'官方核验/OPPO通用承诺函原版.docx')
remove=False
for p in list(d.paragraphs):
 if p.text.strip()=='承诺函（授权软件）':remove=True
 if remove:p._element.getparent().remove(p._element)
for p in d.paragraphs:
 for r in p.runs:r.text=r.text.replace('应用名称：【】','应用名称：【SWOD】')
 if p.text.strip().startswith('企业名称：'):p.text='企业名称：伊娃文化艺术发展（湖南）有限公司'
# Include the actual published extra clauses as an unsigned proposal for paid-course learning.
anchor=next(p for p in d.paragraphs if p.text.strip().startswith('企业名称：'))
for t in ['线上教育含付费课程补充承诺','①应用运营者不得以任何方式泄露用户隐私','②应用内不得以任何方式频繁打扰用户正常使用应用功能','③应用内向用户承诺的退款方式始终真实有效','④如因自身原因导致应用停运，务必提前告知用户并就退款等事宜协商妥善']:
 anchor.insert_paragraph_before(t)
# Remove empty trailing paragraphs and manual page breaks left by the alternative form.
while d.paragraphs and not d.paragraphs[-1].text.strip():
 p=d.paragraphs[-1];p._element.getparent().remove(p._element)
for p in d.paragraphs:
 for br in p._p.xpath('.//w:br[@w:type="page"]'):br.getparent().remove(br)
d.save(b/'待签章/OPPO通用承诺函已填待核对.docx')
