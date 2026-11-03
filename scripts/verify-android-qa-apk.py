#!/usr/bin/env python3
"""Reject stale client APK reuse; authenticated run metadata is supplied by Actions."""
import argparse
import hashlib
import json
import re
from pathlib import Path
import subprocess


def git(*args):
    return subprocess.check_output(['git',*args]).decode()


def capture_only(path):
    return (path.startswith(('functions/','docs/','.superpowers/','tests/')) or path in {
        'README.md','firestore.rules','storage.rules',
        'scripts/capture-android-qa.py','scripts/test_capture_android_qa.py',
        'scripts/verify-android-qa-apk.py','scripts/test_verify_android_qa_apk.py','scripts/android-qa-apk-selection.json',
        '.github/workflows/body-frame-device-qa.yml',
        '.github/workflows/body-frame-device-recapture.yml'})


def client_fingerprint(commit):
    entries=[]
    for record in git('ls-tree','-r','-z',commit).split('\0'):
        if not record: continue
        metadata,path=record.split('\t',1)
        if not capture_only(path): entries.append(metadata+'\t'+path)
    return hashlib.sha256('\0'.join(sorted(entries)).encode()).hexdigest()


def build_job(commit):
    workflow=git('show',commit+':.github/workflows/body-frame-device-qa.yml')
    return workflow.split('\n  build-apk:',1)[1].split('\n  capture-devices:',1)[0].strip()



def build_context(commit):
    """Include inherited workflow env/defaults as well as the complete build job.

    Compare raw YAML blocks conservatively: even formatting-only edits can ask
    for a rebuild, while root build values can never change silently.
    """
    workflow=git('show',commit+':.github/workflows/body-frame-device-qa.yml')
    inherited=[]
    active=False
    for line in workflow.splitlines():
        if line and not line[0].isspace() and not line.startswith('#'):
            active=bool(re.match(r'^(env|defaults):',line))
        if active: inherited.append(line)
    job=workflow.split('\n  build-apk:',1)[1].split('\n  capture-devices:',1)[0].strip()
    return json.dumps({'inheritedWorkflowBuildContext':'\n'.join(inherited).strip(),'buildJob':job},sort_keys=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-metadata',type=Path,required=True)
    parser.add_argument('--apk',type=Path,required=True)
    parser.add_argument('--expected-sha256',required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    metadata=json.loads(args.run_metadata.read_text())
    source=metadata['checkoutSha']
    current=git('rev-parse','HEAD').strip()
    selected=client_fingerprint(source);actual=client_fingerprint(current)
    if selected!=actual: raise SystemExit('Selected APK client input tree differs from current checkout; rebuild required')
    if build_context(source)!=build_context(current): raise SystemExit('Selected APK build job or inherited workflow environment/defaults differ from current QA build; rebuild required')
    sha=hashlib.sha256(args.apk.read_bytes()).hexdigest()
    if sha.lower()!=args.expected_sha256.lower(): raise SystemExit('Downloaded APK SHA256 differs from explicitly selected APK hash')
    changed=[path for path in git('diff','--name-only',source,current).splitlines() if path]
    if any(not capture_only(path) for path in changed): raise SystemExit('Unapproved client input changes found')
    manifest=dict(selectedRun=metadata,currentCheckout=current,apkSha256=sha,expectedApkSha256=args.expected_sha256,
                  selectedClientTreeFingerprint=selected,currentClientTreeFingerprint=actual,clientMatch=True,
                  buildJobSha256=hashlib.sha256(build_job(current).encode()).hexdigest(),
                  buildContextSha256=hashlib.sha256(build_context(current).encode()).hexdigest(),safeChangedPaths=changed)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(manifest,indent=2))
    print('Selected APK hash, actual build checkout, client input tree and build configuration all match')


if __name__=='__main__': main()
