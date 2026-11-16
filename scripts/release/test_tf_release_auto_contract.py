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

    def test_each_release_mode_has_its_own_approval(self):
        cases = (
            ("build", "TF_BUILD_APPROVED", {}),
            ("internal", "TF_INTERNAL_APPROVED", {"TF_BUILD_RUN_ID": "42"}),
            ("closed", "TF_CLOSED_APPROVED", {"TF_BUILD_RUN_ID": "42"}),
        )
        for mode, approval, inputs in cases:
            with self.subTest(mode=mode):
                env = authorized(TF_MODE=mode, TF_BUILD_APPROVED="false",
                                 TF_INTERNAL_APPROVED="false", TF_CLOSED_APPROVED="false",
                                 **inputs)
                with self.assertRaises(tf.ReleaseGateError):
                    tf.parse_approval(env)
                self.assertEqual(tf.parse_approval({**env, approval: "true"})["mode"], mode)

    def test_publish_only_modes_require_an_existing_build_run(self):
        for mode in ("internal", "closed"):
            for run in ("", "0", "../42"):
                with self.subTest(mode=mode, run=run), self.assertRaises(tf.ReleaseGateError):
                    tf.parse_approval(authorized(TF_MODE=mode, TF_BUILD_RUN_ID=run))


class GateTests(unittest.TestCase):
    def test_existing_build_run_must_be_a_successful_build_only_run_from_exact_main(self):
        run = {"id": 42, "head_sha": "a" * 40, "head_branch": "main", "event": "workflow_dispatch",
               "status": "completed", "conclusion": "success", "repository": {"full_name": tf.REPOSITORY},
               "path": ".github/workflows/android-play-aab.yml",
               "display_title": "TravelFrame Play build · internal · main · manual"}
        with patch.object(tf, "api", return_value=run):
            tf.verify_existing_build_run(42, "a" * 40)
        for mismatch in ({"head_sha": "b" * 40}, {"path": ".github/workflows/quality.yml"},
                         {"display_title": "TravelFrame Play deploy · internal · main · manual"},
                         {"conclusion": "failure"}):
            with self.subTest(mismatch=mismatch), patch.object(tf, "api", return_value={**run, **mismatch}):
                with self.assertRaises(tf.ReleaseGateError):
                    tf.verify_existing_build_run(42, "a" * 40)
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
            "source_track": "internal", "closed_track": "alpha",
        }
        plan = tf.parse_approval(authorized())
        tf.validate_closed_receipt(receipt, build, plan)
        for mismatch in ({"version_code": 26092624}, {"closed_track": "beta"}):
            with self.subTest(mismatch=mismatch), self.assertRaises(tf.ReleaseGateError):
                tf.validate_closed_receipt({**receipt, **mismatch}, build, plan)

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


class StageSelectionTests(unittest.TestCase):
    def test_only_requested_stages_are_dispatched(self):
        build = {"artifact_name": "body-frame-play-43-42-1", "version_code": 43,
                 "version_name": "1.0.0", "aab_sha256": "f" * 64}
        build_workflows = ["body-frame-device-qa.yml", "android-play-aab.yml"]
        internal_workflows = ["play-internal-release.yml"] * 2
        closed_workflows = ["play-closed-release.yml"] * 2
        cases = {
            "build": (build_workflows, "signed-aab-verified"),
            "internal": (internal_workflows, "committed-and-read-back"),
            "closed": (closed_workflows, "committed-and-read-back"),
            "deploy": (build_workflows + internal_workflows + closed_workflows, "committed-and-read-back"),
        }
        for mode, (workflows, status) in cases.items():
            with (self.subTest(mode=mode), patch.dict(os.environ, {"GITHUB_RUN_ID": "25"}),
                  patch.object(tf, "wait_main_checks"), patch.object(tf, "verify_existing_build_run") as reuse,
                  patch.object(tf, "require_native_jobs"), patch.object(tf, "load_build", return_value=build),
                  patch.object(tf, "dispatch_and_wait", side_effect=range(100, 106)) as dispatch,
                  patch.object(tf, "load_receipt", return_value={"status": "committed_and_read_back"}),
                  patch.object(tf, "validate_internal_receipt"), patch.object(tf, "validate_closed_receipt"),
                  patch.object(tf, "save_result"), patch.object(tf, "append_summary") as summary):
                run = "42" if mode in ("internal", "closed") else ""
                plan = tf.parse_approval(authorized(TF_MODE=mode, TF_BUILD_APPROVED="true",
                                                    TF_BUILD_RUN_ID=run))
                tf.execute(plan)
                self.assertEqual([c.args[0] for c in dispatch.call_args_list], workflows)
                self.assertEqual(summary.call_args.args[0]["status"], status)
                if run:
                    reuse.assert_called_once_with(42, plan["source_sha"])
                else:
                    reuse.assert_not_called()


if __name__ == "__main__":
    unittest.main()
