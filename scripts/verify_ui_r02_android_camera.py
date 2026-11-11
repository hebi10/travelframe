#!/usr/bin/env python3
"""UI-R02: verify actual Android camera UI, reference-photo controls and permissions.

This covers emulator UI states. Physical ARM64 sensor/frame, optical zoom,
torch, and real photo persistence require separately documented device evidence.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("r02_stage13", HERE / "capture-stage13-android.py")
stage13 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage13)
qa = stage13.qa

PROFILES = ("phone-412dp", "tablet-600dp")
VARIANTS = ("dark-100", "light-100")
SCREENS = (
    "camera", "camera-reference-adjust", "camera-settings", "camera-settings-storage",
    "camera-guide-settings", "camera-color-panel", "camera-zoom-panel", "camera-light-panel"
)
BY_NAME = {x[0]: x for x in stage13.CASES}
if len(set(SCREENS)) != len(SCREENS) or not set(SCREENS).issubset(BY_NAME):
    raise ValueError("Invalid UI-R02 camera screen inventory")


def on_screen(xml, label, viewport):
    # Native accessible controls are evidence of reachable actions, not just text.
    return qa.target_bounds(xml, label, viewport=viewport)


def capture_variant(device, target, profile, variant):
    theme, font, scale = stage13.ALL_VARIANTS[variant]
    device.shell("settings", "put", "system", "font_scale", scale)
    device.seed(True, font, theme_mode=theme)
    source_photos = [x["id"] for x in json.loads(device.storage()["travel-frame.photos.v1"])]
    target.mkdir(parents=True, exist_ok=True)
    report = {
        "stage": "UI-R02", "profile": profile, "variant": variant,
        "capturedAt": datetime.now(timezone.utc).isoformat(), "screens": [],
        "nativeCameraPreviewTested": False, "opticalZoomTested": False,
        "physicalTorchTested": False, "realPhotoSavedTested": False,
        "hardwareResult": "PENDING_ARM64_REAL_DEVICE",
        "status": "in_progress",
    }
    try:
        for name in SCREENS:
            _, label, route, expected, action = BY_NAME[name]
            record = stage13.verified_capture(device, target, name, route, expected, action)
            record.update(label=label, profile=profile, variant=variant)
            (target / (name+".json")).write_text(
                json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
            report["screens"].append(record)
            if record.get("status") != "captured" or record.get("pixelEvidenceValid") is not True:
                raise AssertionError(f"Invalid native camera UI capture: {name}: {record.get('error')}")
            if name == "camera":
                seen = qa.ui_strings((target / "camera.xml").read_text(encoding="utf-8"))
                report["emulatorCameraState"] = (
                    "SEARCHING_FOR_CAMERA" if any("사용할 수 있는 카메라를 찾는 중" in s for s in seen)
                    else "STATE_NOT_CONFIRMED"
                )
                on_screen(device.dump(), "사진 촬영", device.viewport())
                on_screen(device.dump(), "프로젝트 선택", device.viewport())
            if name == "camera-reference-adjust":
                xml = device.dump()
                if not any(node.get("class") == "android.widget.SeekBar" and
                           node.get("content-desc", "").startswith("투명도, ")
                           for node in ET.fromstring(xml).iter("node")):
                    raise AssertionError("Reference opacity is not a real accessible slider")
                on_screen(xml, "기준 사진 위치 및 투명도 설정 완료", device.viewport())
            if name == "camera-settings-storage":
                xml = device.dump()
                if not any("핸드폰 앨범" in s for s in qa.ui_strings(xml)):
                    raise AssertionError("Camera storage options missing")
            if name == "camera-guide-settings":
                if not any("가이드라인" in s for s in qa.ui_strings(device.dump())):
                    raise AssertionError("Camera guide settings not observed")
        # Permission denial must be a genuine Android package-permission state,
        # and the helper restores the permission even when UI capture fails.
        permission = stage13.capture_camera_permission_denied(device, target)
        permission.update(label="Camera permission denied", profile=profile, variant=variant)
        report["screens"].append(permission)
        (target / "camera-permission-denied.json").write_text(
            json.dumps(permission, indent=2, ensure_ascii=False), encoding="utf-8")
        if permission.get("status") != "captured" or permission.get("pixelEvidenceValid") is not True:
            raise AssertionError(f"Native permission-denied screen invalid: {permission.get('error')}")
        if permission.get("permissionActionEvidence", {}).get("fixedActionsVisible") is not True:
            raise AssertionError("No accessible recovery action for camera permission")
        remaining = [x["id"] for x in json.loads(device.storage()["travel-frame.photos.v1"])]
        if remaining != source_photos:
            raise AssertionError("Camera UI QA mutated original synthetic photo records")
        # A software-only emulator UI cannot prove successful real-camera capture.
        report["status"] = "ui-pass-hardware-pending"
    except Exception as error:
        report["status"] = "fail"
        report["error"] = str(error)
        try:
            data = device.run("exec-out", "screencap", "-p", binary=True)
            if data.startswith(bytes.fromhex("89504e470d0a1a0a")):
                (target / "failure-actual-android.png").write_bytes(data)
            (target / "failure-native.xml").write_text(device.dump(), encoding="utf-8")
        except Exception as diag:
            report["diagnosticError"] = str(diag)
    finally:
        (target / "camera-manifest.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    device = qa.Device()
    manifests = []
    try:
        if os.environ.get("BODY_FRAME_STORE_DEMO_FIXTURES") != "1":
            raise RuntimeError("UI-R02 requires local synthetic demo fixture opt-in")
        if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
            raise RuntimeError("UI-R02 must not run against physical/user devices")
        device.run("install", "-r", "-g", args.apk.resolve())
        qa.prepare_native_hierarchy(device, args.output)
        device.shell("svc", "wifi", "disable")
        device.shell("svc", "data", "disable")
        device.shell("input", "keyevent", "KEYCODE_WAKEUP")
        device.shell("wm", "dismiss-keyguard")
        qa.recover_launcher_anr(device, args.output / "system-diagnostics")
        for profile in PROFILES:
            size, density = stage13.ALL_PROFILES[profile]
            device.shell("wm", "size", size)
            device.shell("wm", "density", density)
            qa.wait_for_visual_profile(device, size, density)
            for variant in VARIANTS:
                manifests.append(capture_variant(device,args.output/profile/variant,profile,variant))
    finally:
        device.shell("am", "force-stop", qa.PACKAGE, check=False)
        device.shell("wm", "size", "reset", check=False)
        device.shell("wm", "density", "reset", check=False)
        device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
        summary = {
            "stage": "UI-R02", "source": os.environ.get("GITHUB_SHA", "local"),
            "apkSha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
            "expectedCaptures": len(PROFILES)*len(VARIANTS)*(len(SCREENS)+1),
            "actualCaptures": sum(len(m["screens"]) for m in manifests),
            "uiPassedProfiles": sum(m["status"] == "ui-pass-hardware-pending" for m in manifests),
            "expectedProfiles": len(PROFILES)*len(VARIANTS),
            "hardware": "PENDING_ARM64_REAL_DEVICE",
            "failedProfiles": [
                f"{m['profile']}/{m['variant']}: {m.get('error','')}"
                for m in manifests if m["status"] == "fail"
            ],
            "excludedClaims": [
                "Real camera image sensor/capture", "Optical zoom", "Physical torch",
                "Original-quality image saving", "Physical-phone gestures",
                "Production Play release"
            ]
        }
        (args.output/"ui-r02-summary.json").write_text(
            json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False), flush=True)
    if summary["actualCaptures"] != summary["expectedCaptures"] or summary["failedProfiles"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
