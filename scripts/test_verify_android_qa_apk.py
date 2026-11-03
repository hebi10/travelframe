#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('trust',Path(__file__).with_name('verify-android-qa-apk.py'))
trust=importlib.util.module_from_spec(spec);spec.loader.exec_module(trust)

class TrustPathsTest(unittest.TestCase):
    def test_capture_and_server_changes_are_explicitly_allowed(self):
        for path in ['scripts/capture-android-qa.py','scripts/android-qa-apk-selection.json','.github/workflows/body-frame-device-recapture.yml','functions/index.js','.superpowers/sdd/report.md']:
            self.assertTrue(trust.capture_only(path),path)

    def test_every_compiled_client_and_build_input_change_requires_rebuild(self):
        for path in ['app/edit.tsx','components/photo.tsx','features/camera/CameraScreen.tsx','lib/body-frame-video.ts','plugins/native.js','assets/font.ttf','package-lock.json','package.json','app.json','scripts/apply-patches.mjs','scripts/prebuild-android-ci.mjs','metro.config.js','android/build.gradle','unknown.txt']:
            self.assertFalse(trust.capture_only(path),path)

    def test_client_fingerprint_ignores_server_but_detects_client_blob_changes(self):
        baseline='100644 blob aaa\tlib/video.ts\0'+'100644 blob bbb\tfunctions/index.js\0'
        server_change=baseline.replace('bbb','ccc')
        client_change=baseline.replace('aaa','ddd')
        with patch.object(trust,'git',side_effect=[baseline,server_change,client_change]):
            first=trust.client_fingerprint('a')
            self.assertEqual(first,trust.client_fingerprint('b'))
            self.assertNotEqual(first,trust.client_fingerprint('c'))

if __name__=='__main__':unittest.main()
