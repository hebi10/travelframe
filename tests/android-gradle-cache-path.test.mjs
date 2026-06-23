import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();

const scripts = [
  'scripts/run-android.ps1',
  'scripts/verify-android-debug.ps1',
  'scripts/build-android-aab.ps1',
];

for (const script of scripts) {
  const content = readFileSync(join(projectRoot, script), 'utf8');

  assert.match(
    content,
    /function Get-ShortGradleUserHome/,
    `${script} should resolve Gradle cache through the short-path helper`,
  );
  assert.match(
    content,
    /\$env:TRAVEL_FRAME_GRADLE_USER_HOME/,
    `${script} should allow overriding the short Gradle cache path`,
  );
  assert.match(
    content,
    /return "C:\\g"/,
    `${script} should default Gradle cache to C:\\g`,
  );
  assert.match(
    content,
    /\$env:GRADLE_USER_HOME = Get-ShortGradleUserHome/,
    `${script} should assign GRADLE_USER_HOME from the helper`,
  );
  assert.match(
    content,
    /function Clear-StaleAndroidCxxCache/,
    `${script} should remove stale CMake cache that still points at .gradle-local`,
  );
  assert.match(
    content,
    /function Get-AndroidCxxCachePaths/,
    `${script} should enumerate Android CMake cache directories`,
  );
  assert.ok(
    content.includes('node_modules'),
    `${script} should include native package CMake caches under node_modules`,
  );
  assert.ok(
    content.includes('EndsWith("\\android\\.cxx"'),
    `${script} should limit node_modules cleanup to Android .cxx caches`,
  );
  assert.match(
    content,
    /Clear-StaleAndroidCxxCache -ProjectRoot \$projectRoot/,
    `${script} should clear stale CMake cache after resolving project root`,
  );
  assert.match(
    content,
    /Using short Gradle cache:/,
    `${script} should make the active short cache path visible in logs`,
  );
  assert.doesNotMatch(
    content,
    /\$env:GRADLE_USER_HOME = Join-Path \$projectRoot "\.gradle-local"/,
    `${script} should not place Gradle cache under the long project path`,
  );
}
