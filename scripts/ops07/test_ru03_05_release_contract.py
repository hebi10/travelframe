"""RU-03/04/05: offline contracts for three independent Play release stages."""
from pathlib import Path
import json
import os
import subprocess
from textwrap import dedent
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"


class ReleaseStageContractTests(unittest.TestCase):
    def test_ops03_is_manual_build_only(self):
        workflow = (WORKFLOWS / "release-build.yml").read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("expected_main_sha:", workflow)
        self.assertIn("batch_id:", workflow)
        self.assertIn("final_batch_approved:", workflow)
        self.assertNotIn("google-github-actions/auth@", workflow)
        self.assertNotIn("androidpublisher.googleapis.com", workflow)
        self.assertNotIn('inputs[mode]=deploy', workflow)
        self.assertNotIn('inputs[deploy]=true', workflow)

    def test_ops03_requires_stable_workflow_and_latest_attempt_evidence(self):
        workflow = (WORKFLOWS / "release-build.yml").read_text(encoding="utf-8")
        gate = dedent(workflow.split("python3 - <<'PY'\n", 1)[1].split("\n          PY", 1)[0])
        repo = "repos/hebi10/travelframe"
        sha = "a" * 40
        path = ".github/workflows/body-frame-device-qa.yml"
        workflow_api = f"{repo}/actions/workflows/body-frame-device-qa.yml"
        query = f"?head_sha={sha}&branch=main&per_page=100"
        run = dict(id=321, run_attempt=2, run_number=10, workflow_id=123, path=path,
                   name="Body Frame native QA · tf-42-1", head_sha=sha, head_branch="main",
                   event="workflow_dispatch", status="completed", conclusion="success")
        # These mandatory jobs must come from the selected attempt.
        names = ["build-apk", "capture-devices", "stage13-design-captures (phone-360dp)",
                 "stage13-design-captures (phone-412dp)", "stage13-design-captures (tablet-600dp)",
                 "stage13-design-captures (tablet-750dp)", "ui-r05-visual-verify",
                 "UI-R05 native MP4 export, cancellation and populated library",
                 "UI-R05 independent MP4 hash, H.264/frame and native UI audit"]
        jobs = [dict(name=name, status="completed", conclusion="success") for name in names]
        ci = [{**run, "name": name, "event": "push"} for name in ("Quality", "Secret Scan")]
        env = dict(GITHUB_REPOSITORY="hebi10/travelframe", GITHUB_EVENT_NAME="workflow_dispatch",
                   GITHUB_REF="refs/heads/main", GITHUB_SHA=sha, EXPECTED_MAIN_SHA=sha,
                   FINAL_BATCH_APPROVED="true", BATCH_ID="2026-11-26-travelframe",
                   REQUIRED_CI_JSON=json.dumps(["Quality", "Secret Scan"]),
                   REQUIRED_MANUAL_QA_JSON=json.dumps(["Body Frame native device QA"]),
                   VERSION_CODE="", RELEASE_TAG="")
        fixtures = {
            f"{repo}/git/ref/heads/main": {"object": {"sha": sha}},
            f"{repo}/actions/runs{query}": {"workflow_runs": ci + [run]},
            workflow_api: {"id": 123, "path": path},
            f"{workflow_api}/runs{query}&event=workflow_dispatch": {
                "total_count": 1, "workflow_runs": [run],
            },
            f"{repo}/actions/runs/321/attempts/2/jobs?per_page=100": {
                "total_count": len(jobs), "jobs": jobs,
            },
        }

        def execute(overrides=None):
            responses = {**fixtures, **(overrides or {})}
            def fake_api(command, **kwargs):
                return SimpleNamespace(returncode=0, stdout=json.dumps(responses[command[-1]]))
            with patch.dict(os.environ, env, clear=True), patch.object(subprocess, "run", fake_api):
                exec(gate, {})

        execute()
        runs_path = f"{workflow_api}/runs{query}&event=workflow_dispatch"
        mutated = [
            ({"workflow_id": 4}, "Missing exact-main"),
            ({"path": ".github/workflows/another.yml"}, "Missing exact-main"),
            ({"head_sha": "b" * 40}, "Missing exact-main"),
            ({"head_branch": "stale-branch"}, "Missing exact-main"),
            ({"event": "push"}, "Missing exact-main"),
            ({"run_attempt": 0}, "Invalid final Android QA attempt"),
            ({"conclusion": "failure"}, "Manual final Android QA failed"),
        ]
        for change, why in mutated:
            with self.subTest(change=change), self.assertRaisesRegex(SystemExit, why):
                execute({runs_path: {"total_count": 1, "workflow_runs": [{**run, **change}]}})
        with self.assertRaisesRegex(SystemExit, "Manual final Android QA failed"):
            execute({runs_path: {"total_count": 2, "workflow_runs": [
                run, {**run, "id": 322, "run_number": 11, "conclusion": "failure"},
            ]}})
        with self.assertRaisesRegex(SystemExit, "Incomplete final Android QA run inventory"):
            execute({runs_path: {"total_count": 2, "workflow_runs": [run]}})
        jobs_path = f"{repo}/actions/runs/321/attempts/2/jobs?per_page=100"
        with self.assertRaisesRegex(SystemExit, "Incomplete final Android QA job evidence"):
            execute({jobs_path: {"total_count": len(jobs), "jobs": jobs[1:]}})
        with self.assertRaisesRegex(SystemExit, "Final Android QA missing or failed required job"):
            execute({jobs_path: {"total_count": len(jobs), "jobs": [{**jobs[0], "conclusion": "skipped"}, *jobs[1:]]}})

    def test_ops04_consumes_exact_existing_aab(self):
        workflow = (WORKFLOWS / "play-internal-release.yml").read_text(encoding="utf-8")
        verifier = (ROOT / "scripts/ops04/internal.py").read_text(encoding="utf-8")
        for field in ("expected_main_sha:", "build_run_id:", "artifact_name:",
                      "aab_sha256:", "version_code:", "version_name:"):
            with self.subTest(field=field):
                self.assertIn(field, workflow)
        self.assertIn("actions/download-artifact@", workflow)
        self.assertIn("run-id: ${{ inputs.build_run_id }}", workflow)
        self.assertIn("python3 scripts/ops04/internal.py verify", workflow)
        self.assertIn('inputs.mode == \'publish\'', workflow)
        self.assertIn('AAB_SHA256', verifier)
        self.assertIn('Expected exactly one AAB', verifier)
        self.assertIn('Downloaded AAB SHA-256 differs', verifier)
        self.assertIn('AAB applicationId, versionCode or versionName mismatch', verifier)
        self.assertIn('play_uploaded": False', verifier)

    def test_ops05_promotes_without_binary_upload(self):
        workflow = (WORKFLOWS / "play-closed-release.yml").read_text(encoding="utf-8")
        promoter = (ROOT / "scripts/ops05/promotion.py").read_text(encoding="utf-8")
        for field in ("expected_main_sha:", "version_code:", "aab_sha256:",
                      "closed_track:", "final_batch_approved:", "approval_phrase:"):
            with self.subTest(field=field):
                self.assertIn(field, workflow)
        self.assertIn('inputs.mode == \'promote\'', workflow)
        self.assertIn("PROMOTE_VERIFIED_INTERNAL_VERSION", promoter)
        self.assertIn('Source internal or destination closed track does not exist', promoter) if "Source internal or destination closed track does not exist" in promoter else self.assertIn("Source internal track does not exist", promoter)
        self.assertIn('aab_rebuilt": False', promoter)
        self.assertNotIn("bundleRelease", promoter)
        self.assertNotIn("/bundles:upload", promoter)
        self.assertNotIn("assembleRelease", promoter)


if __name__ == "__main__":
    unittest.main()
