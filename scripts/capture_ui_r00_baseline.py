#!/usr/bin/env python3
"""UI-R00: exact-head Android baseline, genuine PNG/XML and offline data-state QA.

The only installed app is a freshly built QA APK on a disposable Android emulator.
Never seed actual user devices, access a personal photo library or call cloud services.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile

HERE = Path(__file__).resolve().parent


def load_module(filename, name):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


stage13 = load_module("capture-stage13-android.py", "ui_r00_stage13")
data = load_module("ui_r00_data_fixtures.py", "ui_r00_fixtures")
qa = stage13.qa

PROFILES = tuple(stage13.ALL_PROFILES)
VARIANTS = ("dark-100", "light-100")
BASE_SCREENS = (
    "camera", "camera-reference-adjust", "records", "project", "compare",
    "measurements", "video-home", "video-create", "settings", "account"
)
CASE_LOOKUP = {entry[0]: entry for entry in stage13.CASES}
STATE_CASES = (
    ("state-empty-projects", "no-project", "studio", ["내 프로젝트"], None),
    ("state-project-no-photos", "project-no-photo", f"project/{qa.PROJECT}", ["QA 데모"], None),
    ("state-project-one-photo", "project-one-photo", f"project/{qa.PROJECT}", ["QA 데모"], None),
    ("state-project-twelve-photos", "project-many-photos", f"project/{qa.PROJECT}", ["QA 데모"], None),
    ("state-three-projects", "three-projects", "studio", ["내 프로젝트", "QA 데모"], None),
    ("state-empty-videos", "video-empty", "video-library", ["영상 관리", "저장한 영상"], None),
    ("state-guest-account", "guest", "account", ["로그인하고 기록을 보호하세요."], None),
    ("state-first-run", "first-run", "camera", ["첫 사진을 남겨 보세요", "시작하기", "나중에 보기"], None),
    ("state-new-project", "no-project", "studio", ["프로젝트 이름", "목표 기록 수"], 
     (["내 프로젝트"], "새 프로젝트 만들기")),
)
STATE_NAMES = tuple(entry[0] for entry in STATE_CASES) + ("camera-permission-denied",)


def seed_and_verify(device, state, font, theme):
    """Replaces only the disposable emulator package's SQLite storage."""
    if os.environ.get("BODY_FRAME_STORE_DEMO_FIXTURES") != "1":
        raise RuntimeError("QA demo fixtures must be explicitly enabled")
    if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
        raise RuntimeError("Refusing UI-R00 storage mutation outside Android emulator")
    app_dir = device.seed(state != "no-project", font, theme_mode=theme, intro_seen=state != "first-run")
    values, extra_media, expected = data.build_state(qa, app_dir, state, font, theme)
    for project_id, photo_id, source_index in extra_media:
        device.shell("run-as", qa.PACKAGE, "mkdir", "-p",
                     f"files/photos/{project_id}", f"files/photo-previews/{project_id}")
        for folder in ("photos", "photo-previews"):
            relative = f"files/{folder}/{project_id}/photo-{photo_id}.jpg"
            payload = qa.fixture_jpeg(source_index, folder == "photo-previews")
            device.shell("run-as", qa.PACKAGE, "sh", "-c",
                         f"cat > {relative}", data=payload)
    device.shell("am", "force-stop", qa.PACKAGE)
    with tempfile.TemporaryDirectory() as temporary:
        db_path = Path(temporary) / "RKStorage"
        qa.write_storage(db_path, values)
        device.shell("run-as", qa.PACKAGE, "rm", "-f",
                     "databases/RKStorage-wal", "databases/RKStorage-shm",
                     "databases/RKStorage-journal")
        device.shell("run-as", qa.PACKAGE, "sh", "-c",
                     "cat > databases/RKStorage", data=db_path.read_bytes())
    saved = device.storage()
    actual = {
        "projects": len(json.loads(saved[data.PROJECTS_STORAGE_ID])),
        "photos": len(json.loads(saved[data.PHOTOS_STORAGE_ID])),
        "measurements": len(json.loads(saved[data.MEASUREMENTS_STORAGE_ID])),
        "videos": len(json.loads(saved[data.VIDEOS_STORAGE_ID])),
    }
    if any(actual[key] != expected[key] for key in actual):
        raise RuntimeError(f"Seeded UI-R00 state differs from on-device storage: {state} {actual} != {expected}")
    return {**actual, "sample": state, "offline": True, "synthetic": True}


