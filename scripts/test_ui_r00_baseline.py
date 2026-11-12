#!/usr/bin/env python3
"""Host-only UI-R00 fixture, 100-shot inventory and offline safety checks."""
from pathlib import Path
import importlib.util
import json

HERE = Path(__file__).resolve().parent


def mod(file, name):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


capture = mod("capture_ui_r00_baseline.py", "ui_r00_capture_test")
fixtures = capture.data
qa = capture.qa
verifier = mod("verify_ui_r00_baseline.py", "ui_r00_verify_test")
expected = {
    "no-project": (0, 0, 0),
    "project-no-photo": (1, 0, 0),
    "project-one-photo": (1, 1, 0),
    "project-three-photos": (1, 3, 0),
    "project-many-photos": (1, 12, 9),
    "three-projects": (3, 9, 6),
    "video-empty": (1, 3, 0),
    "guest": (1, 3, 0),
    "first-run": (1, 3, 0),
}
for state, (nprojects, nphotos, newfiles) in expected.items():
    encoded, media, counts = fixtures.build_state(qa, "/data/user/0/com.haebi.photoguide", state)
    projects = json.loads(encoded[fixtures.PROJECTS_STORAGE_ID])
    photos = json.loads(encoded[fixtures.PHOTOS_STORAGE_ID])
    assert len(projects) == counts["projects"] == nprojects, state
    assert len(photos) == counts["photos"] == nphotos, state
    assert len(media) == newfiles, state
    assert counts["videos"] == 0, state
    assert json.loads(encoded["travel-frame.settings.v1"])["cloudBackupEnabled"] is False
    assert set(p["projectId"] for p in photos).issubset({p["id"] for p in projects})
    assert all(photo["uri"].startswith("file:///data/user/0/com.haebi.photoguide/") for photo in photos)
    assert not any("https://" in photo["uri"] for photo in photos)
    if state == "first-run":
        assert json.loads(encoded["travel-frame.guide-progress.v1"])["seenIntro"] is False
    else:
        assert json.loads(encoded["travel-frame.guide-progress.v1"])["seenIntro"] is True
try:
    fixtures.build_state(qa, "/tmp", "not-a-supported-state")
    raise AssertionError("unsupported state accepted")
except ValueError:
    pass

assert len(capture.PROFILES) == 4
assert len(capture.VARIANTS) == 2
assert len(capture.BASE_SCREENS) == 10
assert len(capture.STATE_NAMES) == 10
assert sum(2 * (10 + (10 if p == "phone-412dp" else 0)) for p in capture.PROFILES) == 100
assert set(capture.PROFILES) == set(verifier.PROFILES)
assert set(capture.BASE_SCREENS) == set(verifier.BASE)
assert set(capture.STATE_NAMES) == set(verifier.STATES)
assert "ro.kernel.qemu" in Path(HERE / "capture_ui_r00_baseline.py").read_text(encoding="utf-8")
assert 'device.shell("svc", "wifi", "disable")' in Path(HERE / "capture_ui_r00_baseline.py").read_text(encoding="utf-8")
print("PASS: UI-R00 fixture states, baseline 100-shot inventory and local-only safety")
