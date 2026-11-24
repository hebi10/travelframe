#!/usr/bin/env python3
"""Read-only audit of real UI-R07 Android IME/creation capture evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

PNG_HEADER = bytes.fromhex("89504e470d0a1a0a")


def load(path):
    if not path.is_file():
        raise AssertionError(f"Missing original native record: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def inspect_capture(directory, name):
    rec = load(directory / f"{name}.json")
    png_path = directory / f"{name}.png"
    xml_path = directory / f"{name}.xml"
    png = png_path.read_bytes()
    if rec.get("status") != "captured" or not png.startswith(PNG_HEADER):
        raise AssertionError(f"Unverified native Android PNG: {name}")
    width, height = struct.unpack(">II", png[16:24])
    if (width, height) != (720, 1600):
        raise AssertionError(f"Wrong Android phone-360dp pixels for {name}")
    if hashlib.sha256(png).hexdigest() != rec.get("sha256"):
        raise AssertionError(f"Original PNG SHA mismatch for {name}")
    ET.parse(xml_path)
    return rec


def verify(root, apk):
    manifest = load(root / "ui-r07-keyboard-manifest.json")
    if manifest.get("result") != "PASS" or manifest.get("fontScale") != 1.5:
        raise AssertionError("Native keyboard was not tested at Android 150% system font")
    if manifest.get("keyboardWasVisible") is not True or manifest.get("profile") != "phone-360dp":
        raise AssertionError("Keyboard/folded-width source was not verified")
    actual_sha = hashlib.sha256(apk.read_bytes()).hexdigest()
    if manifest.get("apkSha256") != actual_sha:
        raise AssertionError("APK used by emulator differs from checked build")
    directory = root / "phone-360dp"
    focused = inspect_capture(directory, "project-keyboard-150")
    saved = inspect_capture(directory, "project-created-150")
    first = focused.get("actionEvidence", {})
    second = saved.get("actionEvidence", {})
    if first.get("keyboardShown") is not True:
        raise AssertionError("No Android IME visible in source capture")
    if second.get("projectPersisted") is not True or second.get("keyboardVisibleBeforeActivation") is not True:
        raise AssertionError("Original project data was not saved with keyboard open")
    if second.get("physicalBackActionCount") != 0 or second.get("physicalDragActionCount") != 0:
        raise AssertionError("User could not press project creation footer without dismissing keyboard")
    return {
        "result": "PASS",
        "apkSha256": actual_sha,
        "systemFontScale": "150%",
        "widthDp": 360,
        "nativePNG": 2,
        "actualAndroidKeyboard": True,
        "persistentProject": True,
        "physicalARM64": "NOT_TESTED"
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    try:
        report = verify(args.root, args.apk)
    except Exception as exc:
        report = {"result": "FAIL", "errors": [str(exc)], "physicalARM64": "NOT_TESTED"}
    (args.output / "ui-r07-keyboard-audit.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if report["result"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
