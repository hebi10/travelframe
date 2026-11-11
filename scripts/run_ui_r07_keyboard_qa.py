#!/usr/bin/env python3
"""UI-R07: native 150% keyboard and project create QA, disposable offline emulator only."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("ui_r07_native_helpers", ROOT / "capture-android-qa.py")
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / "phone-360dp"
    target.mkdir(parents=True, exist_ok=True)
    device = qa.Device()
    records = []
    manifest = {
        "stage": "UI-R07",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceCommit": os.environ.get("GITHUB_SHA", "local"),
        "apkSha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        "profile": "phone-360dp",
        "fontScale": 1.5,
        "fixture": "offline disposable guest with no user media or login",
        "keyboardWasVisible": False,
        "screenshots": records,
        "result": "PENDING"
    }
    try:
        if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
            raise RuntimeError("Never seed a physical Android device")
        device.run("install", "-r", "-g", args.apk.resolve())
        manifest["hierarchy"] = qa.prepare_native_hierarchy(device, args.output)
        device.shell("svc", "wifi", "disable")
        device.shell("svc", "data", "disable")
        device.shell("input", "keyevent", "KEYCODE_WAKEUP")
        device.shell("wm", "dismiss-keyguard")
        manifest["systemLauncherHealth"] = qa.recover_launcher_anr(device, args.output / "system-diagnostics")
        device.shell("wm", "size", "720x1600")
        device.shell("wm", "density", "320")
        manifest["viewportEvidence"] = qa.wait_for_visual_profile(device, "720x1600", 320)
        device.shell("settings", "put", "system", "font_scale", "1.5")
        device.seed(False, "medium", theme_mode="dark")
        keyboard = qa.capture(
            device, target, "project-keyboard-150", "studio",
            ["QA_keyboard_large_font", "프로젝트 만들기"], qa.creation_keyboard
        )
        records.append(keyboard)
        if keyboard.get("status") != "captured" or keyboard.get("actionEvidence", {}).get("keyboardShown") is not True:
            raise RuntimeError("Real Android 150% project keyboard was not captured")
        qa.target_bounds(device.dump(), "프로젝트 만들기", viewport=device.viewport())
        manifest["keyboardWasVisible"] = True
        saved = qa.capture(
            device, target, "project-created-150", "studio",
            ["QA_keyboard_large_font 프로젝트 열기"], qa.creation_submit, open_route=False
        )
        records.append(saved)
        if saved.get("status") != "captured":
            raise RuntimeError("Keyboard-visible project creation failed")
        if saved.get("actionEvidence", {}).get("projectPersisted") is not True:
            raise RuntimeError("Created project missing from native persistent storage")
        if saved.get("actionEvidence", {}).get("keyboardVisibleBeforeActivation") is not True:
            raise RuntimeError("Project save was not activated with keyboard visible")
        manifest["result"] = "PASS"
    except Exception as exc:
        manifest["result"] = "FAIL"
        manifest["error"] = str(exc)
    finally:
        manifest["passed"] = sum(x.get("status") == "captured" for x in records)
        manifest["failed"] = sum(x.get("status") != "captured" for x in records)
        (args.output / "ui-r07-keyboard-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (args.output / "logcat.txt").write_text(device.run("logcat", "-d", check=False), encoding="utf-8")
        device.shell("am", "force-stop", qa.PACKAGE, check=False)
        device.shell("wm", "size", "reset", check=False)
        device.shell("wm", "density", "reset", check=False)
        device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
        print(json.dumps({k: manifest.get(k) for k in ["result", "profile", "fontScale", "passed", "failed"]}), flush=True)
    if manifest["result"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
