#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('trust',Path(__file__).with_name('verify-android-qa-apk.py'))
trust=importlib.util.module_from_spec(spec);spec.loader.exec_module(trust)

class TrustPathsTest(unittest.TestCase):
    def test_capture_and_server_changes_are_explicitly_allowed(self):
        for path in ['scripts/capture-android-qa.py','scripts/android-qa-apk-selection.json','.github/workflows/body-frame-device-recapture.yml','functions/index.js','tests/backend-body-frame-capacity-delete.test.mjs','tests/firebase-rules-emulator-runner.mjs','.superpowers/sdd/report.md']:
            self.assertTrue(trust.capture_only(path),path)

    def test_every_compiled_client_and_build_input_change_requires_rebuild(self):
        for path in ['app/edit.tsx','components/photo.tsx','features/camera/CameraScreen.tsx','lib/body-frame-video.ts','plugins/native.js','assets/font.ttf','package-lock.json','package.json','app.json','scripts/apply-patches.mjs','scripts/prebuild-android-ci.mjs','metro.config.js','android/build.gradle','app/tests/native.tsx','tests-not-client/file.js','unknown.txt']:
            self.assertFalse(trust.capture_only(path),path)

    def test_client_fingerprint_ignores_server_but_detects_client_blob_changes(self):
        baseline='100644 blob aaa\tlib/video.ts\0'+'100644 blob bbb\tfunctions/index.js\0'
        server_change=baseline.replace('bbb','ccc')
        client_change=baseline.replace('aaa','ddd')
        with patch.object(trust,'git',side_effect=[baseline,server_change,client_change]):
            first=trust.client_fingerprint('a')
            self.assertEqual(first,trust.client_fingerprint('b'))
            self.assertNotEqual(first,trust.client_fingerprint('c'))

    def test_root_build_environment_and_run_defaults_are_compilation_inputs(self):
        workflow='name: QA\nenv:\n  BUILD_MODE: production\ndefaults:\n  run:\n    shell: bash\njobs:\n  build-apk:\n    steps: []\n  capture-devices:\n    steps: []\n'
        changed_env=workflow.replace('production','development')
        changed_defaults=workflow.replace('shell: bash','shell: sh')
        changed_capture=workflow.replace('  capture-devices:\n    steps: []','  capture-devices:\n    timeout-minutes: 50')
        with patch.object(trust,'git',side_effect=[workflow,changed_env,changed_defaults,changed_capture]):
            baseline=trust.build_context('a')
            self.assertNotEqual(baseline,trust.build_context('b'))
            self.assertNotEqual(baseline,trust.build_context('c'))
            self.assertEqual(baseline,trust.build_context('d'))

if __name__=='__main__':unittest.main()
