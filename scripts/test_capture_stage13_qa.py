#!/usr/bin/env python3
"""Host-only checks for the Stage 13 screenshot matrix and gallery."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

SCRIPT = Path(__file__).resolve().with_name("capture-stage13-android.py")
SPEC = importlib.util.spec_from_file_location("body_frame_stage13_test_target", SCRIPT)
stage13 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage13)


class Stage13CaptureTest(unittest.TestCase):
    def test_all_four_android_screen_widths_have_expected_profiles(self):
        self.assertEqual(set(stage13.ALL_PROFILES), {
            "phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"
        })
        self.assertEqual([
            round(int(size.split("x")[0]) * 160 / dpi)
            for size, dpi in stage13.ALL_PROFILES.values()
        ], [360, 412, 600, 750])

    def test_all_primary_pages_and_options_have_distinct_names(self):
        names = [case[0] for case in stage13.CASES]
        self.assertEqual(len(names), len(set(names)))
        self.assertGreaterEqual(len(names), 27)
        for needed in ("camera", "records", "project", "project-metrics", "project-stats",
                       "compare", "photo", "measurements", "video-home", "video-create",
                       "video-library", "settings", "account", "video-overlay"):
            self.assertIn(needed, names)
        self.assertTrue(stage13.CORE.issubset(set(names)))
        self.assertTrue(stage13.LARGE_TEXT.issubset(set(names)))
        self.assertIn("new-project", [item[0] for item in stage13.ADDITIONAL])
        self.assertIn("empty-projects", [item[0] for item in stage13.ADDITIONAL])
        self.assertIn("camera-project-picker", names)
        self.assertIn("camera-new-project", names)
        self.assertIn("camera-new-project", stage13.CORE)
        self.assertIn("camera-new-project", stage13.LARGE_TEXT)


    def test_c2_camera_project_sheet_actions_follow_native_controls(self):
        device = Mock()
        stage13.open_camera_new_project(device)
        device.ready.assert_called_once_with(["프로젝트 선택", "사진 촬영"])
        self.assertEqual(device.open_control.call_args_list, [
            call("프로젝트 선택", ["내 프로젝트", "프로젝트 관리"]),
            call("+ 새 프로젝트", ["프로젝트 이름", "목표 기록 수", "프로젝트 만들기"]),
        ])

    def test_stage_d_light_150_still_separates_first_install_and_replayed_guide(self):
        self.assertEqual(stage13.ALL_VARIANTS["light-150"], ("light", "large", 1.5))
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"light-150"', source)
        self.assertIn('"onboarding-first-run-light-large"', source)
        self.assertIn('"new-project-light-large"', source)
        self.assertIn("intro_seen=False", source)
        self.assertIn("device.seed(False, font, theme_mode=theme)", source)
        self.assertIn("qa.onboarding_welcome", source)
        self.assertIn("emulator-only", source)

    def test_gallery_captures_success_and_failure_without_claiming_visual_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            screen = out / "dark-100"
            screen.mkdir()
            (screen / "compare.png").write_bytes(b"fixture")
            (screen / "settings.failure.png").write_bytes(b"failure")
            manifest = {
                "profile": "phone-360dp",
                "apkSha256": "2" * 64,
                "captures": [
                    dict(screen="compare", variant="dark-100", label="전후 사진 비교",
                         route="project/qa-demo-project/compare", status="captured",
                         width=720, height=1600),
                    dict(screen="settings", variant="dark-100", label="설정",
                         route="settings", status="failed",
                         error="Expected UI did not appear"),
                ],
            }
            stage13.write_report(out, manifest)
            text = (out / "gallery.html").read_text(encoding="utf-8")
            self.assertIn("전후 사진 비교", text)
            self.assertIn("dark-100/compare.png", text)
            self.assertIn("dark-100/settings.failure.png", text)
            self.assertIn("실제 인물 사진", text)
            self.assertIn("Expected UI did not appear", text)
            data = json.loads((out / "capture-manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(data["captures"][1]["status"], "failed")
            self.assertEqual(len((out / "screen-index.csv").read_text(encoding="utf-8-sig").splitlines()), 3)

    def test_black_or_uniform_frame_cannot_pass_visual_capture(self):
        self.assertFalse(stage13.rgb_preview_is_reviewable(bytes(32 * 32 * 3)))
        self.assertFalse(stage13.rgb_preview_is_reviewable(bytes([18]) * (32 * 32 * 3)))
        self.assertFalse(stage13.rgb_preview_is_reviewable(bytes(50)))
        self.assertTrue(stage13.rgb_preview_is_reviewable(
            bytes([0]) * (32 * 32) + bytes([220]) * (32 * 32 * 2)
        ))

    def test_blank_capture_is_preserved_as_failed_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            screenshot = folder / "records.png"
            screenshot.write_bytes(b"PNG test content")
            with patch.object(stage13.qa, "capture", return_value={"status": "captured"}), \
                    patch.object(stage13.subprocess, "run",
                                 return_value=SimpleNamespace(stdout=bytes(32 * 32 * 3))):
                result = stage13.verified_capture(None, folder, "records", "studio", [])
            self.assertEqual(result["status"], "failed")
            self.assertIs(result["pixelEvidenceValid"], False)
            self.assertIn("Unusable Android screenshot", result["error"])
            self.assertTrue((folder / "records.failure.png").exists())
            self.assertFalse(screenshot.exists())

    def test_script_rejects_physical_devices_and_disables_network(self):
        contents = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('device.shell("getprop", "ro.kernel.qemu")', contents)
        self.assertIn('device.shell("svc", "wifi", "disable")', contents)
        self.assertIn('device.shell("svc", "data", "disable")', contents)
        self.assertNotIn("purchase(", contents)
        self.assertNotIn("signIn(", contents)


if __name__ == "__main__":
    unittest.main()
