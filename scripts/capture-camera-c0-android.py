#!/usr/bin/env python3
"""C0 Camera Workspace Android Before captures; disposable emulator and synthetic guest only.

The APK is built from the unchanged TravelFrame application source. This helper
never uses personal photos, Play accounts, cloud credentials or release uploads.
Every requested state is captured as genuine Android PNG + accessibility XML,
with explicit failure records if UI navigation or pixel verification fails.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "scripts" / "capture-stage13-android.py"
SPEC = importlib.util.spec_from_file_location("travel_frame_c0_base", BASE)
stage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage)
qa = stage.qa

PROFILES = dict(qa.DESIGN_PROFILES)
VARIANTS = dict((name, (theme, font, scale)) for name, theme, font, scale in qa.DESIGN_VARIANTS)

def open_camera_settings(device):
    device.ready(["사진 촬영"])
    device.tap("촬영 설정 열기")
    device.ready(["촬영 도구"])
    return {"entry": "촬영 설정 열기"}

def open_project_picker(device):
    device.ready(["사진 촬영"])
    device.tap("프로젝트 선택")
    device.ready(["프로젝트 선택"])
    return {"entry": "프로젝트 선택"}

def open_create_project(device):
    evidence = open_project_picker(device)
    device.tap("+ 새 프로젝트")
    device.ready(["프로젝트 이름", "목표 기록 수"])
    return dict(evidence, next="+ 새 프로젝트")

def open_guide_settings(device):
    open_camera_settings(device)
    device.tap("라인 가이드 설정 열기")
    device.ready(["가이드 설정", "가이드라인"])
    return {"entry": "촬영 설정 → 라인 가이드"}

def open_guide_position(device):
    open_guide_settings(device)
    device.tap("위치·모양 조절")
    device.ready(["완료", "초기화"])
    return {"entry": "가이드 설정 → 위치·모양 조절"}

def open_grid_position(device):
    open_guide_settings(device)
    device.tap("3분할")
    device.tap("선 위치 조절")
    device.ready(["완료", "초기화"])
    return {"entry": "가이드 설정 → 3분할 → 선 위치 조절"}

def open_camera_tool(label):
    def action(device):
        open_camera_settings(device)
        device.tap(label)
        return {"entry": "촬영 설정 → " + label}
    return action

def open_reference_adjust(device):
    device.ready(["사진 촬영"])
    for _ in range(10):
        labels = qa.ui_strings(device.dump())
        possible = [value for value in labels if re.fullmatch(r"기준 사진 투명도 \d+퍼센트", value)]
        if possible:
            device.tap(possible[0])
            device.ready(["사진 가이드", "확인"])
            return {"entry": possible[0], "syntheticReferenceOnly": True}
        if "가이드 이미지 다시 표시" in labels:
            device.tap("가이드 이미지 다시 표시")
            device.ready(["사진 가이드", "확인"])
            return {"entry": "가이드 이미지 다시 표시", "syntheticReferenceOnly": True}
        time.sleep(1)
    raise RuntimeError("Automatic synthetic project reference was not ready; no reference state was captured")

def scroll_until(device, markers):
    for number in range(7):
        strings = qa.ui_strings(device.dump())
        if all(any(marker in value for value in strings) for marker in markers):
            return {"scrollSteps": number, "visibleMarkers": markers}
        if not device.scroll_down():
            break
    raise RuntimeError("Expected scroll section was unreachable: " + ", ".join(markers))

def open_camera_settings_bottom(device):
    evidence = open_camera_settings(device)
    return dict(evidence, **scroll_until(device, ["저장 범위"]))

def open_guide_settings_bottom(device):
    evidence = open_guide_settings(device)
    return dict(evidence, **scroll_until(device, ["색상"]))

def open_color_bottom(device):
    evidence = open_camera_tool("색감 설정 열기")(device)
    device.ready(["색감", "저장 슬롯"])
    return dict(evidence, **scroll_until(device, ["설정 저장"]))

def open_new_project_keyboard(device):
    open_create_project(device)
    device.shell("settings", "put", "secure", "show_ime_with_hard_keyboard", "1")
    xml = device.dump()
    for node in ET.fromstring(xml).iter("node"):
        if node.get("class") != "android.widget.EditText":
            continue
        bounds = list(map(int, re.findall(r"\d+", node.get("bounds", ""))))
        if len(bounds) != 4:
            continue
        x1, y1, x2, y2 = bounds
        device.shell("input", "tap", (x1+x2)//2, (y1+y2)//2)
        time.sleep(2)
        im = device.shell("dumpsys", "input_method")
        if not re.search(r"(?:mInputShown|isInputViewShown|mIsInputViewShown)=true", im):
            raise RuntimeError("Android IME did not appear for the new-project name field")
        return {"entry": "새 프로젝트 → 프로젝트 이름", "keyboardShown": True}
    raise RuntimeError("New-project Android EditText is not visible")

def onboarding_second(device):
    device.ready(["바디 프레임에 오신 것을 환영합니다."])
    device.tap("시작하기")
    device.ready(["프로젝트로 기록을 나눕니다"])
    return {"entry": "첫 실행 → 시작하기"}

CASES = [
    ("camera", "기본 촬영 화면", ["프로젝트 선택", "사진 촬영"], None),
    ("project-picker", "프로젝트 선택 시트", ["프로젝트 선택", "프로젝트 관리"], open_project_picker),
    ("project-create", "새 프로젝트 시트(기록 있는 경우)", ["프로젝트 이름", "목표 기록 수"], open_create_project),
    ("camera-settings", "촬영 설정 상단", ["촬영 도구", "카메라 방향"], open_camera_settings),
    ("camera-settings-lower", "촬영 설정 저장·보조 영역", ["저장 범위"], open_camera_settings_bottom),
    ("guide-settings", "라인 가이드 설정 상단", ["가이드 설정", "가이드라인"], open_guide_settings),
    ("guide-settings-lower", "라인 가이드 색상·표시 설정", ["색상"], open_guide_settings_bottom),
    ("guide-position", "가이드 위치·모양 직접 조절", ["완료", "초기화"], open_guide_position),
    ("grid-position", "3분할 선 위치 조절", ["완료", "초기화"], open_grid_position),
    ("reference-adjust", "기준 사진 투명도·크기 조절", ["사진 가이드", "확인"], open_reference_adjust),
    ("color-panel", "색감 슬라이더·저장 슬롯", ["색감", "저장 슬롯"], open_camera_tool("색감 설정 열기")),
    ("color-panel-lower", "색감 조절 저장 영역", ["설정 저장"], open_color_bottom),
    ("zoom-panel", "줌 배율 프리셋", ["1x"], open_camera_tool("확대 설정 열기")),
    ("light-panel", "조명 켜기·끄기", ["끄기", "켜기"], open_camera_tool("라이트 설정 열기")),
]

ESSENTIAL = {"camera", "project-picker", "project-create", "camera-settings", "guide-settings", "reference-adjust", "color-panel", "zoom-panel", "light-panel"}
LARGE = {"camera", "project-picker", "project-create", "camera-settings", "guide-settings", "reference-adjust", "color-panel"}

def capture_case(device, folder, manifest, name, label, expected, action=None):
    record = stage.verified_capture(device, folder, name, "camera", expected, action)
    record.update(
        profile=manifest["profile"],
        variant=manifest["activeVariant"],
        label=label,
        sourceAppCommit=manifest["sourceAppCommit"],
    )
    (folder / (name + ".json")).write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest["captures"].append(record)
    if record.get("pixelEvidenceValid") is False:
        raise RuntimeError("Android screenshot pixels were blank; subsequent UI evidence cannot be trusted")
    if "isn't responding" in record.get("error", ""):
        raise RuntimeError("Android system launcher ANR was captured; stopping this profile")
    return record

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True, choices=sorted(PROFILES))
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    output = args.output / args.profile
    output.mkdir(parents=True, exist_ok=True)
    size, dpi = PROFILES[args.profile]
    app_commit = os.environ.get("C0_APP_BASE_SHA")
    if not app_commit or not re.fullmatch(r"[a-f0-9]{40}", app_commit):
        raise SystemExit("C0_APP_BASE_SHA must identify the reviewed main app baseline")
    checkout = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    manifest = {
        "captureStage": "C0-before", "profile": args.profile, "pixelSize": size,
        "densityDpi": dpi, "screenWidthDp": round(int(size.split("x")[0]) * 160 / dpi),
        "sourceAppCommit": app_commit, "qaCheckoutCommit": checkout,
        "apkSha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        "capturedAt": datetime.now(timezone.utc).isoformat(), "captures": [],
        "syntheticData": "Local-only guest photo markers 1/2/3; no personal images",
        "network": "Wi-Fi and mobile data disabled", "activeVariant": "",
        "limitations": [
            "No real subject photo or physical-camera optics",
            "No Play Console, billing, Firebase or Health Connect calls",
            "No TalkBack spoken-order or real ARM64 hardware validation",
            "No genuine device-album save permission failure or paid-plan state",
            "No claimed redesign Before/After similarity; raw Before captures only",
        ],
    }
    device = qa.Device()
    try:
        if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
            raise RuntimeError("C0 may run only on a disposable Android emulator")
        device.run("install", "-r", "-g", args.apk.resolve())
        manifest["hierarchyBackend"] = qa.prepare_native_hierarchy(device, args.output)
        device.shell("svc", "wifi", "disable")
        device.shell("svc", "data", "disable")
        device.shell("input", "keyevent", "KEYCODE_WAKEUP")
        device.shell("wm", "dismiss-keyguard")
        manifest["systemLauncherHealth"] = qa.recover_launcher_anr(device, output / "system-diagnostics")
        device.shell("am", "force-stop", qa.PACKAGE)
        device.shell("wm", "size", size)
        device.shell("wm", "density", dpi)
        manifest["displayEvidence"] = qa.wait_for_visual_profile(device, size, dpi)
        for variant in ("dark-100", "light-130", "dark-150", "light-150"):
            theme, font, scale = VARIANTS[variant]
            manifest["activeVariant"] = variant
            folder = output / variant
            folder.mkdir(parents=True, exist_ok=True)
            device.shell("settings", "put", "system", "font_scale", scale)
            device.seed(True, font, theme_mode=theme)
            if variant in ("dark-100", "light-130"):
                cases = CASES if args.profile.startswith("phone") else [item for item in CASES if item[0] in ESSENTIAL]
            else:
                cases = [item for item in CASES if item[0] in LARGE]
            for case in cases:
                capture_case(device, folder, manifest, *case)
            if variant == "dark-100":
                device.seed(False, font, theme_mode=theme)
                capture_case(device, folder, manifest, "empty-project-camera", "프로젝트 없는 촬영 화면", ["프로젝트를 먼저 만들어주세요.", "사진 촬영"])
                capture_case(device, folder, manifest, "empty-project-create", "프로젝트 없는 새 프로젝트 생성", ["프로젝트 이름", "목표 기록 수"], open_create_project)
                device.seed(True, font, theme_mode=theme, intro_seen=False)
                capture_case(device, folder, manifest, "onboarding-welcome", "최초 사용 환영", ["바디 프레임에 오신 것을 환영합니다.", "시작하기"])
                capture_case(device, folder, manifest, "onboarding-next", "최초 사용 두 번째 단계", ["프로젝트로 기록을 나눕니다"], onboarding_second)
                device.seed(True, font, theme_mode=theme)
                device.shell("pm", "revoke", qa.PACKAGE, "android.permission.CAMERA")
                try:
                    capture_case(device, folder, manifest, "camera-permission-denied", "카메라 권한 거부 화면", ["카메라 접근 권한이 필요합니다."])
                finally:
                    device.shell("pm", "grant", qa.PACKAGE, "android.permission.CAMERA", check=False)
            if variant == "light-150":
                device.seed(False, font, theme_mode=theme)
                capture_case(device, folder, manifest, "new-project-keyboard", "새 프로젝트 대형 글꼴·키보드", ["프로젝트 이름", "목표 기록 수"], open_new_project_keyboard)
    except Exception as error:
        manifest["fatalError"] = str(error)
    finally:
        manifest.pop("activeVariant", None)
        manifest["passed"] = sum(r.get("status") == "captured" for r in manifest["captures"])
        manifest["failed"] = len(manifest["captures"]) - manifest["passed"]
        manifest["planned"] = len(manifest["captures"])
        try:
            (output / "logcat.txt").write_text(device.run("logcat", "-d", check=False), encoding="utf-8")
            device.shell("am", "force-stop", qa.PACKAGE, check=False)
            device.shell("wm", "size", "reset", check=False)
            device.shell("wm", "density", "reset", check=False)
            device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
        except Exception as error:
            manifest["cleanupError"] = str(error)
        stage.write_report(output, manifest)
    print("C0 " + args.profile + ": " + str(manifest["passed"]) +
          " captured; " + str(manifest["failed"]) + " failed", flush=True)
    if manifest.get("fatalError") or manifest["failed"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
