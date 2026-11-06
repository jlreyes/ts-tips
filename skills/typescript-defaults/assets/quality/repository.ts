import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, ".."));
const ignored = new Set([
  "node_modules",
  ".git",
  ".agents",
  ".claude",
  ".build",
  ".test-artifacts",
  "__pycache__",
]);
const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies"];
const exactVersion =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

type Dependency = { field: string; name: string; version: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseDependencies(value: unknown, label: string): Dependency[] {
  if (!isRecord(value)) throw new Error(`${label}: expected a package object`);
  return dependencyFields.flatMap((field) => {
    const dependencies = value[field];
    if (dependencies === undefined) return [];
    if (!isRecord(dependencies)) throw new Error(`${label}.${field}: expected an object`);
    return Object.entries(dependencies).map(([name, version]) => {
      if (typeof version !== "string")
        throw new Error(`${label}.${field}.${name}: expected a version`);
      return { field, name, version };
    });
  });
}

function filesWithin(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesWithin(filename);
    return entry.isFile() ? [filename] : [];
  });
}

function checkDependencies(files: string[]): string[] {
  return files
    .filter((file) => path.basename(file) === "package.json")
    .flatMap((file) => {
      const label = path.relative(root, file);
      const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      return parseDependencies(raw, label)
        .filter((dependency) => !exactVersion.test(dependency.version))
        .map(
          ({ field, name }) => `${label}.${field}.${name}: dependency must use an exact version`,
        );
    });
}

function scriptReferences(file: string): string[] {
  const errors: string[] = [];
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const [index, line] of text.split("\n").entries()) {
    for (const match of line.matchAll(
      /(?<![A-Za-z0-9._/-])(?:\.\/)?scripts\/[A-Za-z0-9._/{}$*-]+/g,
    )) {
      const reference = match[0].replace(/^\.\//, "").replace(/[./-]+$/, "");
      // Variables and globs are runtime expressions, not statically named files.
      if (reference === "scripts" || /[{}$*]/.test(reference)) continue;
      if (!fs.existsSync(path.join(root, reference))) {
        errors.push(`${file}:${index + 1}: missing script path: ${reference}`);
      }
    }
  }
  return errors;
}

function checkScriptPaths(files: string[]): string[] {
  const glue = files
    .map((file) => path.relative(root, file))
    .filter(
      (file) =>
        ["package.json", "lefthook.yml", "Makefile"].includes(file) || file.startsWith("scripts/"),
    );
  return glue.flatMap(scriptReferences);
}

const folderLimit = 15;
const folderExceptions = new Map([
  [".", { maximum: 30, reason: "Location-fixed root tool configuration." }],
]);

function folderCounts(): Map<string, number> {
  const inventory = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);
  const counts = new Map<string, number>();
  for (const file of new Set(inventory)) {
    if (!fs.existsSync(path.join(root, file))) continue;
    const directory = path.dirname(file);
    const segments = directory.split(path.sep);
    if (segments.some((part) => part !== "." && (part.startsWith(".") || ignored.has(part))))
      continue;
    if (segments.includes("changelog")) continue;
    counts.set(directory, (counts.get(directory) ?? 0) + 1);
  }
  return counts;
}

function checkFolders(): string[] {
  const counts = folderCounts();
  const errors: string[] = [];
  for (const [directory, count] of counts) {
    const exception = folderExceptions.get(directory);
    if (count > (exception?.maximum ?? folderLimit)) {
      errors.push(
        `${directory}: ${count} direct files exceeds ${exception?.maximum ?? folderLimit}; group by domain`,
      );
    }
  }
  for (const [directory, exception] of folderExceptions) {
    if (directory !== "." && (counts.get(directory) ?? 0) <= folderLimit) {
      errors.push(`${directory}: remove stale folder exception (${exception.reason})`);
    }
  }
  return errors;
}

if (!fs.statSync(root).isDirectory()) throw new Error(`Not a repository directory: ${root}`);
const files = filesWithin(root);
const mode = process.argv[3] ?? "all";
if (mode !== "all" && mode !== "dependencies") throw new Error("Unknown repository check mode");
const errors = [
  ...checkDependencies(files),
  ...(mode === "all" ? [...checkScriptPaths(files), ...checkFolders()] : []),
];
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Repository ${mode === "all" ? "dependency, script path, and folder" : "dependency"} policies passed`,
  );
}
