#!/usr/bin/env python3
"""Host-only contract tests for native UI-R01/UI-R02 QA evidence."""
from pathlib import Path
import importlib.util
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parent

def import_script(filename, module_name):
    spec = importlib.util.spec_from_file_location(module_name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

r01 = import_script("verify_ui_r01_android_gestures.py", "r01_contract")
r02 = import_script("verify_ui_r02_android_camera.py", "r02_contract")
verify = import_script("verify_ui_r01_r02_reports.py", "r0102_contract")

class NativeQAContract(unittest.TestCase):
    def test_real_seekbar_parsing(self):
        xml = '<hierarchy><node class="android.widget.SeekBar" content-desc="첫 사진 표시 비율, 50%" bounds="[32,572][792,1585]" /></hierarchy>'
        self.assertEqual(r01.slider(xml)["percent"], 50)
        self.assertEqual(r01.slider(xml)["bounds"], (32,572,792,1585))
        with self.assertRaises(ValueError):
            r01.slider('<hierarchy><node text="슬라이더"/></hierarchy>')

    def test_native_direction_vectors(self):
        fake = Mock()
        with patch.object(r01.time, "sleep", lambda _s: None):
            for kind in ("vertical", "vertical-diagonal", "horizontal", "horizontal-left"):
                action = r01.photo_slide(fake, (32,572,792,1585), kind)
                sx,sy = action["from"]; ex,ey = action["to"]
                if kind.startswith("vertical"):
                    self.assertGreater(abs(ey-sy), abs(ex-sx)*2)
                else:
                    self.assertGreater(abs(ex-sx), abs(ey-sy)*2)
        self.assertEqual(fake.shell.call_count, 4)

    def test_camera_hardware_remains_unverified(self):
        self.assertEqual(r02.PROFILES, ("phone-412dp","tablet-600dp"))
        self.assertEqual(r02.VARIANTS, ("dark-100","light-100"))
        self.assertEqual(len(r02.SCREENS), 8)
        source = (ROOT / "verify_ui_r02_android_camera.py").read_text(encoding="utf-8")
        for name in ("PENDING_ARM64_REAL_DEVICE", "nativeCameraPreviewTested",
                     "camera-permission-denied", "camera-color-panel",
                     "camera-guide-settings", "ro.kernel.qemu"):
            self.assertIn(name, source)

    def test_report_expected_cells_and_original_evidence(self):
        self.assertEqual(len(verify.PROFILES)*len(verify.VARIANTS), 4)
        self.assertEqual(len(verify.PNG_SIGNATURE), 8)

if __name__ == "__main__":
    unittest.main()
