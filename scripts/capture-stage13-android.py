#!/usr/bin/env python3
"""Stage 13: reproducible Android page-by-page screenshots using offline synthetic fixtures.

This is an emulator-only capture workflow. It never loads user photos, signs in,
purchases a product, writes a cloud record, or changes a production release.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
from html import escape
import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys

BASE = Path(__file__).resolve().with_name("capture-android-qa.py")
SPEC = importlib.util.spec_from_file_location("travel_frame_android_qa", BASE)
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)

ALL_PROFILES = {name: (size, dpi) for name, size, dpi in qa.DESIGN_PROFILES}
ALL_VARIANTS = {name: (theme, font, scale) for name, theme, font, scale in qa.DESIGN_VARIANTS}

P = qa.PROJECT
F = qa.PHOTO
CASES = [
    ("camera", "촬영", "camera", ["프로젝트 선택", "사진 촬영"], None),
    ("records", "기록·프로젝트 목록", "studio", ["QA 데모", "내 프로젝트"], None),
    ("project", "프로젝트 상세·기록", f"project/{P}", ["QA 데모", "프로젝트 설정 열기"], None),
    ("project-metrics", "프로젝트 상세·수치 탭", f"project/{P}", ["QA 데모", "수치 기록", "전체 수치 기록 보기"], (["QA 데모"], "수치")),
    ("project-stats", "프로젝트 상세·통계 탭", f"project/{P}", ["QA 데모", "기록 달성률", "촬영 알림"], (["QA 데모"], "통계")),
    ("project-settings", "프로젝트 설정 시트", f"project/{P}", ["프로젝트 설정", "변경 저장", "이름"], (["프로젝트 설정 열기"], "프로젝트 설정 열기")),
    ("project-reminder", "촬영 알림 시트", f"project/{P}", ["촬영 알림 설정 닫기", "촬영 알림", "요일"], qa.open_project_reminder),
    ("photo", "사진 상세", f"photo/{F}", ["기록 상세"], None),
    ("photo-measurement", "사진별 수치 입력", f"photo/{F}?measurement=1", ["몸무게", "체지방률", "저장"], None),
    ("edit-login-required", "편집 로그인 안내", f"edit?photoId={F}", ["로그인이 필요합니다", "사진 편집은 무료 로그인부터"], None),
    ("compare", "전후 사진 비교", f"project/{P}/compare", ["전후 사진 비교", "첫 사진", "마지막 사진"], None),
    ("measurements", "전체 수치 기록", f"project/{P}/measurements", ["수치 기록", "QA 데모"], None),
    ("measurement-create", "수치 추가 시트", f"project/{P}/measurements?add=1", ["몸무게", "저장"], None),
    ("video-home", "영상 홈", "trip-clip", ["프로젝트로 변화 영상을"], None),
    ("video-create", "영상 만들기", "video-create", ["변화 영상 만들기", "QA 데모"], None),
    ("video-photos", "영상 사진 선택", "video-create", ["사진 선택", "전체 선택"], (["변화 영상 만들기"], "사진 수", "summary")),
    ("video-interval", "영상 간격 옵션", "video-create", ["사진 간격", "적용"], (["변화 영상 만들기"], "사진 간격", "summary")),
    ("video-quality", "영상 화질 옵션", "video-create", ["영상 화질", "적용"], (["변화 영상 만들기"], "화질", "summary")),
    ("video-ratio", "영상 비율 옵션", "video-create", ["화면 비율", "적용"], (["변화 영상 만들기"], "화면 비율", "summary")),
    ("video-overlay", "영상 오버레이 옵션", "video-create", ["텍스트 오버레이", "적용"], (["변화 영상 만들기"], "텍스트", "summary")),
    ("video-library", "영상 보관함", "video-library", ["영상 관리", "저장한 영상"], None),
    ("settings", "설정", "settings", ["설정", "기준 사진 표시"], None),
    ("settings-reference", "기준 사진 설정 시트", "settings", ["기준 사진 표시", "닫기"], (["기준 사진 표시"], "기준 사진 표시", "summary")),
    ("legacy-studio", "레거시 스튜디오", "legacy-studio", ["사진과 영상을 관리하세요."], None),
    ("legacy-advanced-settings", "고급 설정", "advanced-settings", ["기본값 설정"], None),
    ("account", "계정", "account", ["로그인하고 기록을 보호하세요."], None),
    ("capture-preview", "촬영 후 미리보기", f"capture-preview?id={F}", ["촬영 미리보기", "다시 촬영"], None),
]
CORE = {
    "camera", "records", "project", "project-metrics", "project-stats", "compare",
    "measurements", "video-home", "video-create", "video-library",
    "settings", "account", "project-settings", "video-photos", "video-quality",
}
LARGE_TEXT = {
    "camera", "records", "project", "project-metrics", "project-stats", "compare",
    "video-home", "video-create", "settings", "account", "project-settings", "video-photos",
}
ADDITIONAL = [
    ("empty-projects", "기록 빈 상태", "studio", ["내 프로젝트"], None),
    ("new-project", "새 프로젝트 생성", "studio", ["프로젝트 이름", "목표 기록 수"], (["내 프로젝트"], "새 프로젝트 만들기")),
    ("onboarding-welcome", "온보딩 첫 화면", "settings", ["바디 프레임에 오신 것을 환영합니다.", "시작하기"], qa.onboarding_welcome),
    ("onboarding-next", "온보딩 다음 화면", "settings", ["프로젝트로 기록을 나눕니다", "다음"], qa.onboarding_scrolled),
]


def rgb_preview_is_reviewable(pixels):
    """Reject a solid black/monochrome emulator frame even if UI hierarchy is valid."""
    if len(pixels) != 32 * 32 * 3:
        return False
    return max(pixels) - min(pixels) >= 18


def verified_capture(device, directory, name, route, expected, action=None):
    """Keep failed screenshots and never claim that a blank PNG verifies the UI."""
    record = qa.capture(device, directory, name, route, expected, action)
    if record.get("status") != "captured":
        return record
    screenshot = directory / f"{name}.png"
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(screenshot),
             "-vf", "scale=32:32,format=rgb24", "-frames:v", "1",
             "-f", "rawvideo", "pipe:1"],
            capture_output=True, check=True, timeout=20
        )
        if not rgb_preview_is_reviewable(result.stdout):
            raise ValueError("screen pixels are blank or uniform")
    except Exception as error:
        failed_screenshot = directory / f"{name}.failure.png"
        screenshot.replace(failed_screenshot)
        record.update(
            status="failed",
            error=f"Unusable Android screenshot: {error}. Check emulator GPU/target; UI text alone is not visual proof.",
            pixelEvidenceValid=False,
        )
    else:
        record["pixelEvidenceValid"] = True
    return record

def write_report(output, manifest):
    records = manifest["captures"]
    rows = []
    for r in records:
        variant, name = r["variant"], r["screen"]
        png = f"{variant}/{name}.png" if r["status"] == "captured" else f"{variant}/{name}.failure.png"
        src = output / png
        rows.append({
            "profile": manifest["profile"], "variant": variant, "screen": name,
            "page_label": r["label"], "route": r["route"], "status": r["status"],
            "image": png if src.exists() else "", "xml": f"{variant}/{name}.xml",
            "width": r.get("width", ""), "height": r.get("height", ""),
            "error": r.get("error", ""),
        })
    with (output / "screen-index.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]) if rows else [])
        writer.writeheader()
        writer.writerows(rows)
    cards = []
    for r in rows:
        img = f'<a href="{escape(r["image"])}"><img loading="lazy" src="{escape(r["image"])}" alt="{escape(r["page_label"])}"></a>' if r["image"] else "<p>캡처 없음</p>"
        error = f'<p class="error">{escape(r["error"][:260])}</p>' if r["error"] else ""
        cards.append(f'<article><h2>{escape(r["page_label"])}</h2><p>{escape(r["variant"])} · {escape(r["screen"])} · {escape(r["status"])}</p>{img}{error}</article>')
    html = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TravelFrame Stage 13 Android Screens</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{background:#0b0b0c;color:#f5f5f5;margin:24px;font:14px/1.5 system-ui,sans-serif}
header{max-width:900px;margin:0 auto 24px}h1{font-size:24px}h2{font-size:14px}p{color:#aaa}a{color:#ddd}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}
article{background:#18181a;border:1px solid #38383a;padding:12px;min-width:0}img{display:block;width:100%;height:auto;max-height:460px;object-fit:contain}
.error{color:#fb8484;overflow-wrap:anywhere}small{color:#aaa}</style></head><body>"""
    html += f'<header><h1>TravelFrame Stage 13 · {escape(manifest["profile"])}</h1><p>실제 Android 에뮬레이터에서 캡처한 PNG. 사용자 사진이 아닌 1·2·3 합성 이미지입니다.</p><p>APK SHA-256: <small>{manifest["apkSha256"]}</small></p><p>실제 인물 사진, TalkBack 음성 순서, 결제·백업은 이 자료로 검증하지 않습니다.</p></header>'
    html += "<main>" + "".join(cards) + "</main></body></html>"
    (output / "gallery.html").write_text(html, encoding="utf-8")
    (output / "capture-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=list(ALL_PROFILES), required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    output = args.output / args.profile
    output.mkdir(parents=True, exist_ok=True)
    size, density = ALL_PROFILES[args.profile]
    manifest = {
        "profile": args.profile,
        "screenWidthDp": round(int(size.split("x")[0]) * 160 / density),
        "pixelSize": size,
        "densityDpi": density,
        "sourceCommit": os.environ.get("GITHUB_SHA", "local"),
        "apkSha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "syntheticData": "Local-only offline sample; cards 1/2/3; no production login, purchase, cloud or private media",
        "unverified": ["Pixel-identical to Drive reference", "Real body photos", "TalkBack speech order", "Live Play Billing", "Video render equivalence"],
        "captures": [],
    }
    device = qa.Device()
    try:
        if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
            raise RuntimeError("Stage 13 capture is emulator-only: never seed a physical device")
        device.run("install", "-r", "-g", args.apk.resolve())
        manifest["hierarchyBackend"] = qa.prepare_native_hierarchy(device, args.output)
        device.shell("svc", "wifi", "disable")
        device.shell("svc", "data", "disable")
        device.shell("input", "keyevent", "KEYCODE_WAKEUP")
        device.shell("wm", "dismiss-keyguard")
        device.shell("am", "force-stop", qa.PACKAGE)
        device.shell("wm", "size", size)
        device.shell("wm", "density", density)
        manifest["displayEvidence"] = qa.wait_for_visual_profile(device, size, density)
        for variant in ("dark-100", "light-130", "dark-150"):
            theme, font, scale = ALL_VARIANTS[variant]
            directory = output / variant
            directory.mkdir(exist_ok=True)
            device.shell("settings", "put", "system", "font_scale", scale)
            device.seed(True, font, theme_mode=theme)
            if variant == "dark-100":
                cases = CASES
            elif variant == "light-130":
                cases = [case for case in CASES if case[0] in CORE]
            else:
                cases = [case for case in CASES if case[0] in LARGE_TEXT]
            for name, label, route, expected, action in cases:
                record = verified_capture(device, directory, name, route, expected, action)
                record.update(profile=args.profile, variant=variant, label=label)
                manifest["captures"].append(record)
                (directory / f"{name}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
                if "isn't responding" in record.get("error", ""):
                    raise RuntimeError("Android emulator System UI is not responding; review failure screenshot before retry")
                if record.get("pixelEvidenceValid") is False:
                    raise RuntimeError("Aborting because the Android emulator produced a blank screenshot; see the failed PNG.")
            if variant == "dark-100":
                device.seed(False, font, theme_mode=theme)
                for name, label, route, expected, action in ADDITIONAL[:2]:
                    record = verified_capture(device, directory, name, route, expected, action)
                    record.update(profile=args.profile, variant=variant, label=label)
                    manifest["captures"].append(record)
                    (directory / f"{name}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
                device.seed(True, font, theme_mode=theme)
                for name, label, route, expected, action in ADDITIONAL[2:]:
                    record = verified_capture(device, directory, name, route, expected, action)
                    record.update(profile=args.profile, variant=variant, label=label)
                    manifest["captures"].append(record)
                    (directory / f"{name}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as error:
        manifest["fatalError"] = str(error)
    finally:
        manifest["passed"] = sum(r.get("status") == "captured" for r in manifest["captures"])
        manifest["failed"] = sum(r.get("status") != "captured" for r in manifest["captures"])
        try:
            (output / "logcat.txt").write_text(device.run("logcat", "-d", check=False), encoding="utf-8")
            device.shell("am", "force-stop", qa.PACKAGE, check=False)
            device.shell("wm", "size", "reset", check=False)
            device.shell("wm", "density", "reset", check=False)
            device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
        except Exception as error:
            manifest.setdefault("cleanupError", str(error))
        write_report(output, manifest)
    print(f"{args.profile}: {manifest['passed']} captured; {manifest['failed']} failed", flush=True)
    if manifest.get("fatalError") or manifest["failed"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
