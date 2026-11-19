#!/usr/bin/env python3
"""TF-RELEASE-AUTO-01: manually approved, fail-closed Play testing chain.

The orchestrator has no Google Play credentials or signing key. It dispatches
the existing app-specific workflows and checks their immutable receipts.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPOSITORY = "hebi10/travelframe"
PACKAGE = "com.haebi.photoguide"
OUTPUT = Path("tf-release-output")
MAIN_CHECKS = ("Quality", "Secret Scan", "OPS-08 final main source and release policy verification")
BUILD_WORKFLOW = "android-play-aab.yml"
NATIVE_WORKFLOW = "body-frame-device-qa.yml"
BUILD_TITLE_PREFIX = "TravelFrame Play build · internal · main · "
NATIVE_JOBS = (
    "build-apk", "capture-devices",
    "stage13-design-captures (phone-360dp)",
    "stage13-design-captures (phone-412dp)",
    "stage13-design-captures (tablet-600dp)",
    "stage13-design-captures (tablet-750dp)",
    "ui-r05-visual-verify",
    "UI-R05 native MP4 export, cancellation and populated library",
    "UI-R05 independent MP4 hash, H.264/frame and native UI audit",
)
WORKFLOWS = (
    NATIVE_WORKFLOW,
    BUILD_WORKFLOW,
    "play-internal-release.yml",
    "play-closed-release.yml",
)


class ReleaseGateError(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise ReleaseGateError(reason)


def now_utc():
    return datetime.now(timezone.utc)


def sha256(file):
    digest = hashlib.sha256()
    with open(file, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_approval(env):
    require(env.get("GITHUB_REPOSITORY") == REPOSITORY, "Unexpected repository")
    require(env.get("GITHUB_REF") == "refs/heads/main", "Only main can release")
    require(env.get("GITHUB_EVENT_NAME") == "workflow_dispatch",
            "A manually dispatched, explicitly approved release is required")
    mode = env.get("TF_MODE", "")
    require(mode in ("check", "build", "internal", "closed", "deploy"), "Invalid release mode")
    sha = env.get("TF_EXPECTED_MAIN_SHA", "")
    require(bool(re.fullmatch("[0-9a-f]{40}", sha)), "Exact main SHA is required")
    require(env.get("GITHUB_SHA") == sha, "Selected workflow ref does not match approved SHA")
    batch = env.get("TF_BATCH_ID", "")
    require(bool(re.fullmatch(r"20\d{2}-\d{2}-\d{2}-[a-z0-9-]{2,48}", batch)),
            "Invalid Asia/Seoul batch ID")
    internal = env.get("TF_INTERNAL_APPROVED", "").lower() == "true"
    closed = env.get("TF_CLOSED_APPROVED", "").lower() == "true"
    if mode == "build":
        require(env.get("TF_BUILD_APPROVED", "").lower() == "true",
                "Final QA and signed AAB build require approval")
    if mode == "internal":
        require(internal, "Internal upload requires explicit approval")
    if mode == "closed":
        require(closed, "Closed promotion requires explicit approval")
    if mode == "deploy":
        require(internal and closed, "Internal upload and closed promotion each require approval")
    build_run_id = env.get("TF_BUILD_RUN_ID", "")
    if mode in ("internal", "closed"):
        require(bool(re.fullmatch("[1-9][0-9]{0,19}", build_run_id)),
                "A successful signed AAB build run ID is required")
    else:
        require(not build_run_id, "This mode does not accept an existing build run ID")
    internal_track = env.get("TF_PLAY_INTERNAL_TRACK", "")
    closed_track = env.get("TF_PLAY_CLOSED_TRACK", "")
    require(internal_track in ("internal", "qa"), "Exact internal track must be configured")
    require(bool(re.fullmatch("[a-z][a-z0-9._-]{0,49}", closed_track))
            and closed_track not in ("production", "beta", "internal", "qa")
            and closed_track != internal_track, "Invalid or forbidden closed track")
    return dict(mode=mode, source_sha=sha, batch_id=batch, internal_track=internal_track,
                closed_track=closed_track, internal_approved=internal, closed_approved=closed,
                build_run_id=int(build_run_id) if build_run_id else None)


def api(method, path, payload=None):
    require(path.startswith("/repos/" + REPOSITORY + "/"), "GitHub API path must stay in this repo")
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    require(bool(token), "GitHub Actions token is unavailable")
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request("https://api.github.com" + path, data=data, method=method, headers={
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    })
    try:
        with urlopen(request, timeout=35) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except HTTPError as exc:
        raise ReleaseGateError("GitHub API " + method + " " + path.split("?")[0]
                               + " rejected HTTP " + str(exc.code)) from None
    except URLError:
        raise ReleaseGateError("GitHub API connection unavailable") from None


def check_main(sha):
    response = api("GET", "/repos/" + REPOSITORY + "/git/ref/heads/main")
    require(response.get("object", {}).get("sha") == sha,
            "main changed after release approval; do not build or retry")


def wait_main_checks(sha, deadline_seconds=2400, interval=20):
    deadline = time.monotonic() + deadline_seconds
    while time.monotonic() < deadline:
        check_main(sha)
        response = api("GET", "/repos/" + REPOSITORY
                       + "/actions/runs?head_sha=" + sha + "&branch=main&per_page=100")
        require(response.get("total_count", 0) <= 100, "CI result page incomplete")
        runs = response.get("workflow_runs", [])
        pending = False
        for name in MAIN_CHECKS:
            matching = [run for run in runs if run.get("name") == name
                        and run.get("head_sha") == sha and run.get("head_branch") == "main"
                        and run.get("event") in ("push", "workflow_dispatch")]
            if not matching:
                pending = True
                continue
            latest = max(matching, key=lambda x: (x.get("run_number", 0),
                                                   x.get("run_attempt", 0), x.get("id", 0)))
            if latest.get("status") != "completed":
                pending = True
            else:
                require(latest.get("conclusion") == "success",
                        "Exact-main CI failed: " + name)
        if not pending:
            return
        time.sleep(interval)
    raise ReleaseGateError("Timed out waiting for exact-main Quality, Secret Scan and OPS-08")


def workflow_runs(filename, sha=None):
    require(filename in WORKFLOWS, "Unknown child workflow")
    response = api("GET", "/repos/" + REPOSITORY + "/actions/workflows/"
                   + filename + "/runs?event=workflow_dispatch&branch=main&per_page=100"
                   + ("&head_sha=" + sha if sha else ""))
    require(response.get("total_count", 0) >= 0, "Missing workflow run count")
    return response.get("workflow_runs", [])


def dispatch_and_wait(filename, inputs, marker, sha, timeout_seconds=7200, interval=20):
    check_main(sha)
    started = now_utc() - timedelta(minutes=1)
    api("POST", "/repos/" + REPOSITORY + "/actions/workflows/" + filename + "/dispatches",
        {"ref": "main", "inputs": inputs})
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        check_main(sha)
        matches = []
        for run in workflow_runs(filename):
            created = run.get("created_at")
            try:
                timestamp = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except (TypeError, ValueError, AttributeError):
                continue
            if (timestamp >= started and run.get("event") == "workflow_dispatch"
                    and run.get("head_sha") == sha and run.get("head_branch") == "main"
                    and marker in run.get("display_title", "")):
                matches.append(run)
        require(len(matches) <= 1, "Ambiguous dispatched run; refusing to choose")
        if matches:
            found = matches[0]
            if found.get("status") == "completed":
                require(found.get("conclusion") == "success",
                        filename + " failed or was cancelled: "
                        + "https://github.com/" + REPOSITORY + "/actions/runs/"
                        + str(found["id"]))
                return int(found["id"])
        time.sleep(interval)
    raise ReleaseGateError("Timed out or could not identify exact " + filename + " run")


def require_native_jobs(run_id):
    response = api("GET", "/repos/" + REPOSITORY + "/actions/runs/"
                   + str(run_id) + "/jobs?per_page=100")
    require(response.get("total_count", 0) <= 100, "Incomplete Android QA job inventory")
    jobs = response.get("jobs", [])
    for required in NATIVE_JOBS:
        matching = [j for j in jobs if j.get("name") == required]
        require(len(matching) == 1 and matching[0].get("conclusion") == "success",
                "Required Android capture/MP4 QA was skipped or failed: " + required)


def verify_existing_build_run(run_id, sha):
    run = api("GET", f"/repos/{REPOSITORY}/actions/runs/{run_id}")
    title = run.get("display_title", "")
    require(run.get("id") == run_id and run.get("head_sha") == sha
            and run.get("head_branch") == "main" and run.get("event") == "workflow_dispatch"
            and run.get("status") == "completed" and run.get("conclusion") == "success"
            and run.get("repository", {}).get("full_name") == REPOSITORY
            and run.get("path", "").split("@")[0] == ".github/workflows/" + BUILD_WORKFLOW
            and title.startswith(BUILD_TITLE_PREFIX),
            "Use a successful signed AAB build-only run from the exact approved main")
    return title.removeprefix(BUILD_TITLE_PREFIX)


def find_paired_native_qa(request_id, sha):
    if not re.fullmatch(r"tf-[1-9][0-9]*-[1-9][0-9]*", request_id):
        return None
    runs = [run for run in workflow_runs(NATIVE_WORKFLOW, sha)
            if run.get("head_sha") == sha and run.get("head_branch") == "main"
            and run.get("event") == "workflow_dispatch"
            and run.get("display_title") == "Body Frame native QA · " + request_id]
    require(len(runs) <= 1, "Ambiguous paired native release QA")
    if not runs:
        return None
    run = runs[0]
    require(run.get("status") == "completed" and run.get("conclusion") == "success",
            "Paired exact-main native release QA did not succeed")
    return int(run["id"])


def require_artifact(run_id, prefix):
    data = api("GET", "/repos/" + REPOSITORY + "/actions/runs/"
               + str(run_id) + "/artifacts?per_page=100")
    require(data.get("total_count", 0) <= 100, "Artifact inventory incomplete")
    matches = [a for a in data.get("artifacts", [])
               if a.get("name", "").startswith(prefix) and not a.get("expired")
               and a.get("size_in_bytes", 0) > 0]
    require(len(matches) == 1, "Expected exactly one verified, unexpired artifact: " + prefix)
    name = matches[0]["name"]
    require(bool(re.fullmatch("[A-Za-z0-9][A-Za-z0-9._-]{1,180}", name)),
            "Unsafe artifact name")
    return name


def download(run_id, name, directory):
    directory.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(["gh", "run", "download", str(run_id), "-R", REPOSITORY,
                             "-n", name, "-D", str(directory)],
                            capture_output=True, text=True)
    require(result.returncode == 0, "Cannot obtain exact approved GitHub artifact")
    return directory


def load_build(run_id, sha):
    name = require_artifact(run_id, "body-frame-play-")
    files = download(run_id, name, OUTPUT / "build")
    manifest_file = files / "build-provenance.json"
    require(manifest_file.is_file(), "AAB provenance missing")
    meta = json.loads(manifest_file.read_text(encoding="utf-8"))
    require(meta.get("repository") == REPOSITORY
            and meta.get("sourceSha") == sha
            and meta.get("workflowSha") == sha
            and meta.get("packageId") == PACKAGE
            and str(meta.get("runId")) == str(run_id),
            "AAB was not built from the exact approved main")
    code, version, digest = meta.get("versionCode"), meta.get("versionName"), meta.get("aabSha256")
    require(isinstance(code, int) and 0 < code <= 2100000000, "Invalid signed versionCode")
    require(isinstance(version, str) and bool(re.fullmatch(r"\d+\.\d+\.\d+(?:[-.][A-Za-z0-9]+)*", version)),
            "Invalid signed versionName")
    require(isinstance(digest, str) and bool(re.fullmatch("[0-9a-f]{64}", digest)),
            "Invalid AAB SHA-256")
    bundle = files / ("BodyFrame-" + version + "-" + str(code) + ".aab")
    mapping = files / "mapping.txt"
    require(bundle.is_file() and mapping.is_file() and mapping.stat().st_size > 0,
            "Signed AAB or R8 mapping missing")
    require(sha256(bundle) == digest and sha256(mapping) == meta.get("mappingSha256"),
            "Verified AAB or R8 mapping hash mismatch")
    require(bool(re.fullmatch("[0-9a-f]{64}", meta.get("uploadCertificateSha256", ""))),
            "Verified upload certificate fingerprint missing")
    require(name.startswith("body-frame-play-" + str(code) + "-" + str(run_id) + "-"),
            "AAB artifact name does not match run/version")
    return dict(build_run_id=run_id, artifact_name=name, version_code=code,
                version_name=version, aab_sha256=digest)


def load_receipt(run_id, prefix, file_name, phase):
    artifact = require_artifact(run_id, prefix + str(run_id))
    directory = download(run_id, artifact, OUTPUT / phase)
    location = directory / file_name
    require(location.is_file(), "Play " + phase + " receipt missing")
    return json.loads(location.read_text(encoding="utf-8"))


def validate_internal_receipt(receipt, build, source_sha, track):
    require(receipt.get("status") == "committed-and-read-back"
            and receipt.get("packageId") == PACKAGE
            and receipt.get("sourceSha") == source_sha
            and receipt.get("logicalTrack") == "internal"
            and receipt.get("apiTrack") == track
            and str(receipt.get("versionCode")) == str(build["version_code"])
            and receipt.get("aabSha256") == build["aab_sha256"],
            "Internal Play commit/readback or AAB identity is unconfirmed")


def validate_closed_receipt(receipt, build, plan):
    require(receipt.get("status") in ("committed_and_read_back", "already_completed_no_change")
            and receipt.get("package") == PACKAGE
            and receipt.get("source_sha") == plan["source_sha"]
            and receipt.get("batch_id") == plan["batch_id"]
            and receipt.get("source_track") == plan["internal_track"]
            and receipt.get("closed_track") == plan["closed_track"]
            and str(receipt.get("version_code")) == str(build["version_code"])
            and receipt.get("aab_sha256") == build["aab_sha256"]
            and receipt.get("binary_uploaded") is False
            and receipt.get("aab_rebuilt") is False,
            "Closed promotion did not read back the same verified internal release")


def save_result(result):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2)
                                        + "\n", encoding="utf-8")


def append_summary(result):
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary:
        return
    with open(summary, "a", encoding="utf-8") as output:
        output.write("## TravelFrame verified test release\n\n")
        output.write("Status: **" + result.get("status", "unknown") + "**\n\n")
        if "mode" in result:
            output.write("Mode: " + result["mode"] + "\n\n")
        output.write("Source SHA: " + result.get("source_sha", "") + "\n\n")
        for kind, run_id in result.get("runs", {}).items():
            output.write("- " + kind + ": https://github.com/" + REPOSITORY
                         + "/actions/runs/" + str(run_id) + "\n")
        if "build" in result:
            output.write("\nSigned AAB build run ID: " + str(result["runs"]["signed_aab"])
                         + "\n\nVersionCode: " + str(result["build"]["version_code"])
                         + "\n\nAAB SHA-256: " + result["build"]["aab_sha256"] + "\n")
        for key, label in (("internal_readback", "Internal track"), ("closed_readback", "Closed track")):
            if key in result:
                output.write("\n" + label + ": " + result[key] + "\n")


def execute(plan):
    sha = plan["source_sha"]
    batch = plan["batch_id"]
    mode = plan["mode"]
    request_id = "tf-" + os.environ["GITHUB_RUN_ID"] + "-" + os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    result = dict(schema="tf-release-auto-v1", status="in_progress",
                  source_sha=sha, batch_id=batch, mode=mode, runs={})
    save_result(result)

    def stage(name, workflow, payload, marker, timeout=7200):
        result["phase"] = name
        save_result(result)
        run_id = dispatch_and_wait(workflow, payload, marker, sha, timeout_seconds=timeout)
        result["runs"][name] = run_id
        save_result(result)
        return run_id

    wait_main_checks(sha)
    build_run = plan["build_run_id"]
    native = None
    if build_run is not None:
        build_request_id = verify_existing_build_run(build_run, sha)
        result["runs"]["signed_aab"] = build_run
        if mode == "internal":
            native = find_paired_native_qa(build_request_id, sha)
    if mode in ("build", "internal", "deploy"):
        if native is None:
            native = stage("android_qa", NATIVE_WORKFLOW,
                           {"release_qa": "true", "release_request_id": request_id,
                            "expected_main_sha": sha},
                           request_id, timeout=10800)
        else:
            result["runs"]["android_qa"] = native
        require_native_jobs(native)
    if build_run is None:
        build_run = stage("signed_aab", BUILD_WORKFLOW,
                          {"mode": "build", "track": "internal",
                           "ops01_release_approved": "false", "source_sha": sha,
                           "release_request_id": request_id}, request_id)
    build = load_build(build_run, sha)
    result["build"] = build
    save_result(result)

    if mode in ("internal", "deploy"):
        common = {"expected_main_sha": sha, "build_run_id": str(build_run),
                  "artifact_name": build["artifact_name"], "aab_sha256": build["aab_sha256"],
                  "version_code": str(build["version_code"]),
                  "version_name": build["version_name"], "batch_id": batch}
        stage("internal_check", "play-internal-release.yml",
              {**common, "mode": "check", "final_release_approved": "false"},
              "check build " + str(build_run) + " batch " + batch, timeout=1800)
        internal_run = stage("internal_publish", "play-internal-release.yml",
                             {**common, "mode": "publish", "final_release_approved": "true",
                              "approval_phrase": "PUBLISH_VERIFIED_INTERNAL_AAB"},
                             "publish build " + str(build_run) + " batch " + batch, timeout=2400)
        internal_receipt = load_receipt(internal_run, "ops04-travelframe-publish-",
                                        "play-release.json", "internal")
        validate_internal_receipt(internal_receipt, build, sha, plan["internal_track"])
        result["internal_readback"] = "committed-and-read-back"
        save_result(result)

    if mode in ("closed", "deploy"):
        promotion = {"expected_main_sha": sha, "batch_id": batch,
                     "version_code": str(build["version_code"]), "aab_sha256": build["aab_sha256"],
                     "internal_track": plan["internal_track"], "closed_track": plan["closed_track"]}
        stage("closed_check", "play-closed-release.yml",
              {**promotion, "mode": "check", "final_batch_approved": "false"},
              "check versionCode " + str(build["version_code"]) + " batch " + batch,
              timeout=1800)
        closed_run = stage("closed_promote", "play-closed-release.yml",
                           {**promotion, "mode": "promote", "final_batch_approved": "true",
                            "approval_phrase": "PROMOTE_VERIFIED_INTERNAL_VERSION"},
                           "promote versionCode " + str(build["version_code"]) + " batch " + batch,
                           timeout=2400)
        closed_receipt = load_receipt(closed_run, "ops05-closed-promotion-",
                                      "receipt.json", "closed")
        validate_closed_receipt(closed_receipt, build, plan)
        result["closed_readback"] = closed_receipt["status"]
    result["status"] = "signed-aab-verified" if mode == "build" else "committed-and-read-back"
    result.pop("phase", None)
    save_result(result)
    append_summary(result)


def main():
    plan = None
    try:
        plan = parse_approval(os.environ)
        check_main(plan["source_sha"])
        if len(sys.argv) != 2 or sys.argv[1] not in ("check", "deploy"):
            raise ReleaseGateError("Expected check or deploy command")
        if sys.argv[1] == "check":
            save_result({"schema": "tf-release-auto-v1", "status": "manual-approval-preflight-ok",
                         "source_sha": plan["source_sha"], "batch_id": plan["batch_id"]})
            print("Exact main, separate approval inputs and configured tracks validated; Play unchanged")
            return 0
        require(plan["mode"] != "check", "Select a release stage before execution")
        execute(plan)
        print("Selected release stages verified: " + plan["mode"])
        return 0
    except (ReleaseGateError, ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
        reason = str(exc)
        before = {}
        try:
            before = json.loads((OUTPUT / "result.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
        before["status"] = "blocked"
        before["reason"] = reason
        if plan and "source_sha" not in before:
            before["source_sha"] = plan["source_sha"]
        save_result(before)
        append_summary(before)
        print("::error::TF-RELEASE-AUTO-01 blocked: " + reason, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
