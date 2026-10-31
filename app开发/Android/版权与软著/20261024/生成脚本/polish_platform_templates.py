from pathlib import Path
from docx import Document
from docx.shared import Pt,RGBColor,Cm
b=Path('app开发/Android/版权与软著/20261024/待签章')
p=b/'应用宝应用发布承诺函已填待核对.docx';d=Document(p)
for para in d.paragraphs:
 text=para.text
 for needle in ['本公司□','本公司£']:
  start=0
  while True:
   k=text.find(needle,start)
   if k<0:break
   target=k+3;offset=0
   for run in para.runs:
    if offset<=target<offset+len(run.text):
     i=target-offset;run.text=run.text[:i]+'☑'+run.text[i+1:];break
    offset+=len(run.text)
   start=k+len(needle)
for para in d.paragraphs:
 for r in para.runs:r.font.color.rgb=RGBColor(0,0,0)
d.save(p)
p=b/'OPPO通用承诺函已填待核对.docx';d=Document(p)
for s in d.sections:s.page_width=Cm(21);s.page_height=Cm(29.7);s.top_margin=s.bottom_margin=Cm(2.1)
for i,para in enumerate(d.paragraphs):
 para.paragraph_format.space_before=Pt(0);para.paragraph_format.space_after=Pt(6);para.paragraph_format.line_spacing=1.25
 for r in para.runs:r.font.size=Pt(11);r.font.color.rgb=RGBColor(0,0,0)
 if i==0:
  for r in para.runs:r.font.size=Pt(16);r.bold=True
 if para.text.strip()=='承诺函':
  for r in para.runs:r.font.size=Pt(13);r.bold=True
d.save(p)
