"""Offline fail-closed contract tests for TF-RELEASE-AUTO-01."""
import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import patch

PATH = Path(__file__).with_name("tf_release_orchestrator.py")
SPEC = importlib.util.spec_from_file_location("tf_release_orchestrator", PATH)
tf = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tf)


def authorized(**changes):
    env = {
        "GITHUB_REPOSITORY": "hebi10/travelframe",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_SHA": "a" * 40,
        "TF_EXPECTED_MAIN_SHA": "a" * 40,
        "TF_MODE": "deploy",
        "TF_BATCH_ID": "2026-11-16-travelframe",
        "TF_INTERNAL_APPROVED": "true",
        "TF_CLOSED_APPROVED": "true",
        "TF_PLAY_INTERNAL_TRACK": "internal",
        "TF_PLAY_CLOSED_TRACK": "alpha",
    }
    env.update(changes)
    return env


class AuthorizationTests(unittest.TestCase):
    def test_exact_manual_main_and_separate_approvals(self):
        plan = tf.parse_approval(authorized())
        self.assertTrue(plan["internal_approved"] and plan["closed_approved"])

    def test_push_and_pr_cannot_publish(self):
        for event in ("push", "pull_request", "pull_request_target", "workflow_run"):
            with self.subTest(event=event), self.assertRaises(tf.ReleaseGateError):
                tf.parse_approval(authorized(GITHUB_EVENT_NAME=event))

    def test_both_approvals_are_mandatory_for_deploy(self):
        for field in ("TF_INTERNAL_APPROVED", "TF_CLOSED_APPROVED"):
            with self.subTest(field=field), self.assertRaises(tf.ReleaseGateError):
                tf.parse_approval(authorized(**{field: "false"}))

    def test_moved_or_untrusted_main_is_rejected(self):
        for change in ({"GITHUB_SHA": "b" * 40},
                       {"GITHUB_REF": "refs/heads/feature"},
                       {"GITHUB_REPOSITORY": "other/repository"},
                       {"TF_EXPECTED_MAIN_SHA": "not-a-sha"}):
            with self.subTest(change=change), self.assertRaises(tf.ReleaseGateError):
                tf.parse_approval(authorized(**change))

    def test_production_and_unverified_track_are_rejected(self):
        for track in ("production", "beta", "internal", "qa", "alpha;rm -rf", ""):
            with self.subTest(track=track), self.assertRaises(tf.ReleaseGateError):
                tf.parse_approval(authorized(TF_PLAY_CLOSED_TRACK=track))

    def test_check_mode_does_not_require_publish_approval(self):
        result = tf.parse_approval(authorized(TF_MODE="check", TF_INTERNAL_APPROVED="false",
                                              TF_CLOSED_APPROVED="false"))
        self.assertEqual(result["mode"], "check")


class GateTests(unittest.TestCase):
    def test_native_all_required_jobs_must_succeed(self):
        jobs = [{"name": name, "conclusion": "success"} for name in tf.NATIVE_JOBS]
        with patch.object(tf, "api", return_value={"total_count": len(jobs), "jobs": jobs}):
            tf.require_native_jobs(12)
            jobs[3]["conclusion"] = "skipped"
            with self.assertRaises(tf.ReleaseGateError):
                tf.require_native_jobs(12)

    def test_closed_receipt_must_be_same_version_and_no_new_binary(self):
        build = {"version_code": 26092623, "aab_sha256": "f" * 64}
        receipt = {
            "status": "committed_and_read_back",
            "package": tf.PACKAGE, "source_sha": "a" * 40,
            "batch_id": "2026-11-16-travelframe",
            "version_code": 26092623, "aab_sha256": "f" * 64,
            "binary_uploaded": False, "aab_rebuilt": False,
        }
        tf.validate_closed_receipt(receipt, build, "a" * 40, "2026-11-16-travelframe")
        receipt["version_code"] += 1
        with self.assertRaises(tf.ReleaseGateError):
            tf.validate_closed_receipt(receipt, build, "a" * 40, "2026-11-16-travelframe")

    def test_internal_readback_requires_exact_aab(self):
        build = {"version_code": 26092623, "aab_sha256": "f" * 64}
        receipt = {
            "status": "committed-and-read-back", "packageId": tf.PACKAGE,
            "sourceSha": "a" * 40, "logicalTrack": "internal",
            "apiTrack": "internal", "versionCode": 26092623,
            "aabSha256": "f" * 64,
        }
        tf.validate_internal_receipt(receipt, build, "a" * 40, "internal")
        receipt["status"] = "committed-readback-unverified"
        with self.assertRaises(tf.ReleaseGateError):
            tf.validate_internal_receipt(receipt, build, "a" * 40, "internal")


if __name__ == "__main__":
    unittest.main()
