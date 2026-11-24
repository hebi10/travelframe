#!/usr/bin/env python3
"""Host-only safety assertions for the STORE-03-B capture contract."""
import importlib.util
from pathlib import Path
import os
from unittest.mock import patch

root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("store03b", root / "capture-store-demo-android.py")
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

assert len(app.SCREENS) == 9
assert set(("compare", "video-create", "camera-reference-adjust")).issubset(app.SCREENS)
assert app.PROFILES == ("phone-412dp", "tablet-600dp")
assert app.VARIANTS == ("dark-100", "light-100")
assert app.qa.PROFILES is not None
for i in (1, 2, 3):
    app.qa.fixture_jpeg.cache_clear()
    with patch.dict(os.environ, {"BODY_FRAME_STORE_DEMO_FIXTURES": "1"}):
        raw = app.qa.fixture_jpeg(i)
        assert raw[:2] == bytes.fromhex("ffd8")
        assert raw[-2:] == bytes.fromhex("ffd9")
        assert len(raw) < 500_000
app.qa.fixture_jpeg.cache_clear()
print("ok - STORE-03-B media, safety and screen inventory")
