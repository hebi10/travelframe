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

    def test_c3_camera_settings_capture_opens_real_native_sheet(self):
        device = Mock()
        stage13.open_camera_settings(device)
        device.ready.assert_called_once_with(["프로젝트 선택", "사진 촬영"])
        device.open_control.assert_called_once_with(
            "촬영 설정 열기", ["촬영 도구", "촬영 옵션"]
        )

    def test_c3_storage_capture_finds_enabled_album_option(self):
        device = Mock()
        stage13.open_camera_save_targets(device)
        device.find_control.assert_called_once_with("핸드폰 앨범", search="below")
        names = [case[0] for case in stage13.CASES]
        for case in ("camera-settings", "camera-settings-storage"):
            self.assertIn(case, names)

    def test_c4_camera_guide_settings_opens_from_native_camera_tools(self):
        device = Mock()
        stage13.open_camera_guide_settings(device)
        self.assertEqual(device.open_control.call_args_list, [
            call("촬영 설정 열기", ["촬영 도구", "촬영 옵션"]),
            call("라인 가이드 설정 열기", ["가이드 설정", "가이드라인"]),
        ])
        self.assertIn("camera-guide-settings", [item[0] for item in stage13.CASES])

    def test_c4_reference_adjustment_uses_existing_accessible_opacity_control(self):
        device = Mock()
        device.dump.return_value = (
            '<hierarchy><node content-desc="기준 사진 투명도 42퍼센트"/></hierarchy>'
        )
        stage13.open_camera_reference_setup(device)
        device.open_control.assert_called_once_with(
            "기준 사진 투명도 42퍼센트", ["기준 사진 조정", "확인"]
        )
        self.assertIn("camera-reference-adjust", [item[0] for item in stage13.CASES])

    def test_c4_reference_adjustment_requires_one_unambiguous_source(self):
        device = Mock()
        device.dump.return_value = '<hierarchy><node content-desc="다른 동작"/></hierarchy>'
        with self.assertRaisesRegex(RuntimeError, "Exactly one reference photo"):
            stage13.open_camera_reference_setup(device)
        device.open_control.assert_not_called()

    def test_c5_color_save_and_reset_are_visible_without_scrolling(self):
        device = Mock()
        device.viewport.return_value = (0, 24, 720, 1500)
        device.dump.return_value = (
            '<hierarchy>'
            '<node content-desc="선택한 색감 슬롯에 현재 설정 저장" clickable="true" '
            'enabled="true" bounds="[12,1400][280,1460]"/>'
            '<node content-desc="색감 조절값 초기화" clickable="true" '
            'enabled="true" bounds="[300,1400][520,1460]"/>'
            '<node class="android.widget.ScrollView"/>'
            '</hierarchy>'
        )
        stage13.open_camera_color_panel(device)
        self.assertEqual(device.open_control.call_args_list, [
            call("촬영 설정 열기", ["촬영 도구", "촬영 옵션"]),
            call("색감 설정 열기", ["색감", "저장 슬롯", "설정 저장"]),
        ])
        device.viewport.assert_called()
        self.assertIn("camera-color-panel", stage13.CORE)
        self.assertIn("camera-color-panel", stage13.LARGE_TEXT)

    def test_c5_color_footer_outside_viewport_is_rejected(self):
        device = Mock()
        device.viewport.return_value = (0, 24, 720, 1500)
        device.dump.return_value = (
            '<hierarchy>'
            '<node content-desc="선택한 색감 슬롯에 현재 설정 저장" clickable="true" '
            'enabled="true" bounds="[12,1510][280,1560]"/>'
            '<node content-desc="색감 조절값 초기화" clickable="true" '
            'enabled="true" bounds="[300,1400][520,1460]"/>'
            '<node class="android.widget.ScrollView"/>'
            '</hierarchy>'
        )
        with self.assertRaisesRegex(RuntimeError, "outside the usable viewport"):
            stage13.open_camera_color_panel(device)

    def test_c5_zoom_and_light_open_from_camera_tools(self):
        zoom = Mock()
        stage13.open_camera_zoom_panel(zoom)
        self.assertEqual(zoom.open_control.call_args_list, [
            call("촬영 설정 열기", ["촬영 도구", "촬영 옵션"]),
            call("확대 설정 열기", ["확대", "1x"]),
        ])
        light = Mock()
        stage13.open_camera_light_panel(light)
        self.assertEqual(light.open_control.call_args_list, [
            call("촬영 설정 열기", ["촬영 도구", "촬영 옵션"]),
            call("라이트 설정 열기", ["조명", "끄기", "켜기"]),
        ])
        names = [case[0] for case in stage13.CASES]
        self.assertIn("camera-zoom-panel", names)
        self.assertIn("camera-light-panel", names)

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
