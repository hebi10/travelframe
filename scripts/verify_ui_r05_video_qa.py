#!/usr/bin/env python3
"""Independent readback of actual UI-R05 emulator MP4 and screenshot artifacts."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

PNG = bytes.fromhex("89504e470d0a1a0a")
EXPECTED_PHOTOS = [f"qa-demo-photo-{number}" for number in range(1, 4)]
EXPECTED_CASES = ("video-missing-original", "video-corrupt-original", "video-background-cancel", "video-native-export")
SCREENSHOTS = ("video-export-completion", "video-library-populated", "video-detail")


def load_json(path):
    if not path.is_file():
        raise AssertionError(f"Missing QA result: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def png_verified(path):
    raw = path.read_bytes()
    if not raw.startswith(PNG) or len(raw) < 50:
        raise AssertionError(f"Not a real PNG: {path}")
    width, height = struct.unpack(">II", raw[16:24])
    if width < 720 or height < 1200:
        raise AssertionError(f"Unexpected native screenshot size: {path}")
    ET.fromstring(path.with_suffix(".xml").read_text(encoding="utf-8"))
    record = load_json(path.with_suffix(".json"))
    if record.get("status") != "captured" or record.get("sha256") != hashlib.sha256(raw).hexdigest():
        raise AssertionError(f"Screenshot capture/hash mismatch: {path}")
    return {"screen": path.stem, "width": width, "height": height}


def verify(root, apk):
    report = load_json(root / "ui-r05-native-qa.json")
    if report.get("status") != "pass" or report.get("emulatorOnly") is not True or report.get("syntheticData") is not True:
        raise AssertionError("Native UI-R05 summary is missing PASS or disposable-emulator proof")
    if report.get("realARM64Playback") != "NOT_TESTED":
        raise AssertionError("Native emulator must not claim physical phone playback")
    apk_sha = hashlib.sha256(apk.read_bytes()).hexdigest()
    if apk_sha != report.get("apkSha256"):
        raise AssertionError("Emulator was not given the verified APK artifact")
    directory = root / "phone-412dp"
    screen_checks = [png_verified(directory / f"{screen}.png") for screen in SCREENSHOTS]
    records = report.get("captures", [])
    cases = [item for item in records if item.get("screen") in EXPECTED_CASES]
    if sorted(item["screen"] for item in cases) != sorted(EXPECTED_CASES):
        raise AssertionError("Missing native video failure/cancel/export cases")
    if any(item.get("status") != "captured" or item.get("createClicks") != 1 for item in cases):
        raise AssertionError("Native export/cancel cases must execute exactly once and pass")
    for item in cases:
        if item["screen"] != "video-native-export":
            if item.get("videosUnchanged") is not True or item.get("guestQuotaUnchanged") is not True:
                raise AssertionError("Failed/cancelled export changed persistent app data")
    success = next(item for item in cases if item["screen"] == "video-native-export")
    if success.get("albumSaved") is not True or success.get("firstFrameDecoded") is not True:
        raise AssertionError("Native album save or decoded frame was not proven")
    if len(success.get("intervalPixelEvidence", [])) != 3:
        raise AssertionError("Three independent MP4 fixture frames were not checked")
    if success.get("guestQuotaAfter", {}).get("count") != 1:
        raise AssertionError("Guest video quota must count the successful export exactly once")
    if success.get("video", {}).get("photoIds") != EXPECTED_PHOTOS:
        raise AssertionError("Persisted MP4 did not reference expected ordered synthetic photos")
    mp4 = directory / "native-video-smoke.mp4"
    raw = mp4.read_bytes()
    if len(raw) < 32 or b"ftyp" not in raw[:32] or hashlib.sha256(raw).hexdigest() != success.get("sha256"):
        raise AssertionError("Persisted native MP4 checksum or container signature mismatch")
    probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(mp4)],
        capture_output=True, check=True, timeout=30
    ).stdout)
    stream = next((item for item in probe.get("streams", []) if item.get("codec_type") == "video"), None)
    if not stream or stream.get("codec_name") != "h264" or (stream.get("width"), stream.get("height")) != (1080, 1440):
        raise AssertionError("Actual MP4 is not default 1080x1440 H.264")
    if int(stream.get("nb_read_frames", -1)) != 9 or abs(float(probe["format"]["duration"]) - 0.3) > 1/30 + 0.0001:
        raise AssertionError("MP4 frame count or duration does not match test case")
    return {
        "status": "PASS",
        "sha256": apk_sha,
        "mp4Sha256": success["sha256"],
        "video": {"codec": "h264", "width": 1080, "height": 1440, "frames": 9},
        "screenshots": screen_checks,
        "cases": list(EXPECTED_CASES),
        "physicalPlayback": "NOT_TESTED",
        "note": "Real native emulator MP4, app storage and album completion; no physical playback or device music test"
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    try:
        result = verify(args.root, args.apk)
    except Exception as error:
        result = {"status": "FAIL", "errors": [str(error)], "physicalPlayback": "NOT_TESTED"}
    (args.output / "ui-r05-native-audit.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False), flush=True)
    if result["status"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
