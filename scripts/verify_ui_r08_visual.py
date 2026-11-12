#!/usr/bin/env python3
"""Read-only UI-R08 screen/route provenance audit of real Android PNG and XML."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

PROFILES = ("phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp")
VARIANTS = ("dark-100", "light-100", "dark-130", "light-130", "dark-150", "light-150")
CORE = ("camera", "records", "project", "compare", "measurements", "video-home",
        "video-create", "settings", "account")
EXTRA_AT_100 = ("video-library", "video-photos", "video-quality", "project-settings",
                "camera-new-project", "onboarding-first-run")
LABELS = {
    "camera": ("프로젝트 선택",),
    "records": ("내 프로젝트",),
    "project": ("QA 데모",),
    "compare": ("전후 사진 비교",),
    "measurements": ("수치 기록",),
    "video-home": ("변화 영상 만들기",),
    "video-create": ("변화 영상 만들기",),
    "settings": ("설정",),
    "account": ("로그인하고 기록을 보호하세요.",),
    "video-library": ("영상 관리",),
    "camera-new-project": ("프로젝트 만들기",),
    "onboarding-first-run": ("시작하기", "나중에 보기")
}
PNG_MAGIC = bytes.fromhex("89504e470d0a1a0a")


def parse_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def visual_audit(root, c7_report, expected_head):
    reference = parse_json(c7_report)
    problems = []
    if reference.get("result") != "PASS" or reference.get("actualCells") != 24:
        problems.append("Independent Frame Journal visual audit has not passed all 24 cells")

    checked_screens = 0
    route_counts = Counter()
    merge_source_commits = set()
    head_commits = set()

    for profile in PROFILES:
        location = root / profile
        path = location / "capture-manifest.json"
        if not path.is_file():
            problems.append(f"{profile}: source capture-manifest.json missing")
            continue
        manifest = parse_json(path)
        merge_source_commits.add(manifest.get("sourceCommit"))
        head_commits.add(manifest.get("prHeadCommit"))
        if manifest.get("profile") != profile or manifest.get("failed") != 0 or manifest.get("fatalError"):
            problems.append(f"{profile}: original Android screenshot manifest failed")
        lookup = {(r.get("variant"), r.get("screen")): r for r in manifest.get("captures", [])}
        for variant in VARIANTS:
            screens = CORE + (EXTRA_AT_100 if variant.endswith("-100") else ())
            for screen in screens:
                key = (variant, screen)
                record = lookup.get(key)
                label = f"{profile}/{variant}/{screen}"
                if not record or record.get("status") != "captured":
                    problems.append(f"{label}: no real native capture")
                    continue
                png = location / variant / (screen + ".png")
                xml = location / variant / (screen + ".xml")
                if not png.is_file() or not xml.is_file():
                    problems.append(f"{label}: native PNG and XML missing")
                    continue
                raw = png.read_bytes()
                if len(raw) < 256 or raw[:8] != PNG_MAGIC:
                    problems.append(f"{label}: PNG integrity invalid")
                    continue
                width, height = struct.unpack(">II", raw[16:24])
                if width != record.get("width") or height != record.get("height"):
                    problems.append(f"{label}: pixel dimensions differ from manifest")
                if hashlib.sha256(raw).hexdigest() != record.get("sha256"):
                    problems.append(f"{label}: screenshot hash differs from original manifest")
                try:
                    ui_tree = ET.parse(xml)
                    texts = [
                        node.get(attr, "")
                        for node in ui_tree.iter("node")
                        for attr in ("text", "content-desc")
                    ]
                    for expected in LABELS.get(screen, ()):
                        if not any(expected in actual for actual in texts):
                            problems.append(f"{label}: expected app content missing: {expected}")
                except (OSError, ET.ParseError) as exc:
                    problems.append(f"{label}: native XML unreadable: {exc}")
                checked_screens += 1
                route_counts[screen] += 1

    if head_commits != {expected_head}:
        problems.append("The 4 screen widths do not all belong to the expected PR HEAD")
    if len(merge_source_commits) != 1:
        problems.append("Screenshots came from more than one GitHub Actions source commit")
    required_count = len(PROFILES) * (
        len(VARIANTS) * len(CORE) + 2 * len(EXTRA_AT_100)
    )
    if checked_screens != required_count:
        problems.append(f"Required {required_count} original screen captures, checked {checked_screens}")

    return {
        "stage": "UI-R08 integrated screen and state provenance",
        "result": "PASS" if not problems else "FAIL",
        "sourcePrHead": expected_head,
        "sourceMergeCommits": sorted(str(x) for x in merge_source_commits),
        "profiles": list(PROFILES),
        "variants": list(VARIANTS),
        "expectedPrimaryAndExtraCaptures": required_count,
        "verifiedCaptures": checked_screens,
        "perRoute": dict(sorted(route_counts.items())),
        "issues": problems,
        "manualReview": [
            "Full visual equivalence with Google Drive art boards",
            "Scroll and text clipping at 150% in each real PNG",
            "Physical ARM64 camera and photo reference quality",
            "Real Android video playback and audio output",
            "TalkBack spoken order and real billing/backup",
            "Signed Google Play closed test release"
        ],
        "privacy": "Disposable offline synthetic numbered-card fixtures; no real body measurements"
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        if len(args.head) != 40 or any(ch not in "0123456789abcdef" for ch in args.head):
            raise ValueError("Missing source PR HEAD")
        result = visual_audit(args.root, args.report, args.head)
    except Exception as exc:
        result = {"stage": "UI-R08", "result": "FAIL", "issues": [str(exc)]}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"UI-R08 visual: {result['result']}; {result.get('verifiedCaptures', 0)} verified screens")
    for issue in result.get("issues", [])[:20]:
        print(" - " + issue)
    if result["result"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
