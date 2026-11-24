#!/usr/bin/env python3
"""UI-R05: run existing native MP4 export/cancel/failure QA on a disposable Android emulator."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("ui_r05_original_android_qa", ROOT / "capture-android-qa.py")
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.output
    target = root / "phone-412dp"
    target.mkdir(parents=True, exist_ok=True)
    device = qa.Device()
    records = []
    result = {
        "stage": "UI-R05",
        "profile": "phone-412dp",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceHead": __import__("os").environ.get("GITHUB_SHA", "local"),
        "apkSha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        "syntheticData": True,
        "emulatorOnly": True,
        "network": "offline",
        "expectedCases": ["video-missing-original", "video-corrupt-original", "video-background-cancel", "video-native-export"],
        "realARM64Playback": "NOT_TESTED",
        "status": "pending",
        "captures": records
    }
    try:
        if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
            raise RuntimeError("Refusing UI-R05 native QA on non-emulator device")
        device.run("install", "-r", "-g", args.apk.resolve())
        result["hierarchy"] = qa.prepare_native_hierarchy(device, root)
        device.shell("svc", "wifi", "disable")
        device.shell("svc", "data", "disable")
        device.shell("input", "keyevent", "KEYCODE_WAKEUP")
        device.shell("wm", "dismiss-keyguard")
        result["systemLauncherHealth"] = qa.recover_launcher_anr(device, root / "system-diagnostics")
        device.shell("wm", "size", "824x1832")
        device.shell("wm", "density", 320)
        result["viewport"] = qa.wait_for_visual_profile(device, "824x1832", 320)
        device.shell("settings", "put", "system", "font_scale", "1.0")
        device.seed(True, "medium", theme_mode="dark")
        records.extend(qa.video_failure_and_background_smoke(device, target))
        records.extend(qa.video_smoke(device, target, restart=False))
        failures = [item for item in records if item.get("status") != "captured"]
        if failures:
            raise RuntimeError("Native MP4/cancel/failure QA incomplete: " + repr([r.get("screen") for r in failures]))
        result["status"] = "pass"
    except Exception as exc:
        result["status"] = "fail"
        result["error"] = str(exc)
    finally:
        result["passed"] = sum(item.get("status") == "captured" for item in records)
        result["failed"] = sum(item.get("status") != "captured" for item in records)
        (root / "ui-r05-native-qa.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        (root / "logcat.txt").write_text(device.run("logcat", "-d", check=False), encoding="utf-8")
        device.shell("am", "force-stop", qa.PACKAGE, check=False)
        device.shell("wm", "size", "reset", check=False)
        device.shell("wm", "density", "reset", check=False)
        device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
        print(json.dumps({key: result[key] for key in ("stage", "status", "passed", "failed", "apkSha256")}, ensure_ascii=False), flush=True)
    if result["status"] != "pass":
        sys.exit(1)


if __name__ == "__main__":
    main()
