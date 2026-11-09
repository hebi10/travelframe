#!/usr/bin/env python3
"""Evidence-based Frame Journal C7 Android light/dark integration QA.

Checks real Stage13 Android emulator PNG/XML/JSON artifacts, not design mockups.
Never modifies devices, user data, Google Play, or Firebase.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

PROFILES = ("phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp")
VARIANTS = ("dark-100", "light-100", "dark-130", "light-130", "dark-150", "light-150")
PRIMARY = (
    "camera", "records", "project", "compare", "measurements",
    "video-home", "video-create", "settings", "account"
)
FULL_EXTRA = (
    "camera-project-picker", "camera-new-project", "camera-settings", "camera-settings-storage",
    "camera-guide-settings", "camera-reference-adjust", "camera-color-panel", "camera-zoom-panel",
    "camera-light-panel", "project-metrics", "project-stats", "project-settings", "project-reminder",
    "photo", "photo-measurement", "edit-login-required", "measurement-create",
    "video-photos", "video-interval", "video-quality", "video-ratio", "video-overlay", "video-library",
    "settings-reference", "legacy-studio", "legacy-advanced-settings", "capture-preview",
    "empty-projects", "new-project", "onboarding-first-run", "onboarding-welcome", "onboarding-next"
)
ACTION_REQUIREMENTS = {
    "camera-color-panel": ("색감 조절값 초기화", "선택한 색감 슬롯에 현재 설정 저장"),
    "onboarding-first-run": ("시작하기", "나중에 보기"),
    "onboarding-first-run-light-large": ("시작하기", "나중에 보기"),
    "camera-permission-denied": ("기록으로 이동",)
}

def native_action_bounds(xml, label, width, height):
    """Require a visible, enabled clickable native action within screen and safe margins."""
    root = ET.fromstring(xml)
    parents = {child: parent for parent in root.iter() for child in parent}
    for node in root.iter("node"):
        if label not in (node.get("text", ""), node.get("content-desc", "")):
            continue
        candidate = node
        while candidate.tag == "node" and candidate.get("clickable") != "true":
            candidate = parents.get(candidate, root)
        if candidate.tag != "node" or candidate.get("clickable") != "true":
            continue
        if candidate.get("enabled") != "true":
            continue
        attr = candidate.get("bounds", "")
        import re
        match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", attr)
        if not match:
            continue
        x1, y1, x2, y2 = map(int, match.groups())
        if 0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height - 24:
            return [x1, y1, x2, y2]
    raise ValueError(f"Enabled on-screen control not found: {label}")

def project_create_button_text_height_dp(xml, density_dpi, label="프로젝트 만들기"):
    """Reject the C7 regression where a project button wraps at 150% font size."""
    import re
    if not isinstance(density_dpi, (int, float)) or density_dpi <= 0:
        raise ValueError("Missing Android display density for create button")
    root = ET.fromstring(xml)
    matches = [
        node for node in root.iter("node")
        if node.get("class") == "android.widget.TextView"
        and node.get("text") == label
    ]
    if len(matches) != 1:
        raise ValueError(f"Expected one visible {label} text node, got {len(matches)}")
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", matches[0].get("bounds", ""))
    if not match:
        raise ValueError(f"{label} text has no native bounds")
    _, top, _, bottom = map(int, match.groups())
    height_dp = (bottom - top) * 160 / density_dpi
    if height_dp > 44:
        raise ValueError(f"{label} label still wraps at enlarged font: {height_dp:.1f}dp high")
    return round(height_dp, 1)


def settings_surface_brightness(image_path):
    """Measure actual pixel colour in the margin of the Settings screen, not its label."""
    result = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(image_path),
            "-vf", "crop=24:24:4:ih*0.3,scale=1:1,format=rgb24",
            "-frames:v", "1", "-f", "rawvideo", "pipe:1",
        ],
        capture_output=True, check=True, timeout=20
    )
    if len(result.stdout) != 3:
        raise ValueError("Unable to decode Settings background RGB pixel")
    return round(sum(result.stdout) / 3, 1)

def analyze_profile(directory, problems):
    manifest_path = directory / "capture-manifest.json"
    if not manifest_path.is_file():
        problems.append(f"{directory.name}: missing capture-manifest.json")
        return None
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        problems.append(f"{directory.name}: invalid capture manifest: {error}")
        return None

    profile = data.get("profile")
    captures = data.get("captures", [])
    if profile not in PROFILES or profile != directory.name:
        problems.append(f"{directory.name}: wrong profile identity: {profile}")
    if data.get("failed", 0) != 0 or data.get("fatalError"):
        problems.append(f"{profile}: original Android capture reported failures")
    source = data.get("sourceCommit")
    if not isinstance(source, str) or len(source) != 40 or any(c not in "0123456789abcdef" for c in source):
        problems.append(f"{profile}: capture source commit was not recorded")
    head = data.get("prHeadCommit")
    if not isinstance(head, str) or len(head) != 40 or any(c not in "0123456789abcdef" for c in head):
        problems.append(f"{profile}: C7 PR HEAD commit was not recorded")
    if data.get("captureMatrix") != list(VARIANTS):
        problems.append(f"{profile}: screenshot matrix does not match six C7 variants")
    by_key = Counter((r.get("variant"), r.get("screen")) for r in captures)
    by_variant = Counter(r.get("variant") for r in captures)
    if len(captures) != sum(by_variant.values()):
        problems.append(f"{profile}: malformed capture rows")
    for variant in VARIANTS:
        needed = set(PRIMARY)
        if variant.endswith("-100"):
            needed.update(FULL_EXTRA)
        if variant == "light-150":
            needed.add("onboarding-first-run-light-large")
            needed.add("camera-permission-denied")
        if variant == "dark-100":
            needed.add("camera-permission-denied")
        for screen in sorted(needed):
            if by_key[(variant, screen)] != 1:
                problems.append(f"{profile}/{variant}/{screen}: expected exactly one capture, got {by_key[(variant, screen)]}")
    if data.get("passed") != len(captures) or data.get("failed") != 0:
        problems.append(f"{profile}: screenshot manifest totals are inconsistent")

    contrast = {}
    for r in captures:
        variant, screen = r.get("variant"), r.get("screen")
        key = f"{profile}/{variant}/{screen}"
        if variant not in VARIANTS or by_key[(variant, screen)] != 1:
            problems.append(f"{key}: unexpected or duplicate capture")
            continue
        if r.get("status") != "captured" or r.get("pixelEvidenceValid") is not True:
            problems.append(f"{key}: screenshot capture/pixel validity failed: {r.get('error', '')}")
            continue
        png = directory / variant / f"{screen}.png"
        xml = directory / variant / f"{screen}.xml"
        if not png.is_file() or not xml.is_file():
            problems.append(f"{key}: PNG or native UI XML is missing")
            continue
        blob = png.read_bytes()
        if blob[:8] != b"\x89PNG\r\n\x1a\n" or len(blob) < 100:
            problems.append(f"{key}: invalid native PNG")
            continue
        width, height = struct.unpack(">II", blob[16:24])
        if (width, height) != (r.get("width"), r.get("height")):
            problems.append(f"{key}: PNG dimensions disagree with capture JSON")
        if hashlib.sha256(blob).hexdigest() != r.get("sha256"):
            problems.append(f"{key}: PNG SHA-256 differs from evidence JSON")
        try:
            hierarchy = xml.read_text(encoding="utf-8")
            for label in ACTION_REQUIREMENTS.get(screen, ()):
                native_action_bounds(hierarchy, label, width, height)
        except (ValueError, ET.ParseError) as error:
            problems.append(f"{key}: action bounds/XML failed: {error}")
        if variant.endswith("-150") and screen in ("camera-new-project", "records"):
            label = "프로젝트 만들기" if screen == "camera-new-project" else "새 프로젝트"
            try:
                project_create_button_text_height_dp(hierarchy, data.get("densityDpi"), label)
            except (ValueError, ET.ParseError) as error:
                problems.append(f"{key}: project CTA wrap verification failed: {error}")
        if screen == "settings":
            try:
                value = settings_surface_brightness(png)
                contrast[variant] = value
                if variant.startswith("light-") and value < 165:
                    problems.append(f"{key}: expected light Settings surface, measured {value}")
                if variant.startswith("dark-") and value > 95:
                    problems.append(f"{key}: expected dark Settings surface, measured {value}")
            except (subprocess.SubprocessError, ValueError) as error:
                problems.append(f"{key}: settings pixel inspection failed: {error}")
    return {
        "profile": profile,
        "captures": len(captures),
        "variantCounts": dict(sorted(by_variant.items())),
        "themePixels": contrast,
        "sourceCommit": source,
        "prHeadCommit": head,
        "syntheticData": data.get("syntheticData"),
    }

def build_report(root, output):
    problems = []
    results = []
    for profile in PROFILES:
        candidate = root / profile
        result = analyze_profile(candidate, problems)
        if result is not None:
            results.append(result)

    sources = {r["sourceCommit"] for r in results}
    heads = {r["prHeadCommit"] for r in results}
    if len(sources) != 1 or len(heads) != 1:
        problems.append("C7 Android screenshot matrix must all originate from the same source and PR HEAD")
    cells = {(r["profile"], variant) for r in results for variant in r["variantCounts"] if variant in VARIANTS}
    expected_cells = {(profile, variant) for profile in PROFILES for variant in VARIANTS}
    if cells != expected_cells:
        problems.append(f"Expected 24 profile/theme/font cells; observed {len(cells)}")
    if not results:
        problems.append("No complete C7 emulator capture manifests")
    report = {
        "stage": "TravelFrame C7 Frame Journal integrated visual QA",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "result": "PASS" if not problems else "FAIL",
        "requiredCells": 24,
        "actualCells": len(cells),
        "requiredPrimaryScreens": list(PRIMARY),
        "captures": sum(r["captures"] for r in results),
        "profiles": results,
        "problems": problems,
        "limitations": [
            "Android API35 x86_64 emulator with offline synthetic frames; not ARM64 real-camera optical verification",
            "UI XML and sampled Settings pixels do not prove every element is visually unclipped: inspect PNG gallery",
            "No live Google Play subscriptions, Firebase writes, private user media, TalkBack speech order, or MP4 hardware export",
            "Captures belong to the GitHub PR test merge SHA; prHeadCommit separately records the actual PR HEAD",
        ],
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "c7-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = [
        "# TravelFrame C7 — Android 전체 라이트·다크 통합 QA",
        "",
        f"검증 결과: **{report['result']}**",
        f"실제 Android PNG: {report['captures']}건 | 프로필·테마·글꼴 조합: {len(cells)}/24",
        "",
        "| 디스플레이 폭 | dark 100% | light 100% | dark 130% | light 130% | dark 150% | light 150% |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    index = {r["profile"]: r for r in results}
    for profile in PROFILES:
        counts = index.get(profile, {}).get("variantCounts", {})
        lines.append("| " + profile + " | " + " | ".join(str(counts.get(v, 0)) for v in VARIANTS) + " |")
    lines.extend(["", "## 원본 검증", "- 페이지별 실제 PNG 해시·치수, 계층 XML, UI 버튼 위치, 설정 화면 명도 확인", "- 최초 온보딩·권한 거부·색감 고정 버튼이 사용 영역 내에 있는지 확인", "- 최초 100% 라이트·다크에서 추가 화면까지 캡처", "", "## 문제 목록"])
    lines.extend([f"- {problem}" for problem in problems] if problems else ["- 자동 검증에서 발견된 문제 없음"])
    lines.extend(["", "## 자동화로 검증할 수 없는 부분"])
    lines.extend([f"- {item}" for item in report["limitations"]])
    (output / "c7-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = build_report(args.root, args.output)
    print(f"C7 {report['result']}: {report['actualCells']}/24 configurations, {report['captures']} screenshots; {len(report['problems'])} problems")
    for problem in report["problems"][:25]:
        print(" - " + problem)
    return 0 if report["result"] == "PASS" else 1

if __name__ == "__main__":
    sys.exit(main())
