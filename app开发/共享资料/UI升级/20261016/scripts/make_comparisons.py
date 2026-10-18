"""Lay out unchanged native screenshots side by side; never generate app pixels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageStat
import json, hashlib

root = Path(__file__).resolve().parents[1]
font_path = '/System/Library/Fonts/STHeiti Medium.ttc'
def font(size): return ImageFont.truetype(font_path, size)
names = [('academy','线上学院'),('offline','线下课程'),('events','东方舞赛事'),('shop','商城'),('account','个人中心')]
manifest = []
for platform, label in [('ios','iOS'), ('android','Android')]:
    for slug, title in names:
        files = [root / phase / (platform + '-' + slug + '.png') for phase in ['before','after']]
        images = [Image.open(p).convert('RGB') for p in files]
        for image in images:
            region = image.crop((0, 200, image.width, int(image.height * .88)))
            if max(ImageStat.Stat(region).stddev) < 12:
                raise RuntimeError('Blank native screenshot: ' + str(files))
        width = 480
        resized = [image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS) for image in images]
        height = max(image.height for image in resized)
        out = Image.new('RGB', (1048, height + 198), '#E9ECF0')
        draw = ImageDraw.Draw(out)
        draw.text((32, 23), label + ' · ' + title, fill='#20242B', font=font(28))
        draw.text((32, 69), '优化前', fill='#626A77', font=font(20))
        draw.text((536, 69), '优化后', fill='#9F1D20', font=font(20))
        for x, image in zip([32,536], resized): out.paste(image,(x,108))
        note = '同一套本地演示数据 · iOS Simulator 运行截图' if platform == 'ios' else '同一公开接口的真实内容 · Android Emulator 运行截图'
        draw.text((32,height+128),note,fill='#626A77',font=font(17))
        draw.text((32,height+156),'2026-10-16 · 原始截图完整保留，比较图仅作等比缩放和并排排版',fill='#626A77',font=font(14))
        target=root/'comparisons'/(platform+'-'+slug+'.png');out.save(target)
        manifest.append({'platform':platform,'page':slug,'comparison':str(target.relative_to(root)),'sources':[{'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]})
# Compact review sheets cover all five destinations in one inspection per platform.
for platform in ['ios','android']:
    thumbnails=[]
    for slug,title in names:
        im=Image.open(root/'comparisons'/(platform+'-'+slug+'.png')).convert('RGB')
        im.thumbnail((524,720));thumbnails.append(im)
    sheet=Image.new('RGB',(524*5,max(x.height for x in thumbnails)),'#E9ECF0')
    for i,im in enumerate(thumbnails):sheet.paste(im,(i*524,0))
    sheet.save(root/'comparisons'/(platform+'-all-pages.png'))
(root/'screenshots.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('10 native comparisons and 2 complete review sheets generated; all 20 native screenshots passed the blank-image check.')
