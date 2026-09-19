import assert from "node:assert/strict";
import fs from "node:fs";

const recordsSource = fs.readFileSync(
  "features/records/BodyFrameRecordsScreen.tsx",
  "utf8"
);

for (const token of [
  "styles.projectGrid",
  'flexDirection: "row"',
  'flexWrap: "wrap"',
  'width: "48%"',
  "aspectRatio: 3 / 4",
  "progressPercent",
  "변화 영상",
  "setLastActiveProjectId",
  "archiveBodyProject(project.id, false)"
]) {
  assert.ok(
    recordsSource.includes(token),
    `Body Frame records grid should contain ${token}`
  );
}

assert.equal(
  recordsSource.includes("styles.projectList"),
  false,
  "records should no longer use the legacy vertical project list"
);

assert.equal(
  recordsSource.includes("styles.projectArrow"),
  false,
  "photo-first project cards should not spend space on a decorative arrow"
);

const coverIndex = recordsSource.indexOf("styles.coverFrame");
const copyIndex = recordsSource.indexOf("styles.projectCopy");
assert.ok(
  coverIndex >= 0 && copyIndex > coverIndex,
  "project cover should remain the first visual element in each card"
);

assert.ok(
  recordsSource.includes('accessibilityLabel={`${project.name} 프로젝트 열기`}'),
  "grid project cards should keep an explicit accessibility label"
);

console.log("Body Frame UI Stage 3 records grid contract passed.");
