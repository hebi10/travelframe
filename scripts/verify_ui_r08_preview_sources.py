#!/usr/bin/env python3
"""Fail-closed exact source file and ancestor guard for QA-only UI-R08 integration."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys


def git(*args):
    return subprocess.check_output(
        ["git", "-c", "core.quotepath=false", *args],
        text=True,
        encoding="utf-8"
    ).strip()


def verify(base, manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("mode") != "QA_ONLY_PREVIEW" or manifest.get("baseline_main") != base:
        raise RuntimeError("Preview manifest does not match locked main or QA-only mode")
    if not os.environ.get("GITHUB_HEAD_REF", "").startswith("qa/ui-r08-"):
        raise RuntimeError("This source guard may not be used by production branches")
    source = manifest.get("sources", [])
    if [item.get("pr") for item in source] != [150, 151, 152, 153, 154, 155, 156]:
        raise RuntimeError("All seven original UI PR heads must be locked in order")
    current = git("rev-parse", "HEAD")
    if not current or len(current) != 40:
        raise RuntimeError("Checkout SHA missing")
    for item in source:
        sha = item["head_sha"]
        if len(sha) != 40 or subprocess.run(
            ["git", "merge-base", "--is-ancestor", sha, "HEAD"], check=False
        ).returncode != 0:
            raise RuntimeError(f"Source PR #{item['pr']} HEAD is not an ancestor of integrated checkout")
    allowed = manifest.get("allowedChangedPaths", [])
    if not allowed or allowed != sorted(set(allowed)):
        raise RuntimeError("Expected an exact, sorted source allowlist")
    changed = git("diff", "--name-only", base, "HEAD").splitlines()
    unexpected = sorted(set(changed) - set(allowed))
    missing = sorted(set(allowed) - set(changed))
    if unexpected or missing:
        raise RuntimeError(
            "Integrated source diff differs from manifest: unexpected="
            + repr(unexpected) + ", missing=" + repr(missing)
        )
    return {"status": "PASS", "sources": len(source),
            "changedFiles": len(changed), "checkoutSha": current,
            "baselineSha": base, "productionDeployment": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = verify(args.base, args.manifest)
    except Exception as exc:
        result = {"status": "FAIL", "message": str(exc)}
    print(json.dumps(result, ensure_ascii=False))
    if result["status"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
