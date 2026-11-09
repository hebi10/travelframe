#!/usr/bin/env python3
"""Host-only tests for strict C7 Android visual evidence review."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().with_name("verify-frame-journal-c7.py")
SPEC = importlib.util.spec_from_file_location("frame_journal_c7", SCRIPT)
c7 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(c7)


class FrameJournalC7Test(unittest.TestCase):
    def test_matrix_is_complete_and_contains_main_four_tabs(self):
        self.assertEqual(len(c7.PROFILES) * len(c7.VARIANTS), 24)
        self.assertEqual(set(c7.VARIANTS), {
            "dark-100", "light-100", "dark-130", "light-130", "dark-150", "light-150"
        })
        self.assertTrue({"camera", "records", "video-home", "settings"}.issubset(c7.PRIMARY))
        self.assertIn("measurements", c7.PRIMARY)
        self.assertIn("camera-color-panel", c7.FULL_EXTRA)
        self.assertIn("camera-permission-denied", c7.ACTION_REQUIREMENTS)

    def test_real_clickable_button_bounds_are_required(self):
        xml = (
            '<hierarchy>'
            '<node text="시작하기" enabled="true" clickable="true" bounds="[12,50][210,110]"/>'
            '</hierarchy>'
        )
        self.assertEqual(c7.native_action_bounds(xml, "시작하기", 360, 640), [12, 50, 210, 110])
        with self.assertRaisesRegex(ValueError, "Enabled on-screen"):
            c7.native_action_bounds(xml, "나중에 보기", 360, 640)
        invalid = xml.replace('enabled="true"', 'enabled="false"')
        with self.assertRaisesRegex(ValueError, "Enabled on-screen"):
            c7.native_action_bounds(invalid, "시작하기", 360, 640)
        offscreen = xml.replace("[12,50][210,110]", "[12,630][210,670]")
        with self.assertRaisesRegex(ValueError, "Enabled on-screen"):
            c7.native_action_bounds(offscreen, "시작하기", 360, 640)

    def test_large_font_create_project_button_must_not_split_into_two_lines(self):
        def text_node(top, bottom):
            return (
                '<hierarchy><node class="android.widget.TextView" text="프로젝트 만들기" '
                f'enabled="true" bounds="[396,{top}][660,{bottom}]"/></hierarchy>'
            )
        self.assertEqual(c7.project_create_button_text_height_dp(text_node(1400, 1452), 320), 26)
        with self.assertRaisesRegex(ValueError, "still wraps"):
            c7.project_create_button_text_height_dp(text_node(1386, 1524), 320)
        records_xml = (
            '<hierarchy><node class="android.widget.TextView" text="새 프로젝트" '
            'bounds="[80,461][284,660]"/></hierarchy>'
        )
        with self.assertRaisesRegex(ValueError, "still wraps"):
            c7.project_create_button_text_height_dp(records_xml, 320, "새 프로젝트")
        with self.assertRaisesRegex(ValueError, "text node"):
            c7.project_create_button_text_height_dp('<hierarchy/>', 320)

    def test_missing_profile_fails_and_preserves_failure_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, output = Path(tmp) / "capture", Path(tmp) / "reports"
            root.mkdir()
            report = c7.build_report(root, output)
            self.assertEqual(report["result"], "FAIL")
            self.assertEqual(report["actualCells"], 0)
            self.assertTrue(any("missing capture-manifest.json" in problem for problem in report["problems"]))
            self.assertTrue((output / "c7-report.json").is_file())
            self.assertTrue((output / "c7-report.md").is_file())

    def test_mismatched_native_commit_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            profile = root / "phone-360dp"
            profile.mkdir()
            (profile / "capture-manifest.json").write_text(json.dumps({
                "profile": "phone-360dp",
                "sourceCommit": "local",
                "prHeadCommit": "unknown",
                "captureMatrix": ["dark-100"],
                "passed": 0,
                "failed": 0,
                "captures": [],
            }), encoding="utf-8")
            problems = []
            result = c7.analyze_profile(profile, problems)
            self.assertIsNotNone(result)
            self.assertTrue(any("source commit" in p for p in problems))
            self.assertTrue(any("HEAD commit" in p for p in problems))
            self.assertTrue(any("six C7 variants" in p for p in problems))

if __name__ == "__main__":
    unittest.main()
