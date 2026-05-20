import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const runnerPath = "tests/firebase-rules-emulator-runner.mjs";
const firebaseCommandLabel = "firebase emulators:exec";
const javaExecutableName = process.platform === "win32" ? "java.exe" : "java";
const pathDelimiter = path.delimiter;
const FIREBASE_CONFIG_DIR = path.join(root, ".tmp", "firebase-config");

const unique = (values) => [...new Set(values.filter(Boolean))];

const candidateHomesFromDirectory = (directory) => {
  if (!directory || !fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /jdk|java|temurin|zulu|microsoft/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
};

const javaCandidates = () => {
  const homes = unique([
    process.env.JAVA_HOME,
    process.env.JAVA_HOME_21_X64,
    process.env.JAVA_HOME_22_X64,
    process.env.JAVA_HOME_23_X64,
    process.env.JAVA_HOME_24_X64,
    ...(process.platform === "win32"
      ? [
          ...candidateHomesFromDirectory(path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Java")),
          ...candidateHomesFromDirectory(path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Microsoft")),
          ...candidateHomesFromDirectory(path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Eclipse Adoptium")),
          ...candidateHomesFromDirectory(path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Java"))
        ]
      : [
          ...candidateHomesFromDirectory("/usr/lib/jvm"),
          ...candidateHomesFromDirectory("/Library/Java/JavaVirtualMachines")
        ])
  ]);

  return [
    ...homes.map((home) => ({
      command: path.join(home, "bin", javaExecutableName),
      home
    })),
    {
      command: "java",
      home: process.env.JAVA_HOME
    }
  ];
};

const getJavaMajorVersion = (candidate) => {
  const result = spawnSync(
    candidate.command,
    ["-Duser.language=en", "-Dfile.encoding=UTF-8", "-version"],
    { encoding: "utf8" }
  );

  if (result.error) {
    return {
      ok: false,
      detail: `${candidate.command}: ${result.error.code ?? result.error.message}`
    };
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = output.match(/version "([1-9][0-9]*)/) ?? output.match(/openjdk version "([1-9][0-9]*)/);
  const major = match ? Number.parseInt(match[1], 10) : NaN;

  if (result.status !== 0 || !Number.isFinite(major)) {
    return {
      ok: false,
      detail: `${candidate.command}: unable to read Java version`
    };
  }

  return {
    ok: true,
    major,
    detail: `${candidate.command}: Java ${major}`
  };
};

const selectJava = () => {
  const failures = [];

  for (const candidate of javaCandidates()) {
    if (candidate.command !== "java" && !fs.existsSync(candidate.command)) {
      continue;
    }

    const version = getJavaMajorVersion(candidate);
    if (version.ok && version.major >= 21) {
      return { ...candidate, major: version.major };
    }

    failures.push(version.detail);
  }

  console.error("Firebase Rules emulator requires Java 21 or newer.");
  console.error("Checked Java candidates:");
  for (const failure of failures.length > 0 ? failures : ["No Java executable found."]) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
};

const selectedJava = selectJava();
const selectedJavaBin = selectedJava.home ? path.join(selectedJava.home, "bin") : undefined;

fs.mkdirSync(FIREBASE_CONFIG_DIR, { recursive: true });

const env = {
  ...process.env,
  FIREBASE_CONFIG_DIR,
  XDG_CONFIG_HOME: FIREBASE_CONFIG_DIR,
  ...(selectedJava.home ? { JAVA_HOME: selectedJava.home } : {}),
  PATH: unique([selectedJavaBin, process.env.PATH]).join(pathDelimiter)
};

const firebaseVersion = spawnSync("firebase", ["--version"], {
  cwd: root,
  encoding: "utf8",
  env,
  shell: process.platform === "win32"
});

if (firebaseVersion.error || firebaseVersion.status !== 0) {
  console.error("Firebase CLI is required to run Firebase Rules emulator tests.");
  if (firebaseVersion.error) {
    console.error(firebaseVersion.error.message);
  }
  if (firebaseVersion.stderr) {
    process.stderr.write(firebaseVersion.stderr);
  }
  process.exit(firebaseVersion.status ?? 1);
}

console.log(`Using Java ${selectedJava.major} for Firebase Rules emulator tests.`);
console.log(`Running ${firebaseCommandLabel}.`);

const result = spawnSync(
  "firebase",
  ["emulators:exec", `node ${runnerPath}`, "--only", "firestore,storage", "--log-verbosity", "SILENT"],
  {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
