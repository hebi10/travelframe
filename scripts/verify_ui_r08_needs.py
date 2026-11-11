#!/usr/bin/env python3
"""Fail-closed final gate for all native UI-R08 jobs in one GitHub Actions run."""
import argparse
import json
import os
from pathlib import Path
import sys

REQUIRED = (
    "build-apk",
    "capture-devices",
    "stage13-design-captures",
    "ui-r00-captures",
    "ui-r00-verify",
    "ui-r01-r02-android",
    "ui-r01-r02-verify",
    "ui-r05-native-video",
    "ui-r05-native-verify",
    "ui-r07-native-keyboard",
    "ui-r07-keyboard-verify",
    "ui-r08-visual-verify",
)


def assess(results, head_ref):
    if not head_ref.startswith("qa/ui-r08-"):
        raise ValueError("The integrated QA gate can only run on a UI-R08 preview branch")
    if not isinstance(results, dict):
        raise ValueError("Missing Github Actions needs JSON")
    checks = {}
    issues = []
    for name in REQUIRED:
        result = results.get(name)
        outcome = result.get("result") if isinstance(result, dict) else None
        checks[name] = outcome or "MISSING"
        if outcome != "success":
            issues.append(f"{name}: expected success, got {outcome or 'MISSING'}")
    return {
        "stage": "UI-R08 functional integration job gate",
        "status": "PASS" if not issues else "FAIL",
        "headRef": head_ref,
        "requiredJobs": len(REQUIRED),
        "jobs": checks,
        "issues": issues,
        "constraints": {
            "qaOnly": True,
            "livePlayDeployment": False,
            "productionFirebaseWrite": False,
            "physicalARM64Verified": False,
            "talkBackSpeechVerified": False,
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        data = json.loads(os.environ.get("UI_R08_NEEDS_JSON", "null"))
        report = assess(data, os.environ.get("GITHUB_HEAD_REF", ""))
    except (ValueError, TypeError) as exc:
        report = {"stage": "UI-R08 functional integration job gate",
                  "status": "FAIL", "issues": [str(exc)]}
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": report["status"], "issues": report["issues"],
                      "requiredJobs": report.get("requiredJobs", 0)}, ensure_ascii=False))
    if report["status"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
