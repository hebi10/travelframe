# TF-FINAL-03 — Android URI decoder security backport

## Evidence and scope

- PR #128 candidate 7b5ab4aa passed Quality, all 25 Functions registration contracts, Firebase emulator 11 checks, and Android production export analysis. The approved staging workflow was skipped. The SDK upgrade remains separate and Draft.
- [Latest bundle reachability report](https://github.com/hebi10/travelframe/actions/runs/45335812656): nine high-severity audit package names, six observed in Android export source maps (including decode-uri-component and query-string), three not observed. This is not a signed APK or exploitability assessment.
- [CVE-2026-118664](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) and [CVE-2026-45822](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) affect the existing decoder. Upstream version 0.5.1 fixes the two fallback algorithms but is ESM-only; query-string 7.1.3 uses a synchronous CommonJS require. Do not force an unsupported SDK upgrade or incompatible override.

## Implementation

- Apply upstream MIT-licensed v0.5.1 decoder logic as a version- and original Git blob-checked local postinstall backport. Preserve CommonJS and the v0.2.2 plus-to-space contract. Upstream license retained. Keep existing native-intent size/encoding guard.
- No app or Functions dependency version or lockfile change. npm audit may continue to report the vulnerable published version: a locally patched source is not an upstream dependency-version fix. Do not mark #106 resolved.
- Existing verified Android export/npm explain reporting from #128 is moved independently to the current main-based security PR, allowing future diagnostics without depending on the server SDK candidate.
- Verify the actual installed decoder used by query-string, patch idempotence and version/source rejection, valid UTF-8 and query compatibility, malformed escapes, one-pass fallback, and full CI. The audit workflow must pass the installed-code regression before production export analysis.
- Still required: exact-head CI and review, native deep-link/OAuth real-device QA, signed APK evidence, evaluation of other advisories, upstream-supported SDK upgrade. No production Firebase, billing settings, signing or Play changes.
