#!/usr/bin/env python3
"""Read-only evidence audit for UI-R01 gestures and UI-R02 camera UI artifacts."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

PROFILES = ("phone-412dp", "tablet-600dp")
VARIANTS = ("dark-100", "light-100")
PNG_SIGNATURE = bytes.fromhex("89504e470d0a1a0a")


def load_json(path):
    if not path.is_file():
        raise AssertionError(f"Missing evidence: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def prove_image(path, expected_sha):
    if not path.is_file():
        raise AssertionError(f"Missing real Android PNG: {path}")
    raw = path.read_bytes()
    if not raw.startswith(PNG_SIGNATURE) or len(raw) < 50:
        raise AssertionError(f"Invalid screenshot: {path}")
    actual = hashlib.sha256(raw).hexdigest()
    if actual != expected_sha:
        raise AssertionError(f"Screenshot SHA256 mismatch: {path}")
    width, height = struct.unpack(">II", raw[16:24])
    if width < 720 or height < 1200:
        raise AssertionError(f"Unexpected Android screen bounds: {path}")
    xml = path.with_suffix(".xml")
    ET.fromstring(xml.read_text(encoding="utf-8"))
    load_json(path.with_suffix(".json"))
    return {"sha256": actual, "width": width, "height": height}


def verify(root):
    issues = []
    r01 = root / "r01"
    r02 = root / "r02"
    checks = []
    r01_sum = load_json(r01 / "ui-r01-summary.json")
    r02_sum = load_json(r02 / "ui-r02-summary.json")
    for key in ("apkSha256", "source"):
        if key == "apkSha256" and r01_sum.get(key) != r02_sum.get(key):
            issues.append("Gesture and camera jobs used different APK hashes")
    if r01_sum.get("gitHead") != r02_sum.get("source"):
        issues.append("Gesture and camera jobs did not use the same HEAD")
    for profile in PROFILES:
        for variant in VARIANTS:
            r01_dir = r01 / profile / variant
            r02_dir = r02 / profile / variant
            try:
                gest = load_json(r01_dir / "gesture-manifest.json")
                assert gest.get("status") == "pass", f"Gesture QA not passed: {profile}/{variant}"
                assert all(item.get("passed") is True for item in gest.get("checks", []))
                required = {
                    "native-slider-discovered", "vertical-scroll-within-photo",
                    "diagonal-vertical-preserves-slider",
                    "horizontal-photo-drag-adjusts-divider", "horizontal-left-adjusts-divider",
                    "preset-25", "preset-50", "preset-75", "side-by-side-mode",
                    "overlay-mode", "photo-picker", "picker-dismissed", "original-records-unchanged",
                }
                named = {check["name"]: check for check in gest.get("checks", [])}
                assert required <= named.keys(), f"Missing required gestures: {sorted(required - named.keys())}"
                for step in ("vertical-scroll-within-photo", "diagonal-vertical-preserves-slider"):
                    proof = named[step]["details"]
                    assert proof["after"]["percent"] == proof["before"]["percent"]
                    assert proof["after"]["bounds"][1] < proof["before"]["bounds"][1] - 22
                    assert proof["gesture"]["kind"] in ("vertical", "vertical-diagonal")
                for screen in gest.get("screens", []):
                    prove_image(r01_dir / (screen["step"]+".png"), screen["sha256"])
                camera = load_json(r02_dir / "camera-manifest.json")
                assert camera.get("status") == "ui-pass-hardware-pending"
                assert camera.get("hardwareResult") == "PENDING_ARM64_REAL_DEVICE"
                assert camera.get("realPhotoSavedTested") is False
                assert camera.get("nativeCameraPreviewTested") is False
                assert len(camera.get("screens", [])) == 9
                for screen in camera["screens"]:
                    assert screen.get("status") == "captured"
                    assert screen.get("pixelEvidenceValid") is True
                    prove_image(r02_dir / (screen["screen"]+".png"), screen["sha256"])
                checks.append({"profile": profile, "variant": variant,
                               "gestureChecks": len(gest["checks"]), "cameraScreens": len(camera["screens"]),
                               "status": "ui-pass-hardware-pending"})
            except (AssertionError, KeyError, ValueError, ET.ParseError, OSError) as e:
                issues.append(f"{profile}/{variant}: {e}")
    if len(checks) != 4 or r01_sum.get("passedProfiles") != 4:
        issues.append("UI-R01 Android gesture evidence incomplete")
    if r02_sum.get("uiPassedProfiles") != 4 or r02_sum.get("actualCaptures") != 36:
        issues.append("UI-R02 Android UI evidence incomplete")
    if r02_sum.get("hardware") != "PENDING_ARM64_REAL_DEVICE":
        issues.append("UI-R02 physical camera completion must not be claimed")
    result = {
        "uiR01Emulator": "PASS" if not issues else "FAIL",
        "uiR02Emulator": "PASS" if not issues else "FAIL",
        "uiR02PhysicalCamera": "PENDING_ARM64_REAL_DEVICE",
        "verifiedCells": checks,
        "apkSha256": r01_sum.get("apkSha256"),
        "gitHead": r01_sum.get("gitHead"),
        "errors": issues,
        "limitations": [
            "No actual ARM64 camera sensor or optical zoom/torch result",
            "No real photo persistence or real body transformation evidence",
            "Android input swipe is not a physical finger/TalkBack test",
            "No Google Play test release, cloud or billing change"
        ]
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    a = parser.parse_args()
    a.output.mkdir(parents=True, exist_ok=True)
    try:
        report = verify(a.root)
    except Exception as exc:
        report = {"uiR01Emulator": "FAIL", "uiR02Emulator": "FAIL",
                  "uiR02PhysicalCamera": "PENDING_ARM64_REAL_DEVICE",
                  "errors": [str(exc)]}
    (a.output / "ui-r01-r02-qa-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if report["uiR01Emulator"] != "PASS" or report["uiR02Emulator"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
