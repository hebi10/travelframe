#!/usr/bin/env python3
"""STORE-03-B genuine Android UI captures with offline, synthetic demo-photo assets.

Never runs on a physical device and never modifies a real user's media or app profile.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("store03b_stage13", ROOT / "capture-stage13-android.py")
stage13 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage13)
qa = stage13.qa

PROFILES = ("phone-412dp", "tablet-600dp")
VARIANTS = ("dark-100", "light-100")
SCREENS = (
    "camera", "camera-reference-adjust", "records", "project", "compare",
    "measurements", "video-home", "video-create", "settings",
)
CASE_BY_NAME = {case[0]: case for case in stage13.CASES}
if len(SCREENS) != len(set(SCREENS)) or not set(SCREENS).issubset(CASE_BY_NAME):
    raise RuntimeError("STORE-03-B screenshot inventory is invalid")


def capture_device(device, apk, output):
    if os.environ.get("BODY_FRAME_STORE_DEMO_FIXTURES") != "1":
        raise RuntimeError("STORE-03-B requires the explicitly enabled offline demo-photo fixture")
    if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
        raise RuntimeError("Store demo captures can only run on a disposable Android emulator")
    device.run("install", "-r", "-g", apk.resolve())
    qa.prepare_native_hierarchy(device, output)
    device.shell("svc", "wifi", "disable")
    device.shell("svc", "data", "disable")
    device.shell("input", "keyevent", "KEYCODE_WAKEUP")
    device.shell("wm", "dismiss-keyguard")
    results = []
    for profile in PROFILES:
        size, density = stage13.ALL_PROFILES[profile]
        folder = output / profile
        folder.mkdir(parents=True, exist_ok=True)
        device.shell("am", "force-stop", qa.PACKAGE)
        device.shell("wm", "size", size)
        device.shell("wm", "density", density)
        evidence = qa.wait_for_visual_profile(device, size, density)
        manifest = {
            "stage": "STORE-03-B",
            "profile": profile,
            "displayEvidence": evidence,
            "packageName": qa.PACKAGE,
            "apkSha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
            "sourceCommit": os.environ.get("GITHUB_SHA", "local"),
            "prHeadCommit": os.environ.get("STORE_DEMO_HEAD_SHA", "unknown"),
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "dataset": "AI-generated synthetic model; no real person's health or body-change evidence",
            "datasetImageCount": 3,
            "captureMatrix": list(VARIANTS),
            "network": "Emulator Wi-Fi and cellular data disabled",
            "screens": list(SCREENS),
            "notValidated": [
                "Real-camera subject framing", "Real body transformations",
                "Physical Android device", "Google Play publication", "Video MP4 rendering"
            ],
            "captures": [],
        }
        try:
            for variant in VARIANTS:
                theme, font, scale = stage13.ALL_VARIANTS[variant]
                directory = folder / variant
                directory.mkdir(exist_ok=True)
                device.shell("settings", "put", "system", "font_scale", scale)
                device.seed(True, font, theme_mode=theme)
                for name in SCREENS:
                    _, label, route, expected, action = CASE_BY_NAME[name]
                    record = stage13.verified_capture(device, directory, name, route, expected, action)
                    record.update(profile=profile, variant=variant, label=label)
                    manifest["captures"].append(record)
                    (directory / (name + ".json")).write_text(
                        json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                    if record.get("pixelEvidenceValid") is False:
                        raise RuntimeError("Unusable native Android screenshot: " + name)
        except Exception as error:
            manifest["fatalError"] = str(error)
        finally:
            manifest["passed"] = sum(r.get("status") == "captured" and r.get("pixelEvidenceValid") for r in manifest["captures"])
            manifest["failed"] = len(manifest["captures"]) - manifest["passed"]
            stage13.write_report(folder, manifest)
            results.append(manifest)
        if manifest.get("fatalError") or manifest["failed"]:
            break
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    device = qa.Device()
    try:
        results = capture_device(device, args.apk, args.output)
    finally:
        device.shell("am", "force-stop", qa.PACKAGE, check=False)
        device.shell("wm", "size", "reset", check=False)
        device.shell("wm", "density", "reset", check=False)
        device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
    summary = {
        "stage": "STORE-03-B",
        "profiles": list(PROFILES),
        "variants": list(VARIANTS),
        "expected": len(PROFILES) * len(VARIANTS) * len(SCREENS),
        "captured": sum(x["passed"] for x in results),
        "failed": sum(x["failed"] for x in results),
        "complete": len(results) == len(PROFILES) and
                    all(x["passed"] == len(VARIANTS) * len(SCREENS) and
                        not x.get("fatalError") for x in results),
    }
    (args.output / "store-03b-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False), flush=True)
    if not summary["complete"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
