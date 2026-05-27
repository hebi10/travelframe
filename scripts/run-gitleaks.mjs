import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GITLEAKS_VERSION = "8.30.1";
const RELEASE_BASE_URL = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const CACHE_ROOT = path.join(PROJECT_ROOT, ".tmp", "tools", "gitleaks", `v${GITLEAKS_VERSION}`);
const SCAN_ROOT = path.join(PROJECT_ROOT, ".tmp", "gitleaks-scan-tree");
const CONFIG_PATH = path.join(PROJECT_ROOT, ".gitleaks.toml");
const SCAN_HISTORY = process.argv.includes("--history");

const ASSETS = {
  "darwin-arm64": {
    name: "gitleaks_8.30.1_darwin_arm64.tar.gz",
    sha256: "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5",
  },
  "darwin-x64": {
    name: "gitleaks_8.30.1_darwin_x64.tar.gz",
    sha256: "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709",
  },
  "linux-arm64": {
    name: "gitleaks_8.30.1_linux_arm64.tar.gz",
    sha256: "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080",
  },
  "linux-x64": {
    name: "gitleaks_8.30.1_linux_x64.tar.gz",
    sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  },
  "win32-arm64": {
    name: "gitleaks_8.30.1_windows_arm64.zip",
    sha256: "b95f5e4f5c425cedca7ee203d9afd29597e692c4924a12ed42f970537c72cc0f",
  },
  "win32-ia32": {
    name: "gitleaks_8.30.1_windows_x32.zip",
    sha256: "190ad53db301eec3e90afe3a1a75270768b8ebf89e731345e19421c32c1ae1a1",
  },
  "win32-x64": {
    name: "gitleaks_8.30.1_windows_x64.zip",
    sha256: "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e",
  },
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function commandExists(command, args) {
  const result = childProcess.spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) {
    return null;
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? null;
}

function findPathBinary() {
  if (process.platform === "win32") {
    return commandExists("where.exe", ["gitleaks"]);
  }
  return commandExists("sh", ["-c", "command -v gitleaks"]);
}

function findCachedBinary(dir) {
  if (!fs.existsSync(dir)) {
    return null;
  }
  const targetName = process.platform === "win32" ? "gitleaks.exe" : "gitleaks";
  const pending = [dir];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.name === targetName) {
        return fullPath;
      }
    }
  }
  return null;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const request = (targetUrl, redirectsLeft = 5) => {
      https
        .get(
          targetUrl,
          {
            headers: {
              "User-Agent": "travel-frame-gitleaks-runner",
            },
          },
          (response) => {
            if (
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location &&
              redirectsLeft > 0
            ) {
              response.resume();
              request(response.headers.location, redirectsLeft - 1);
              return;
            }

            if (response.statusCode !== 200) {
              response.resume();
              reject(new Error(`Download failed with HTTP ${response.statusCode}: ${targetUrl}`));
              return;
            }

            const file = fs.createWriteStream(destination);
            response.pipe(file);
            file.on("finish", () => {
              file.close(resolve);
            });
            file.on("error", reject);
          }
        )
        .on("error", reject);
    };
    request(url);
  });
}

function extractArchive(archivePath, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });

  const result =
    process.platform === "win32"
      ? childProcess.spawnSync(
          "powershell",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "& { param($ArchivePath, $DestinationPath) Expand-Archive -LiteralPath $ArchivePath -DestinationPath $DestinationPath -Force }",
            archivePath,
            destination,
          ],
          { stdio: "inherit", windowsHide: true }
        )
      : childProcess.spawnSync("tar", ["-xzf", archivePath, "-C", destination], {
          stdio: "inherit",
        });

  if (result.status !== 0) {
    fail(`Failed to extract ${path.basename(archivePath)}.`);
  }
}

async function installGitleaks() {
  const asset = ASSETS[`${process.platform}-${process.arch}`];
  if (!asset) {
    fail(`Unsupported platform for managed gitleaks install: ${process.platform}/${process.arch}`);
  }

  const archivePath = path.join(CACHE_ROOT, asset.name);
  const extractDir = path.join(CACHE_ROOT, "bin");
  const cachedBinary = findCachedBinary(extractDir);
  if (cachedBinary) {
    return cachedBinary;
  }

  console.log(`Installing gitleaks v${GITLEAKS_VERSION} into ${path.relative(PROJECT_ROOT, CACHE_ROOT)}...`);
  await download(`${RELEASE_BASE_URL}/${asset.name}`, archivePath);

  const actualSha256 = sha256(archivePath);
  if (actualSha256 !== asset.sha256) {
    fs.rmSync(archivePath, { force: true });
    fail(`Downloaded gitleaks archive checksum mismatch for ${asset.name}.`);
  }

  extractArchive(archivePath, extractDir);
  const binary = findCachedBinary(extractDir);
  if (!binary) {
    fail(`Could not find gitleaks executable after extracting ${asset.name}.`);
  }
  if (process.platform !== "win32") {
    fs.chmodSync(binary, 0o755);
  }
  return binary;
}

function resolveConfiguredBinary() {
  if (process.env.GITLEAKS_BIN) {
    return path.resolve(process.env.GITLEAKS_BIN);
  }

  const cached = findCachedBinary(path.join(CACHE_ROOT, "bin"));
  if (cached) {
    return cached;
  }

  return findPathBinary();
}

function runGitleaks(binary) {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail(".gitleaks.toml was not found.");
  }

  const source = SCAN_HISTORY ? PROJECT_ROOT : prepareCurrentTreeScanRoot();
  const args = ["detect", "--source", source, "--config", CONFIG_PATH, "--verbose", "--redact"];
  if (!SCAN_HISTORY) {
    args.push("--no-git", "--no-banner");
  }
  const result = childProcess.spawnSync(binary, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    fail(`Failed to run gitleaks: ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
}

function listCurrentRepositoryFiles() {
  const result = childProcess.spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: PROJECT_ROOT,
    encoding: "buffer",
    windowsHide: true,
  });
  if (result.status !== 0) {
    fail("Failed to list repository files for secrets scan.");
  }
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((relativePath) => !relativePath.startsWith(".tmp/"));
}

function prepareCurrentTreeScanRoot() {
  fs.rmSync(SCAN_ROOT, { recursive: true, force: true });
  fs.mkdirSync(SCAN_ROOT, { recursive: true });

  for (const relativePath of listCurrentRepositoryFiles()) {
    const source = path.join(PROJECT_ROOT, relativePath);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      continue;
    }
    const destination = path.join(SCAN_ROOT, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  return SCAN_ROOT;
}

const binary = resolveConfiguredBinary() ?? (await installGitleaks());
runGitleaks(binary);
