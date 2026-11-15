"""Offline OPS-07 automatic-event and release authorization negative fixtures."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("ops07audit", ROOT / "scripts/ops07/audit.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def module(path):
    full = ROOT / path
    if not full.is_file():
        return None
    spec = importlib.util.spec_from_file_location("ops07_" + full.stem, full)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class NegativeScenarios(unittest.TestCase):
    def test_auto_publisher_is_detected(self):
        for event in ("push","workflow_run","issue_comment"):
            with self.subTest(event=event):
                example = ("on:\n  "+event+":\n    types: [completed]\n"
                           "jobs:\n  publish:\n    if: needs.gate.outputs.ready == 'true'\n"
                           "    runs-on: ubuntu-latest\n    steps:\n      - run: python3 publisher.py deploy\n")
                self.assertTrue(audit.automatic_mutations("play-release.yml", example))

    def test_manual_or_disabled_publisher_is_allowed(self):
        example = ("on:\n  workflow_run:\n    types: [completed]\n  workflow_dispatch:\n"
                   "jobs:\n  publish:\n    if: github.event_name == 'workflow_dispatch' && inputs.approved == true\n"
                   "    runs-on: ubuntu-latest\n    steps:\n      - run: python3 publisher.py deploy\n"
                   "  release:\n    if: >-\n      false && github.event_name == 'workflow_run'\n"
                   "    runs-on: ubuntu-latest\n    steps:\n      - run: gh release create v1\n")
        self.assertEqual(audit.automatic_mutations("play-release.yml", example), [])

    def test_manual_or_auto_condition_does_not_count_as_approval(self):
        example = ("on:\n  workflow_run:\n    types: [completed]\n  workflow_dispatch:\n"
                   "jobs:\n  upload:\n    if: >-\n"
                   "      github.event_name == 'workflow_dispatch' ||\n"
                   "      github.event_name == 'workflow_run'\n"
                   "    runs-on: ubuntu-latest\n    steps:\n      - run: python3 listing.py --apply\n")
        self.assertTrue(audit.automatic_mutations("store-listing.yml", example))


class AppContracts(unittest.TestCase):
    def test_all_release_stages_and_no_automatic_publishers(self):
        problems = audit.findings()
        self.assertEqual(problems, [], "\n".join(problems))

    def test_mismatched_source_and_fake_store_approval(self):
        mod = module("scripts/ops06/store_gate.py")
        self.assertIsNotNone(mod, "OPS-06 store guard is not present")
        env = {"GITHUB_REPOSITORY": audit.REPOSITORY, "GITHUB_EVENT_NAME": "workflow_dispatch",
               "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": "a"*40,
               "OPS06_EXPECTED_MAIN_SHA": "a"*40, "OPS06_STORE_APPROVED": "true",
               "OPS06_CONFIRMATION": mod.PHRASE,
               "OPS06_BATCH_ID": "2026-11-13-"+mod.APP_SLUG}
        for key, value in (("GITHUB_EVENT_NAME", "workflow_run"),
                           ("GITHUB_REF", "refs/heads/feature"),
                           ("OPS06_STORE_APPROVED", "false"),
                           ("OPS06_CONFIRMATION", "WRONG"),
                           ("OPS06_EXPECTED_MAIN_SHA", "b"*40)):
            with self.subTest(key=key):
                with patch.object(mod, "command_output") as network:
                    with self.assertRaises(mod.StoreApprovalError):
                        mod.verify({**env,key:value})
                    network.assert_not_called()

    def test_unapproved_closed_track_wrong_bundle_and_draft(self):
        mod = module("scripts/ops05/promotion.py")
        self.assertIsNotNone(mod, "OPS-05 closed promotion source missing")
        env = {"GITHUB_EVENT_NAME":"workflow_dispatch","GITHUB_REF":"refs/heads/main",
               "GITHUB_REPOSITORY":audit.REPOSITORY,"EXPECTED_REPO":audit.REPOSITORY,
               "GITHUB_SHA":"a"*40,"EXPECTED_MAIN_SHA":"a"*40,
               "BATCH_ID":"2026-11-13-ops07","APP_PACKAGE":audit.PACKAGE,
               "INTERNAL_TRACK":"internal","CLOSED_TRACK":"alpha",
               "VERSION_CODE":"19","AAB_SHA256":"b"*64,"MODE":"promote",
               "FINAL_BATCH_APPROVED":"true","APPROVAL_PHRASE":mod.APPROVAL,
               "HOMECREW_FINAL_APPROVAL":"HOMECREW_FINAL_RELEASE_APPROVED"}
        for key, value in (("FINAL_BATCH_APPROVED","false"),
                           ("AAB_SHA256","z"*64),
                           ("CLOSED_TRACK","production"),
                           ("CLOSED_TRACK","internal"),
                           ("EXPECTED_MAIN_SHA","c"*40)):
            with self.subTest(key=key,value=value):
                with self.assertRaises(mod.Stop):
                    mod.parse_request({**env,key:value})
        req=mod.parse_request(env)
        tracks=[{"track":"internal","releases":[
            {"status":"completed","versionCodes":["19"],"name":"1.0"}]},
            {"track":"alpha","releases":[]}]
        self.assertEqual(mod.make_plan(tracks,[{"versionCode":19,"sha256":"b"*64}],req)["state"],"ready")
        with self.assertRaises(mod.Stop):
            mod.make_plan(tracks,[{"versionCode":19,"sha256":"c"*64}],req)
        tracks[0]["releases"][0]["status"]="draft"
        with self.assertRaises(mod.Stop):
            mod.make_plan(tracks,[{"versionCode":19,"sha256":"b"*64}],req)

    def test_build_request_approval_cannot_be_bypassed(self):
        path = ".github/workflows/release-build.yml"
        original_read = audit.read
        original = original_read(path)
        gate = "      - name: Gate release batch, main SHA and required CI\n"
        dispatch = "      - name: Dispatch existing signed AAB build-only mode\n"
        self.assertIn(gate, original)
        self.assertIn(dispatch, original)
        variants = (
            ("missing_gate", original.replace(gate, "", 1)),
            ("skipped_gate", original.replace(gate, gate + "        if: false\n", 1)),
            ("nonblocking_gate", original.replace(gate, gate + "        continue-on-error: true\n", 1)),
            ("always_dispatch", original.replace(dispatch, dispatch + "        if: always()\n", 1)),
            ("forged_approval", original.replace(
                "FINAL_BATCH_APPROVED: " + "$" + "{{ inputs.final_batch_approved }}",
                "FINAL_BATCH_APPROVED: 'true'", 1)),
            ("forged_sha", original.replace(
                "EXPECTED_MAIN_SHA: " + "$" + "{{ inputs.expected_main_sha }}",
                "EXPECTED_MAIN_SHA: " + "$" + "{{ github.sha }}", 1)),
        )
        for label, altered in variants:
            with self.subTest(label=label):
                with patch.object(audit, "read", side_effect=lambda target:
                                  altered if target == path else original_read(target)):
                    blockers = audit.findings()
                self.assertTrue(any(issue.startswith(("OPS03_PREFLIGHT:", "OPS03_BINDING:",
                                                       "OPS03_DISPATCH_BYPASS:"))
                                    for issue in blockers), blockers)

    def test_signed_build_requires_ci_and_propagates_preflight_failure(self):
        path = ".github/workflows/release-build.yml"
        original_read = audit.read
        original = original_read(path)
        expected = """REQUIRED_CI_JSON: '["Quality","Secret Scan"]'"""
        preflight = "python3 - <<'PY'"
        self.assertIn(expected, original)
        self.assertIn(preflight, original)
        variants = (
            ("empty_ci", original.replace(expected, "REQUIRED_CI_JSON: '[]'", 1)),
            ("no_checks", original.replace(
                'required=json.loads(os.environ["REQUIRED_CI_JSON"])',
                'required=[]', 1)),
            ("no_ci_success", original.replace(
                'if latest.get("status")!="completed" or latest.get("conclusion")!="success": refuse("Required CI not successful: "+name)',
                "if False: refuse('unreachable')", 1)),
            ("mask_preflight", original.replace(preflight, preflight + " || true", 1)),
        )
        for label, altered in variants:
            with self.subTest(label=label):
                with patch.object(audit, "read", side_effect=lambda filename:
                                  altered if filename == path else original_read(filename)):
                    issues = audit.findings()
                self.assertTrue(any(item.startswith(("OPS03_REQUIRED_CI:", "OPS03_PREFLIGHT:"))
                                    for item in issues), issues)

    def test_signed_build_cannot_override_effective_ci_or_add_ungated_job(self):
        path = ".github/workflows/release-build.yml"
        original_read = audit.read
        original = original_read(path)
        marker = "          GH_TOKEN: " + "$" + "{{ github.token }}"
        self.assertIn(marker, original)
        variants = (
            ("step_ci_override", original.replace(
                marker, marker + "\n          REQUIRED_CI_JSON: '[]'", 1)),
            ("second_build_job", original + "\n  bypass:\n"
             "    runs-on: ubuntu-latest\n"
             "    permissions:\n      actions: write\n"
             "    steps:\n"
             "      - run: gh api --method POST repos/x/actions/workflows/android-play-aab.yml/dispatches\n"),
        )
        for label, changed in variants:
            with self.subTest(label=label):
                with patch.object(audit, "read", side_effect=lambda target:
                                  changed if target == path else original_read(target)):
                    issues = audit.findings()
                self.assertTrue(any(item.startswith(("OPS03_REQUIRED_CI:", "OPS03_SCOPE:"))
                                    for item in issues), issues)

    def test_gh_workflow_run_cannot_start_build_before_approval(self):
        path = ".github/workflows/release-build.yml"
        original_read = audit.read
        source = original_read(path)
        before = "      - name: Gate release batch, main SHA and required CI\n"
        self.assertIn(before, source)
        injected = source.replace(
            before, "      - name: Unauthorized early build request\n"
            "        run: gh workflow run android-play-aab.yml --ref main -f mode=build\n"
            + before, 1)
        with patch.object(audit, "read", side_effect=lambda name:
                          injected if name == path else original_read(name)):
            blockers = audit.findings()
        self.assertTrue(any("OPS03_UNGUARDED_DISPATCH:" in item for item in blockers),
                        blockers)

    def test_quoted_failure_tolerance_cannot_skip_signed_build_approval(self):
        path = ".github/workflows/release-build.yml"
        read_file = audit.read
        original = read_file(path)
        gate = "      - name: Gate release batch, main SHA and required CI\n"
        self.assertIn(gate, original)
        changed = original.replace(
            gate, gate + '        "continue-on-error": true\n', 1)
        with patch.object(audit, "read", side_effect=lambda target:
                          changed if target == path else read_file(target)):
            blockers = audit.findings()
        self.assertTrue(any("OPS03_PREFLIGHT:" in item for item in blockers), blockers)

    def test_missing_existing_aab_cannot_be_published(self):
        mod=module("scripts/ops04/internal.py")
        self.assertIsNotNone(mod, "OPS-04 immutable AAB guard missing")
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(mod,"BUNDLE_PATH",Path(tmp)):
                with self.assertRaises(mod.GateError):
                    mod.verify()


if __name__ == "__main__":
    unittest.main()
