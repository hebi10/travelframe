#!/usr/bin/env python3
"""Verify UI-R00 Android source-linked PNG, XML, state and profile evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

PROFILES = {
    "phone-360dp": (720, 1600),
    "phone-412dp": (824, 1832),
    "tablet-600dp": (900, 1600),
    "tablet-750dp": (1125, 1800),
}
VARIANTS = ("dark-100", "light-100")
BASE = (
    "camera", "camera-reference-adjust", "records", "project", "compare",
    "measurements", "video-home", "video-create", "settings", "account"
)
STATES = (
    "state-empty-projects", "state-project-no-photos", "state-project-one-photo",
    "state-project-twelve-photos", "state-three-projects",
    "state-empty-videos", "state-guest-account", "state-first-run",
    "state-new-project", "camera-permission-denied"
)
EXPECTED_STORAGE = {
    "state-empty-projects": (0, 0),
    "state-project-no-photos": (1, 0),
    "state-project-one-photo": (1, 1),
    "state-project-twelve-photos": (1, 12),
    "state-three-projects": (3, 9),
    "state-empty-videos": (1, 3),
    "state-guest-account": (1, 3),
    "state-first-run": (1, 3),
    "state-new-project": (0, 0),
    "camera-permission-denied": (1, 3),
}
PNG_HEADER = bytes.fromhex("89504e470d0a1a0a")


def verify(root, output):
    problems = []
    stats = []
    app_hashes = set()
    base_shas = set()
    head_shas = set()
    total = 0
    expected_total = 0
    for profile, dimensions in PROFILES.items():
        folder = root / profile
        mf = folder / "capture-manifest.json"
        if not mf.is_file():
            problems.append(f"{profile}: missing capture-manifest.json")
            continue
        try:
            manifest = json.loads(mf.read_text(encoding="utf-8"))
            assert manifest.get("stage") == "UI-R00"
            assert manifest.get("profile") == profile
            assert manifest.get("captureMatrix") == list(VARIANTS)
            assert manifest.get("package") == "com.haebi.photoguide"
            assert manifest.get("network") == "Wi-Fi and mobile data disabled"
            assert manifest.get("dataOrigin", "").startswith("AI synthetic demo photo")
            assert len(manifest.get("apkSha256", "")) == 64
            assert len(manifest.get("baseMainSha", "")) == 40
            assert len(manifest.get("prHeadSha", "")) == 40
            assert "fatalError" not in manifest
            app_hashes.add(manifest["apkSha256"])
            base_shas.add(manifest["baseMainSha"])
            head_shas.add(manifest["prHeadSha"])
            records = manifest.get("captures", [])
            planned = set()
            for variant in VARIANTS:
                for name in BASE + (STATES if profile == "phone-412dp" else ()):
                    planned.add((variant, name))
            expected_total += len(planned)
            seen = set()
            for record in records:
                key = (record.get("variant"), record.get("screen"))
                assert key in planned, f"unexpected capture {key}"
                assert key not in seen, f"duplicate capture {key}"
                seen.add(key)
                assert record.get("status") == "captured", f"failed screenshot {key}: {record.get('error')}"
                assert record.get("pixelEvidenceValid") is True, f"nonvisual screenshot {key}"
                assert record.get("profile") == profile
                assert record.get("storageEvidence", {}).get("offline") is True
                assert record.get("storageEvidence", {}).get("synthetic") is True
                variant, name = key
                path = folder / variant / (name + ".png")
                xml_path = folder / variant / (name + ".xml")
                json_path = folder / variant / (name + ".json")
                assert path.is_file() and xml_path.is_file() and json_path.is_file(), f"missing UI proof {key}"
                raw = path.read_bytes()
                assert raw.startswith(PNG_HEADER), f"not PNG {key}"
                assert struct.unpack(">II", raw[16:24]) == dimensions, f"wrong dimensions {key}"
                assert hashlib.sha256(raw).hexdigest() == record.get("sha256"), f"sha mismatch {key}"
                ET.fromstring(xml_path.read_text(encoding="utf-8"))
                assert json.loads(json_path.read_text(encoding="utf-8"))["sha256"] == record["sha256"], f"metadata mismatch {key}"
                if name in EXPECTED_STORAGE:
                    x, y = EXPECTED_STORAGE[name]
                    assert record["storageEvidence"]["projects"] == x and record["storageEvidence"]["photos"] == y, f"state mismatch {key}"
                else:
                    assert record["storageEvidence"]["projects"] == 1 and record["storageEvidence"]["photos"] == 3, f"baseline state mismatch {key}"
                total += 1
            assert seen == planned, f"missing captures {planned - seen}"
            assert manifest.get("expected") == len(planned), "expected count mismatch"
            assert manifest.get("passed") == len(planned) and manifest.get("failed") == 0, "capture count mismatch"
            stats.append({"profile": profile, "expected": len(planned), "passed": len(planned), "pngXmlSha": "pass"})
        except (AssertionError, KeyError, ValueError, ET.ParseError) as exc:
            problems.append(f"{profile}: {exc}")
    if len(app_hashes) != 1:
        problems.append("all device profiles must use one exact APK hash")
    if len(base_shas) != 1:
        problems.append("all device profiles must use one locked main SHA")
    if len(head_shas) != 1:
        problems.append("all device profiles must use one PR HEAD SHA")
    if len(stats) != len(PROFILES):
        problems.append("one or more required Android profiles failed")
    if total != 100 or expected_total != 100:
        problems.append(f"baseline must contain 100 verified captures; got {total}/{expected_total}")
    report = {
        "stage": "UI-R00",
        "complete": not problems,
        "profiles": stats,
        "expected": 100,
        "verified": total,
        "baselineMainSha": next(iter(base_shas)) if len(base_shas) == 1 else None,
        "prHeadSha": next(iter(head_shas)) if len(head_shas) == 1 else None,
        "apkSha256": next(iter(app_hashes)) if len(app_hashes) == 1 else None,
        "issues": problems,
        "limitations": [
            "Synthetic demo media; not actual body changes",
            "Camera preview may be searching for an emulator camera",
            "No physical device, TalkBack or real gesture recognition proven",
            "Empty video state is not successful MP4 export evidence",
            "No Play listing or signed release publish",
        ],
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "ui-r00-baseline-verification.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output / "ui-r00-baseline-verification.md").write_text(
        "# UI-R00 — 동일 커밋 Android 화면·상태 기준 검증\n\n"
        + f"- 결과: {'PASS' if report['complete'] else 'FAIL'}\n"
        + f"- 실제 PNG/XML/JSON 검증: {total}/100\n"
        + f"- main 기준: {report['baselineMainSha']}\n"
        + f"- PR HEAD: {report['prHeadSha']}\n"
        + f"- APK SHA256: {report['apkSha256']}\n"
        + "- 범위: phone 360/412dp·tablet 600/750dp × 라이트/다크, 10개 기본 화면; phone-412dp는 10개 상태 추가\n"
        + "\n".join("- " + issue for issue in problems)
        + "\n\n한계: 실제 인물·카메라·터치 제스처·MP4 생성·Play 등록 검증이 아닙니다.\n",
        encoding="utf-8"
    )
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    report = verify(args.root, args.output)
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if not report["complete"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
