#!/usr/bin/env python3
"""Verify genuine Android screenshot matrix coverage, not design-guide pixel equivalence."""
import argparse
from collections import Counter
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET


def inspect(root):
    file = root / "capture-manifest.json"
    if not file.exists():
        return ["missing capture-manifest.json"], [], {}
    manifest = json.loads(file.read_text(encoding="utf-8"))
    matrix = manifest.get("visualDesignMatrix")
    if manifest.get("scenario") != "visual" or not isinstance(matrix, dict):
        return ["not a Stage 6 visual capture manifest"], [], manifest

    profiles = matrix.get("profiles", [])
    variants = matrix.get("variants", [])
    screens = matrix.get("screens", [])
    captures = manifest.get("captures", [])
    problems = []
    observations = []

    if len(profiles) != 4 or sorted(p["widthDp"] for p in profiles) != [360, 412, 600, 750]:
        problems.append("expected exact 360/412/600/750dp profiles")
    if [(v.get("theme"), v.get("systemFontScale")) for v in variants] != [
        ("dark", 1.0), ("light", 1.3), ("dark", 1.5)
    ]:
        problems.append("expected dark100/light130/dark150 variants")
    expected_keys = {
        (profile["name"], variant["name"], screen)
        for profile in profiles for variant in variants for screen in screens
    }
    expected_keys.update((p["name"], "dark-100", "empty-projects") for p in profiles)
    expected_keys.update((p["name"], "dark-150", "onboarding-large-font") for p in profiles)
    seen = Counter((item.get("profile"), item.get("variant"), item.get("screen")) for item in captures)
    for key in sorted(expected_keys):
        if seen[key] != 1:
            problems.append(f"expected one actual capture for {key}, got {seen[key]}")
    for key in seen:
        if key not in expected_keys:
            problems.append(f"unexpected scenario {key}")

    profile_sizes = {p["name"]: tuple(map(int, p["size"].split("x"))) for p in profiles}
    for capture in captures:
        profile, variant, screen = capture.get("profile"), capture.get("variant"), capture.get("screen")
        relative = Path(str(profile)) / str(variant)
        png = root / relative / (str(screen) + ".png")
        xml = root / relative / (str(screen) + ".xml")
        if capture.get("status") != "captured":
            problems.append(f"{profile}/{variant}/{screen}: {capture.get('error','not captured')}")
            observations.append((profile, variant, screen, "FAIL"))
            continue
        if not png.is_file() or not xml.is_file():
            problems.append(f"{profile}/{variant}/{screen}: missing PNG or Android hierarchy")
            observations.append((profile, variant, screen, "FAIL"))
            continue
        header = png.read_bytes()[:24]
        if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
            problems.append(f"{profile}/{variant}/{screen}: invalid PNG signature/IHDR")
            continue
        actual_size = struct.unpack(">II", header[16:24])
        if actual_size != profile_sizes.get(profile):
            problems.append(f"{profile}/{variant}/{screen}: screenshot dimensions {actual_size} differ from requested profile")
        if actual_size != (capture.get("width"), capture.get("height")):
            problems.append(f"{profile}/{variant}/{screen}: PNG dimensions differ from capture metadata")
        try:
            xml_root = ET.fromstring(xml.read_text(encoding="utf-8"))
            if xml_root.tag != "hierarchy":
                problems.append(f"{profile}/{variant}/{screen}: non-Android hierarchy XML")
        except (ET.ParseError, OSError) as error:
            problems.append(f"{profile}/{variant}/{screen}: invalid hierarchy XML: {error}")
        if not capture.get("sha256") or not capture.get("foreground"):
            problems.append(f"{profile}/{variant}/{screen}: missing native screenshot hash or foreground proof")
        observations.append((profile, variant, screen, "CAPTURED"))

    if manifest.get("failed", 0):
        problems.append(f"original capture runner reported {manifest['failed']} failed scenarios")
    if manifest.get("fatalError"):
        problems.append(f"original capture runner fatal error: {manifest['fatalError']}")
    return problems, observations, manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.output
    root.mkdir(parents=True, exist_ok=True)
    problems, observations, manifest = inspect(root)
    report = [
        "# Stage 6 visual capture matrix",
        "",
        f"Captured: {sum(row[3]=='CAPTURED' for row in observations)}, failed checks: {len(problems)}",
        "",
        "This report verifies original Android screenshots, screenshot dimensions, app foreground,",
        "expected screen text and native hierarchy. It does NOT certify pixel-level fidelity",
        "to the design PNG, TalkBack narration, real-user rendering, billing or backups.",
        "",
        "| Device profile | Visual variant | Screen | Evidence |",
        "| --- | --- | --- | --- |",
        *[f"| {p} | {v} | {s} | {state} |" for p,v,s,state in observations],
        "",
        "## Errors",
        *([f"- {x}" for x in problems] or ["- None in capture integrity checks"]),
        "",
        "## Remaining manual review",
        "- Compare captures against original Drive design guides using real Android renders.",
        "- Check dark/light text contrast, clipping, navigation, all modals and TalkBack.",
        "- Validate real user photos, videos, sign-in, purchase and cloud backup separately.",
    ]
    (root / "stage6-visual-report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"Stage 6 screenshot integrity: {len(observations)} actual captures / {len(problems)} problems")
    if problems:
        raise SystemExit("Stage 6 capture matrix incomplete; review stage6-visual-report.md")


if __name__ == "__main__":
    main()
