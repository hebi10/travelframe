"""Align design and native popup captures for QA only; never edit app assets."""
import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


parser = argparse.ArgumentParser()
parser.add_argument("--capture", required=True)
parser.add_argument("--xml", required=True)
parser.add_argument("--suffix", required=True)
args = parser.parse_args()
directory = Path(__file__).resolve().parent
tree = ET.parse(directory / args.xml)
popup = next(node for node in tree.iter("node") if node.get("resource-id") == "app-guide-popup")
bounds = tuple(map(int, re.findall(r"\d+", popup.get("bounds", ""))))
if len(bounds) != 4 or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
    raise ValueError("Invalid native popup bounds")

actual = Image.open(directory / args.capture).convert("RGB").crop(bounds)
reference_source = Image.open(directory / "design-reference.png").convert("RGB")
reference_height = round(reference_source.height * actual.width / reference_source.width)
reference = reference_source.resize((actual.width, reference_height), Image.Resampling.LANCZOS)
height = max(actual.height, reference.height)
panels = []
for image in (reference, actual):
    panel = Image.new("RGB", (actual.width, height), (26, 26, 29))
    panel.paste(image, (0, 0))
    panels.append(panel)

font_path = Path("C:/Windows/Fonts/malgun.ttf")
font = ImageFont.truetype(str(font_path), 28) if font_path.exists() else ImageFont.load_default()
margin, gap, heading = 24, 32, 64
board = Image.new("RGB", (actual.width * 2 + gap + margin * 2, height + heading + margin), (245, 245, 245))
draw = ImageDraw.Draw(board)
draw.text((margin, 16), "생성 시안 · 동일 폭 정렬", fill=(20, 20, 20), font=font)
draw.text((margin + actual.width + gap, 16), "실제 Android · 원본 픽셀", fill=(20, 20, 20), font=font)
board.paste(panels[0], (margin, heading))
board.paste(panels[1], (margin + actual.width + gap, heading))
board.save(directory / f"comparison-{args.suffix}.png")
actual.save(directory / f"actual-{args.suffix}-crop.png")
reference.save(directory / f"reference-{args.suffix}-normalized.png")
Image.blend(panels[0], panels[1], 0.5).save(directory / f"overlay-{args.suffix}.png")

metrics = {
    "nativePopupBounds": bounds,
    "nativePopupPixels": [actual.width, actual.height],
    "referenceOriginalPixels": [reference_source.width, reference_source.height],
    "referenceAlignedPixels": [reference.width, reference.height],
    "referenceMinusNativeHeightPx": reference.height - actual.height,
    "normalization": "Reference uniformly resized to native popup width; native pixels unchanged; bottom padding only for board",
}
(directory / f"metrics-{args.suffix}.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
print(json.dumps(metrics))
