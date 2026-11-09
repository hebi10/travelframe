#!/usr/bin/env python3
"""Resize six authenticated Google Play screenshot assets without changing their content."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def process(manifest_path: Path, source_dir: Path, output_dir: Path):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["packageName"] == "com.haebi.photoguide"
    assert manifest["language"] == "ko-KR"
    assert manifest["imageType"] == "phoneScreenshots"
    assert (manifest["width"], manifest["height"]) == (1080, 1920)
    assets = manifest["assets"]
    assert len(assets) == 6
    output_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for number, item in enumerate(assets, 1):
        assert item["index"] == number
        assert len(item["sourceSha256"]) == 64
        source = source_dir / f"{number:02}.png"
        raw = source.read_bytes()
        assert raw.startswith(PNG_SIGNATURE)
        assert hashlib.sha256(raw).hexdigest() == item["sourceSha256"], f"Source hash mismatch: {number}"
        with Image.open(source) as opened:
            assert opened.format == "PNG"
            assert opened.size == (item["sourceWidth"], item["sourceHeight"])
            assert opened.mode in ("RGB", "RGBA")
            rgb = opened.convert("RGB")
            resized = rgb.resize((1080, 1920), Image.Resampling.LANCZOS)
        name = item["outputName"]
        assert name == f"{number:02}_TravelFrame_{number:02}_1080x1920.png"
        target = output_dir / name
        resized.save(target, format="PNG", optimize=True)
        content = target.read_bytes()
        with Image.open(target) as check:
            assert check.mode == "RGB"
            assert check.size == (1080, 1920)
            assert check.format == "PNG"
        entries.append(dict(index=number, fileName=name, sha256=hashlib.sha256(content).hexdigest(), bytes=len(content)))
        print(f"Prepared image {number:02}: RGB 1080x1920 ({len(content)} bytes)")
    (output_dir / "images-manifest.json").write_text(
        json.dumps({"packageName": manifest["packageName"], "language": manifest["language"],
                    "imageType": manifest["imageType"], "images": entries},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return entries


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    process(args.manifest, args.source_dir, args.output_dir)
