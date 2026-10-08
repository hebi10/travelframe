import fs from "node:fs";
import path from "node:path";

const severityOrder = ["critical", "high", "moderate", "low", "info"];

export const normalizeAudit = (filePath) => {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data || !data.vulnerabilities || typeof data.vulnerabilities !== "object") {
    throw new Error(`Missing vulnerabilities report in ${filePath}`);
  }

  return Object.entries(data.vulnerabilities)
    .map(([name, details]) => ({
      name,
      severity: String(details.severity ?? "unknown"),
      direct: details.isDirect === true,
      fixAvailable:
        details.fixAvailable === true
          ? "Yes"
          : details.fixAvailable && typeof details.fixAvailable === "object"
            ? `${details.fixAvailable.name ?? name}@${details.fixAvailable.version ?? "unknown"}`
            : "No",
      via: (details.via ?? [])
        .filter((item) => item && typeof item === "object")
        .map((item) => item.title ?? item.url ?? "")
        .filter(Boolean)
        .slice(0, 2)
        .join("; ")
    }))
    .sort((a, b) =>
      (severityOrder.indexOf(a.severity) < 0 ? 99 : severityOrder.indexOf(a.severity)) -
        (severityOrder.indexOf(b.severity) < 0 ? 99 : severityOrder.indexOf(b.severity)) ||
      a.name.localeCompare(b.name)
    );
};

export const summarizeAudits = (paths) => {
  const lines = [
    "# NPM dependency audit",
    "",
    "Advisory results are diagnostic. Do not force incompatible upgrades automatically.",
    ""
  ];

  for (const filePath of paths) {
    const packages = normalizeAudit(filePath);
    lines.push(`## ${path.basename(filePath)} — ${packages.length} affected packages`, "");
    lines.push("| Package | Severity | Direct | Fix available | Advisory |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const entry of packages) {
      const safe = (value) => String(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
      lines.push(
        `| ${safe(entry.name)} | ${safe(entry.severity)} | ${entry.direct ? "Yes" : "No"} | ${safe(entry.fixAvailable)} | ${safe(entry.via)} |`
      );
    }
    if (!packages.length) lines.push("| None | - | - | - | - |");
    lines.push("");
  }

  return lines.join("\n");
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const report = summarizeAudits(process.argv.slice(2));
  fs.writeFileSync("audit-summary.md", report + "\n", "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n", "utf8");
  }
  console.log(report);
}