def collect(device, folder, name, route, expected, action, manifest, sample, snapshot):
    record = stage13.verified_capture(device, folder, name, route, expected, action)
    launcher_anr = "Android system Pixel Launcher ANR is covering the app"
    if (record.get("status") == "failed" and launcher_anr in record.get("error", "")
            and manifest.get("launcherRecoveryCount", 0) == 0):
        manifest["launcherRecoveryCount"] = 1
        try:
            recovery = qa.recover_launcher_anr(
                device, folder / "system-diagnostics" / "launcher-recovery"
            )
            manifest["launcherRecovery"] = recovery
            if recovery.get("status") == "recovered":
                record = stage13.verified_capture(device, folder, name, route, expected, action)
                record["systemLauncherRecovery"] = recovery
        except Exception as recovery_error:
            record["launcherRecoveryError"] = str(recovery_error)
    record.update(
        variant=manifest["currentVariant"], profile=manifest["profile"],
        label=name, sampleState=sample, storageEvidence=snapshot
    )
    (folder / (name + ".json")).write_text(
        json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    manifest["captures"].append(record)
    return record


def capture_profile(device, apk, output, profile):
    if os.environ.get("BODY_FRAME_STORE_DEMO_FIXTURES") != "1":
        raise RuntimeError("STORE demo image opt-in is required")
    if device.shell("getprop", "ro.kernel.qemu").strip() != "1":
        raise RuntimeError("UI-R00 must run on a disposable emulator")
    device.run("install", "-r", "-g", apk.resolve())
    folder = output / profile
    folder.mkdir(parents=True, exist_ok=True)
    qa.prepare_native_hierarchy(device, folder)
    device.shell("svc", "wifi", "disable")
    device.shell("svc", "data", "disable")
    device.shell("input", "keyevent", "KEYCODE_WAKEUP")
    device.shell("wm", "dismiss-keyguard")
    size, density = stage13.ALL_PROFILES[profile]
    device.shell("am", "force-stop", qa.PACKAGE)
    device.shell("wm", "size", size)
    device.shell("wm", "density", density)
    display = qa.wait_for_visual_profile(device, size, density)
    manifest = {
        "stage": "UI-R00", "profile": profile,
        "baseMainSha": os.environ.get("UI_R00_BASE_SHA", "unknown"),
        "captureCheckoutSha": os.environ.get("GITHUB_SHA", "local"),
        "prHeadSha": os.environ.get("UI_R00_PR_HEAD_SHA", "unknown"),
        "package": qa.PACKAGE,
        "apkSha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "captureMatrix": list(VARIANTS),
        "displayEvidence": display,
        "launcherRecoveryCount": 0,
        "dataOrigin": "AI synthetic demo photo only; locally seeded guest data on a disposable offline emulator",
        "network": "Wi-Fi and mobile data disabled",
        "unverified": [
            "Physical ARM64 camera and framing", "Actual body change",
            "MP4 rendering and replay", "Play billing, Firebase and cloud backup",
            "Real finger/vertical-scroll behavior and TalkBack",
        ],
        "captures": []
    }
    try:
        preflight = qa.recover_launcher_anr(
            device, folder / "system-diagnostics" / "launcher-preflight"
        )
        manifest["launcherPreflight"] = preflight
        if preflight.get("status") == "recovered":
            manifest["launcherRecoveryCount"] = 1
        for variant in VARIANTS:
            manifest["currentVariant"] = variant
            theme, font, scale = stage13.ALL_VARIANTS[variant]
            sub = folder / variant
            sub.mkdir(parents=True, exist_ok=True)
            device.shell("settings", "put", "system", "font_scale", scale)
            snapshot = seed_and_verify(device, "project-three-photos", font, theme)
            for name in BASE_SCREENS:
                _, _, route, expected, action = CASE_LOOKUP[name]
                collect(device, sub, name, route, expected, action, manifest,
                        "project-three-photos", snapshot)
            if profile == "phone-412dp":
                for name, state, route, expected, action in STATE_CASES:
                    snapshot = seed_and_verify(device, state, font, theme)
                    collect(device, sub, name, route, expected, action,
                            manifest, state, snapshot)
                snapshot = seed_and_verify(device, "project-three-photos", font, theme)
                permission = stage13.capture_camera_permission_denied(device, sub)
                permission.update(
                    variant=variant, profile=profile,
                    label="camera-permission-denied", sampleState="camera-permission-denied",
                    storageEvidence=snapshot
                )
                (sub / "camera-permission-denied.json").write_text(
                    json.dumps(permission, indent=2, ensure_ascii=False), encoding="utf-8"
                )
                manifest["captures"].append(permission)
    except Exception as error:
        manifest["fatalError"] = str(error)
    finally:
        manifest.pop("currentVariant", None)
        manifest["passed"] = sum(
            r.get("status") == "captured" and r.get("pixelEvidenceValid") is True
            for r in manifest["captures"]
        )
        manifest["failed"] = len(manifest["captures"]) - manifest["passed"]
        manifest["expected"] = len(VARIANTS) * (
            len(BASE_SCREENS) + (len(STATE_NAMES) if profile == "phone-412dp" else 0)
        )
        stage13.write_report(folder, manifest)
        gallery = folder / "gallery.html"
        html = gallery.read_text(encoding="utf-8")
        html = html.replace("TravelFrame Stage 13", "TravelFrame UI-R00")
        html = html.replace(
            "사용자 사진이 아닌 1·2·3 합성 이미지입니다.",
            "앱 UI는 실제 Android 캡처이며 피사체는 QA용 AI 합성 데모 사진입니다."
        )
        gallery.write_text(html, encoding="utf-8")
        (folder / "baseline-report.json").write_text(
            json.dumps({
                "profile": profile, "expected": manifest["expected"],
                "captured": manifest["passed"], "failed": manifest["failed"],
                "complete": manifest["passed"] == manifest["expected"] and not manifest.get("fatalError"),
                "apkSha256": manifest["apkSha256"],
                "baseMainSha": manifest["baseMainSha"],
                "prHeadSha": manifest["prHeadSha"],
                "fatalError": manifest.get("fatalError"),
            }, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=PROFILES, required=True)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    device = qa.Device()
    try:
        manifest = capture_profile(device, args.apk, args.output, args.profile)
    finally:
        device.shell("am", "force-stop", qa.PACKAGE, check=False)
        device.shell("wm", "size", "reset", check=False)
        device.shell("wm", "density", "reset", check=False)
        device.shell("settings", "put", "system", "font_scale", "1.0", check=False)
    print(json.dumps({
        "profile": args.profile,
        "expected": manifest["expected"], "captured": manifest["passed"],
        "failed": manifest["failed"], "fatalError": manifest.get("fatalError")
    }, ensure_ascii=False), flush=True)
    if manifest["passed"] != manifest["expected"] or manifest.get("fatalError"):
        sys.exit(1)


if __name__ == "__main__":
    main()
