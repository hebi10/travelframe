import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const json = file => JSON.parse(fs.readFileSync(file, "utf8"));

export function collectSourcePaths(map) {
  if (!map || map.version !== 3) throw new Error("Invalid source map");
  if (Array.isArray(map.sections)) {
    return map.sections.flatMap(section => {
      if (!section.map) throw new Error("Unresolved indexed source map section");
      return collectSourcePaths(section.map);
    });
  }
  if (!Array.isArray(map.sources)) throw new Error("Missing source map paths");
  const root = typeof map.sourceRoot === "string" ? map.sourceRoot : "";
  return map.sources.filter(source => typeof source === "string").map(source => {
    const normalized = source.replace(/\\/g, "/");
    return root && !/^(?:[a-z]+:|\/)/i.test(normalized)
      ? root.replace(/\\/g, "/").replace(/\/$/, "") + "/" + normalized
      : normalized;
  });
}

export function packageFromSource(source) {
  const normalized = source.replace(/\\/g, "/");
  const marker = "node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index < 0 || (index > 0 && normalized[index - 1] !== "/")) return null;
  const parts = normalized.slice(index + marker.length).split("/");
  const name = parts[0]?.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  return name && /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name) && !name.startsWith(".") ? name : null;
}

export function analyzeAndroidSources(maps, vulnerabilities, lockPackages) {
  if (!Array.isArray(maps) || !maps.length) throw new Error("No Android production source maps");
  if (!vulnerabilities || typeof vulnerabilities !== "object" || !lockPackages || typeof lockPackages !== "object") {
    throw new Error("Missing audit or lockfile package data");
  }
  const paths = new Set(maps.flatMap(collectSourcePaths));
  const packageCounts = new Map();
  for (const source of paths) {
    const name = packageFromSource(source);
    if (name) packageCounts.set(name, (packageCounts.get(name) ?? 0) + 1);
  }
  const anchors = ["react", "react-native", "expo-router"];
  if (!anchors.every(name => packageCounts.has(name))) {
    throw new Error("Incomplete Android source map evidence: expected React, React Native and Expo Router paths");
  }
  const packages = Object.entries(vulnerabilities)
    .filter(([, finding]) => ["critical", "high"].includes(finding.severity))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, finding]) => {
      if (!Array.isArray(finding.nodes) || !finding.nodes.length) {
        throw new Error("Missing affected dependency locations for " + name);
      }
      const locations = finding.nodes.map(location => {
        if (typeof location !== "string" || !location.startsWith("node_modules/") || !lockPackages[location]?.version) {
          throw new Error("Audit/lockfile mismatch for " + name);
        }
        return { location, version: lockPackages[location].version };
      });
      const sourceCount = packageCounts.get(name) ?? 0;
      return {
        name, severity: finding.severity, affectedLockLocations: locations,
        androidExportSourceCount: sourceCount,
        presence: sourceCount ? "package-name-present" : "not-observed-in-maps"
      };
    });
  return {
    mapCount: maps.length, uniqueSourceCount: paths.size,
    mappedDependencyPackageCount: packageCounts.size, anchors, packages,
    limitations: [
      "Package-name presence does not prove a specific vulnerable code path is executed.",
      "Source-map absence alone is not proof of safety or absence from a signed APK.",
      "Nested package versions are reported from the audit/lockfile, not inferred from package-name presence.",
      "Native dependencies, deployed Functions, live data and Play billing require independent verification."
    ]
  };
}

function listMaps(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listMaps(file));
    else if (entry.isFile() && entry.name.endsWith(".map")) result.push(file);
  }
  return result;
}

function explainPackage(name) {
  const output = execFileSync("npm", ["explain", name, "--json"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]
  });
  const entries = JSON.parse(output);
  if (!Array.isArray(entries) || !entries.length) throw new Error("No npm explain evidence for " + name);
  const result = new Map();
  const walk = (entry, depth = 0) => {
    if (!entry || typeof entry.name !== "string" || depth > 15) return;
    const label = entry.name + "@" + (entry.version ?? "unknown");
    const parents = (entry.dependents ?? []).map(dependent => dependent.from).filter(Boolean);
    for (const parent of parents) {
      if (typeof parent.name !== "string") continue;
      const parentLabel = parent.name + "@" + (parent.version ?? "root");
      result.set(parentLabel + " -> " + label, { from: parentLabel, to: label });
      walk(parent, depth + 1);
    }
  };
  for (const entry of entries) walk(entry);
  return [...result.values()].sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [exportDirectory, auditPath, lockPath, outputPath] = process.argv.slice(2);
  if (!exportDirectory || !auditPath || !lockPath || !outputPath) {
    throw new Error("Expected Android export directory, app production audit, lockfile and report path");
  }
  const maps = listMaps(exportDirectory).map(json);
  const report = analyzeAndroidSources(maps, json(auditPath).vulnerabilities, json(lockPath).packages);
  for (const item of report.packages) item.dependencyEdges = explainPackage(item.name);
  const evidence = {
    mode: "Android production JavaScript/Hermes export diagnostic",
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    ...report
  };
  fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + "\n");
  const lines = [
    "## Android dependency reachability diagnostic",
    "",
    "Production Android source maps inspected; no bundle or source map uploaded.",
    "",
    "| Affected package | Severity | Mapped source paths | Observation |",
    "| --- | --- | ---: | --- |",
    ...report.packages.map(item => "| " + item.name + " | " + item.severity + " | " +
      item.androidExportSourceCount + " | " + item.presence + " |"),
    "", ...report.limitations
  ];
  const summary = lines.join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}
