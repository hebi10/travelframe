"""QA-only image normalization; never edits app image assets or original captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
FRAMES = {'main': ('design-main.png', None), 'settings': ('design-sheets.png', 0), 'guide': ('design-sheets.png', 1), 'projects': ('design-sheets.png', 2), 'create': ('design-sheets.png', 3), 'reference': ('design-tools.png', 0), 'color': ('design-tools.png', 1), 'zoom': ('design-tools.png', 2), 'light': ('design-tools.png', 3)}

def compare(stage):
    out = ROOT / f'comparison-{stage}'
    out.mkdir(exist_ok=True)
    metrics = {}
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 26)
    for name, (filename, index) in FRAMES.items():
        path = ROOT / stage / f'{name}.png'
        if not path.exists():
            continue
        reference = Image.open(ROOT / filename).convert('RGB')
        if index is not None:
            reference = reference.crop((index*reference.width//4, 0, (index+1)*reference.width//4, reference.height))
        actual = Image.open(path).convert('RGB')
        size = (actual.width, round(reference.height*actual.width/reference.width))
        reference = reference.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (actual.width*2+24, max(reference.height, actual.height)+64), '#303036')
        draw = ImageDraw.Draw(canvas)
        draw.text((12,12), '생성 시안 (동일 너비 정규화)', font=font, fill='white')
        draw.text((actual.width+36,12), f'실제 Android · {stage}', font=font, fill='white')
        canvas.paste(reference, (0,64))
        canvas.paste(actual, (actual.width+24,64))
        canvas.save(out / f'{name}.png')
        entry = {'actualOriginal': list(actual.size), 'referenceNormalized': list(reference.size), 'nativePixelsRescaled': False, 'referenceFrame': index}
        xml = path.with_suffix('.xml')
        if xml.exists():
            nodes = ET.parse(xml).getroot().iter('node')
            entry['controls'] = [{'label': n.get('content-desc'), 'bounds': n.get('bounds'), 'selected': n.get('selected')} for n in nodes if n.get('content-desc') in ('프로젝트 선택','확대 설정 닫기','조명 설정 닫기','촬영 설정 닫기','가이드 설정 닫기','사진 촬영')]
        metrics[name] = entry
    (out / 'metrics.json').write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding='utf-8')
    return metrics

if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('stage', choices=['initial','final'])
    args=p.parse_args()
    print(json.dumps(compare(args.stage), ensure_ascii=True))
