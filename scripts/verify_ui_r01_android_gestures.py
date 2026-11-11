#!/usr/bin/env python3
"""UI-R01: measure real Android compare-panel swipes, not screenshot-only assumptions.

Disposable emulator only. Uses actual native input/swipe and React Native
accessibility/XML evidence. Do not interpret these checks as physical-finger QA.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import struct
import sys
import time
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("r01_stage13", HERE / "capture-stage13-android.py")
stage13 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage13)
qa = stage13.qa

PROFILES = ("phone-412dp", "tablet-600dp")
VARIANTS = ("dark-100", "light-100")
ROUTE = f"project/{qa.PROJECT}/compare"
PNG = bytes.fromhex("89504e470d0a1a0a")


def bounds(raw):
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", raw or "")
    if not match:
        raise ValueError("Missing native UI bounds")
    return tuple(int(v) for v in match.groups())


def slider(xml):
    nodes = [n for n in ET.fromstring(xml).iter("node")
             if n.get("class") == "android.widget.SeekBar"
             and n.get("content-desc", "").startswith("첫 사진 표시 비율, ")]
    if len(nodes) != 1:
        raise ValueError(f"Expected exactly one real comparison SeekBar; got {len(nodes)}")
    node = nodes[0]
    label = node.get("content-desc", "")
    result = re.search(r"(\d+)%", label)
    if not result:
        raise ValueError("Comparison slider percentage missing from accessibility tree")
    return {"percent": int(result.group(1)), "bounds": bounds(node.get("bounds")), "label": label}


def photo_slide(device, rect, kind):
    x1, y1, x2, y2 = rect
    width, height = x2-x1, y2-y1
    x = x1 + round(width * 0.23)
    y = y1 + round(height * 0.73)
    if kind == "vertical":
        end = (x, y1 + round(height * 0.28))
    elif kind == "vertical-diagonal":
        end = (x + round(width * 0.05), y1 + round(height * 0.30))
    elif kind == "horizontal":
        end = (x1 + round(width * 0.60), y)
    elif kind == "horizontal-left":
        x = x1 + round(width * 0.75)
        end = (x1 + round(width * 0.39), y)
    else:
        raise ValueError("Unknown test gesture")
    assert x1 < x < x2 and x1 < end[0] < x2 and y1 < y < y2 and y1 < end[1] < y2
    device.shell("input", "swipe", x, y, end[0], end[1], 560)
    time.sleep(1.3)
    return {"kind": kind, "from": [x,y], "to": list(end), "durationMs": 560}


def save_state(device, folder, label, manifest):
    folder.mkdir(parents=True, exist_ok=True)
    xml = device.dump()
    data = device.run("exec-out", "screencap", "-p", binary=True)
    if not data.startswith(PNG):
        raise ValueError("Android did not return a PNG")
    dimensions = struct.unpack(">II", data[16:24])
    image = folder / f"{label}.png"
    image.write_bytes(data)
    (folder / f"{label}.xml").write_text(xml, encoding="utf-8")
    info = {
        "step": label, "path": str(image.relative_to(folder.parent.parent)),
        "sha256": hashlib.sha256(data).hexdigest(),
        "dimensions": dimensions, "capturedAt": datetime.now(timezone.utc).isoformat(),
        "slider": None,
        "visibleText": qa.ui_strings(xml)[:100],
    }
    try:
        info["slider"] = slider(xml)
    except ValueError:
        pass
    (folder / f"{label}.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest["screens"].append(info)
    return xml, info


def compare_route(device):
    device.open(ROUTE)
    return device.ready(["전후 사진 비교", "슬라이더", "나란히", "겹쳐보기"])


def run_variant(device, folder, profile, variant):
    theme, font, scale = stage13.ALL_VARIANTS[variant]
    device.shell("settings", "put", "system", "font_scale", scale)
    device.seed(True, font, theme_mode=theme)
    initial_photos = json.loads(device.storage()["travel-frame.photos.v1"])
    manifest = {
        "stage": "UI-R01", "profile": profile, "variant": variant,
        "capturedAt": datetime.now(timezone.utc).isoformat(), "screens": [],
        "checks": [], "status": "in_progress"
    }
    folder.mkdir(parents=True, exist_ok=True)

    def verify(name, condition, details):
        manifest["checks"].append({"name": name, "passed": bool(condition), "details": details})
        if not condition:
            raise AssertionError(f"UI-R01 {profile}/{variant} {name} failed: {details}")

    try:
        compare_route(device)
        _, first = save_state(device, folder, "01-slider-initial", manifest)
        before = first["slider"]
        verify("native-slider-discovered", before is not None and 10 <= before["percent"] <= 90, before)

        if profile == "phone-412dp":
            gesture = photo_slide(device, before["bounds"], "vertical")
            _, result = save_state(device, folder, "02-vertical-scroll", manifest)
            after = result["slider"]
            verify("vertical-scroll-within-photo",
                   after is not None and after["bounds"][1] < before["bounds"][1] - 22
                   and after["percent"] == before["percent"],
                   {"gesture": gesture, "before": before, "after": after})
            compare_route(device)
            pre_diagonal = slider(device.dump())
            gesture = photo_slide(device, pre_diagonal["bounds"], "vertical-diagonal")
            _, result = save_state(device, folder, "03-diagonal-vertical", manifest)
            after_diagonal = result["slider"]
            verify("diagonal-vertical-preserves-slider",
                   after_diagonal is not None and after_diagonal["percent"] == pre_diagonal["percent"]
                   and after_diagonal["bounds"][1] < pre_diagonal["bounds"][1]-22,
                   {"gesture": gesture, "before": pre_diagonal, "after": after_diagonal})

        compare_route(device)
        before_horizontal = slider(device.dump())
        gesture = photo_slide(device, before_horizontal["bounds"], "horizontal")
        _, post_horizontal = save_state(device, folder, "04-horizontal-right", manifest)
        after_horizontal = post_horizontal["slider"]
        verify("horizontal-photo-drag-adjusts-divider",
               after_horizontal is not None and after_horizontal["percent"] >= before_horizontal["percent"] + 7,
               {"gesture": gesture, "before": before_horizontal, "after": after_horizontal})

        compare_route(device)
        before_left = slider(device.dump())
        gesture = photo_slide(device, before_left["bounds"], "horizontal-left")
        _, post_left = save_state(device, folder, "05-horizontal-left", manifest)
        after_left = post_left["slider"]
        verify("horizontal-left-adjusts-divider",
               after_left is not None and after_left["percent"] <= before_left["percent"] - 7,
               {"gesture": gesture, "before": before_left, "after": after_left})

        compare_route(device)
        for value in (25, 50, 75):
            device.tap(f"첫 사진 표시 비율 {value}%")
            state = slider(device.dump())
            verify(f"preset-{value}", state["percent"] == value, state)
        save_state(device, folder, "06-presets", manifest)

        device.tap("나란히")
        xml = device.ready(["나란히", "이전 사진", "현재 사진"])
        verify("side-by-side-mode", "이전 사진" in qa.ui_strings(xml) and "현재 사진" in qa.ui_strings(xml), qa.ui_strings(xml)[-20:])
        save_state(device, folder, "07-side-by-side", manifest)

        device.tap("겹쳐보기")
        xml = device.ready(["겹쳐보기", "이전 사진 불투명도 25%"])
        verify("overlay-mode", "이전 사진 불투명도 25%" in qa.ui_strings(xml), qa.ui_strings(xml)[-30:])
        save_state(device, folder, "08-overlay", manifest)

        device.tap("비교할 사진 두 장 선택")
        xml = device.ready(["비교할 사진 선택", "이전 사진 선택", "현재 사진 선택"])
        verify("photo-picker", "현재 사진 선택" in qa.ui_strings(xml), qa.ui_strings(xml)[-30:])
        save_state(device, folder, "09-picker", manifest)
        device.tap("사진 선택 취소")
        verify("picker-dismissed", "이전 사진 선택" not in qa.ui_strings(device.dump()), "picker close")
        last_photos = json.loads(device.storage()["travel-frame.photos.v1"])
        verify("original-records-unchanged",
               [x["id"] for x in last_photos] == [x["id"] for x in initial_photos],
               {"initial": len(initial_photos), "final": len(last_photos)})
        manifest["status"] = "pass"
    except Exception as error:
        manifest["status"] = "fail"
        manifest["error"] = str(error)
        try:
            save_state(device, folder, "failure-actual-android", manifest)
        except Exception as diagnostics:
            manifest["diagnosticsError"] = str(diagnostics)
    finally:
        (folder / "gesture-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    dev = qa.Device()
    results = []
    try:
        if os.environ.get("BODY_FRAME_STORE_DEMO_FIXTURES") != "1":
            raise RuntimeError("QA-only synthetic demo photos must be enabled")
        if dev.shell("getprop", "ro.kernel.qemu").strip() != "1":
            raise RuntimeError("UI-R01 is emulator-only")
        dev.run("install", "-r", "-g", args.apk.resolve())
        qa.prepare_native_hierarchy(dev, args.output)
        dev.shell("svc", "wifi", "disable")
        dev.shell("svc", "data", "disable")
        for profile in PROFILES:
            size, density = stage13.ALL_PROFILES[profile]
            dev.shell("wm", "size", size)
            dev.shell("wm", "density", density)
            qa.wait_for_visual_profile(dev, size, density)
            for variant in VARIANTS:
                results.append(run_variant(dev, args.output / profile / variant, profile, variant))
    finally:
        dev.shell("am", "force-stop", qa.PACKAGE, check=False)
        dev.shell("wm", "size", "reset", check=False)
        dev.shell("wm", "density", "reset", check=False)
        dev.shell("settings", "put", "system", "font_scale", "1.0", check=False)
        report = {
            "stage": "UI-R01", "gitHead": os.environ.get("GITHUB_SHA", "local"),
            "apkSha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
            "expectedProfiles": len(PROFILES) * len(VARIANTS), "actualProfiles": len(results),
            "passedProfiles": sum(x.get("status") == "pass" for x in results),
            "failedProfiles": [f"{x['profile']}/{x['variant']}" for x in results if x.get("status") != "pass"],
            "note": "Real Android emulator input/swipe; physical-finger and TalkBack manual QA not claimed",
        }
        (args.output / "ui-r01-summary.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False), flush=True)
    if len(results) != len(PROFILES) * len(VARIANTS) or report["failedProfiles"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
