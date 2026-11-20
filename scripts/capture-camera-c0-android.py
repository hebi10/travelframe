#!/usr/bin/env python3
"""C0 camera Before evidence: native emulator APK, local synthetic records only."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

SOURCE = Path(__file__).resolve().with_name("capture-stage13-android.py")
SPEC = importlib.util.spec_from_file_location("camera_c0_stage13", SOURCE)
stage13 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage13)
qa = stage13.qa

PROFILES = {name: value for name, value in qa.DESIGN_PROFILES}
VARIANTS = {
    "dark-100": ("dark", "medium", 1.0),
    "light-130": ("light", "large", 1.3),
}
CASES = [
    ("01-camera", "촬영 기본", "camera", ["프로젝트 선택", "사진 촬영"], None),
    ("02-project-picker", "프로젝트 선택", "camera", ["프로젝트 선택", "프로젝트 관리"],
     lambda d: d.open_control("프로젝트 선택", ["프로젝트 관리"])),
    ("03-new-project", "새 프로젝트", "camera", ["프로젝트 이름", "목표 기록 수", "프로젝트 만들기"],
     lambda d: (d.open_control("프로젝트 선택", ["프로젝트 관리"]), d.tap("+ 새 프로젝트"))),
    ("04-camera-settings", "촬영 설정", "camera", ["촬영 도구", "촬영 타이머", "저장 범위"],
     lambda d: d.open_control("촬영 설정 열기", ["촬영 도구", "촬영 타이머"])),
    ("05-guide-settings", "라인 가이드 설정", "camera", ["가이드 설정", "가이드라인", "선 두께"],
     lambda d: (d.open_control("촬영 설정 열기", ["촬영 도구"]), d.tap("라인 가이드 설정 열기"))),
    ("06-guide-position", "가이드 위치 편집", "camera", ["중앙", "초기화", "완료"],
     lambda d: (d.open_control("촬영 설정 열기", ["촬영 도구"]), d.tap("라인 가이드 설정 열기"),
                d.ready(["가이드라인"]), d.tap("위치·모양 조절"))),
    ("07-grid-control", "그리드 선 편집", "camera", ["중앙", "초기화", "완료"],
     lambda d: (d.open_control("촬영 설정 열기", ["촬영 도구"]), d.tap("라인 가이드 설정 열기"),
                d.ready(["가이드라인"]), d.tap("3분할"), d.tap("선 위치 조절"))),
    ("08-color-panel", "색감 조절", "camera", ["저장 슬롯", "노출", "설정 저장"],
     lambda d: (d.open_control("촬영 설정 열기", ["촬영 도구"]), d.tap("색감 설정 열기"))),
    ("09-zoom-panel", "줌 조절", "camera", ["사진 촬영", "1x"],
     lambda d: (d.open_control("촬영 설정 열기", ["촬영 도구"]), d.tap("확대 설정 열기"))),
    ("10-light-panel", "조명 조절", "camera", ["사진 촬영", "끄기", "켜기"],
     lambda d: (d.open_control("촬영 설정 열기", ["촬영 도구"]), d.tap("라이트 설정 열기"))),
]

def open_reference_overlay(device):
    device.ready(["프로젝트 선택", "사진 촬영"])
    from xml.etree import ElementTree as ET
    candidates = []
    for node in ET.fromstring(device.dump()).iter("node"):
        label = node.get("content-desc", "")
        if label.startswith("기준 사진 투명도 ") and label.endswith("퍼센트"):
            candidates.append(label)
    if len(set(candidates)) != 1:
        raise RuntimeError("A unique visible reference-opacity control is required")
    device.tap(candidates[0])

def open_first_run(device):
    device.ready(["바디 프레임에 오신 것을 환영합니다."])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--profile", choices=list(PROFILES), required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    base = args.output / args.profile
    base.mkdir(parents=True, exist_ok=True)
    size, density = PROFILES[args.profile]
    manifest = {
        "captureScope": "C0 Before camera; Android emulator; no product UI changes",
        "profile": args.profile,
        "sourceCommit": os.environ.get("GITHUB_SHA", "local"),
        "apkSha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "syntheticData": "Offline test project with grayscale synthetic photos; no real user records",
        "unverified": ["Real device camera optics", "Play Console state", "Real human images", "TalkBack speech order"],
        "captures": [],
    }
    device = qa.Device()
    cases = CASES + [("11-reference-adjust", "기준 사진 투명도 및 위치", "camera",
                      ["사진 가이드", "투명도", "확인"], open_reference_overlay)]
    fatal = None
    try:
        if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
            raise RuntimeError("Never capture or seed a physical device")
        device.run("install", "-r", "-g", args.apk.resolve())
        manifest["hierarchyBackend"] = qa.prepare_native_hierarchy(device, args.output)
        device.shell("svc", "wifi", "disable")
        device.shell("svc", "data", "disable")
        device.shell("input", "keyevent", "KEYCODE_WAKEUP")
        device.shell("wm", "dismiss-keyguard")
        device.shell("wm", "size", size)
        device.shell("wm", "density", density)
        manifest["displayEvidence"] = qa.wait_for_visual_profile(device, size, density)
        for variant, (theme, font, scale) in VARIANTS.items():
            directory = base / variant
            directory.mkdir(parents=True, exist_ok=True)
            device.shell("settings", "put", "system", "font_scale", str(scale))
            device.seed(True, font, theme_mode=theme)
            for name, label, route, expected, action in cases:
                result = stage13.verified_capture(device, directory, name, route, expected, action)
                result.update(variant=variant, label=label)
                manifest["captures"].append(result)
                (directory / (name + ".json")).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                if result.get("pixelEvidenceValid") is False:
                    raise RuntimeError("Blank pixel capture; subsequent screenshots are not valid evidence")
            device.seed(True, font, theme_mode=theme, intro_seen=False)
            result = stage13.verified_capture(device, directory, "12-onboarding-first-run", "camera",
                                              ["바디 프레임에 오신 것을 환영합니다.", "시작하기", "나중에 보기"],
                                              open_first_run)
            result.update(variant=variant, label="최초 실행 온보딩")
            manifest["captures"].append(result)
            device.seed(False, font, theme_mode=theme)
            result = stage13.verified_capture(device, directory, "13-empty-project", "camera",
                                              ["프로젝트 선택", "프로젝트를 먼저 만들어주세요."])
            result.update(variant=variant, label="프로젝트 없음")
            manifest["captures"].append(result)
    except Exception as exc:
        fatal = str(exc)
        manifest["fatalError"] = fatal
    finally:
        manifest["passed"] = sum(r.get("status") == "captured" for r in manifest["captures"])
        manifest["failed"] = sum(r.get("status") != "captured" for r in manifest["captures"])
        try:
            (base / "logcat.txt").write_text(device.run("logcat", "-d", check=False), encoding="utf-8")
            device.shell("am", "force-stop", qa.PACKAGE, check=False)
            device.shell("wm", "size", "reset", check=False)
            device.shell("wm", "density", "reset", check=False)
            device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
        except Exception as exc:
            manifest.setdefault("cleanupError", str(exc))
        stage13.write_report(base, manifest)
    print(f"C0 {args.profile}: {manifest['passed']} captured, {manifest['failed']} failed", flush=True)
    if fatal or manifest["failed"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
