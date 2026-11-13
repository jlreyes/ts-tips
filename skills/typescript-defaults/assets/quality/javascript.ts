import fs from "node:fs";
import ts from "typescript";
import os from "node:os";
import path from "node:path";
import type { SpawnSyncOptions } from "node:child_process";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const mode = process.argv[2];
if (!mode || !["lint", "format", "write"].includes(mode)) {
  throw new Error("Usage: node scripts/check/javascript.ts lint|format|write");
}
process.chdir(root);

function selectedPaths() {
  const requested = process.argv.slice(3).filter((argument) => argument !== "--");
  if (requested.length) return requested;
  const listing = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      encoding: "utf8",
    },
  );
  if (listing.status !== 0)
    throw new Error(listing.stderr || "Cannot enumerate JavaScript sources");
  return listing.stdout.split("\0").filter(Boolean);
}

function sourceFiles() {
  const modules = [];
  const entrypoints = [];
  for (const file of new Set(selectedPaths())) {
    if (
      file
        .split("/")
        .some((part) =>
          ["node_modules", ".agents", ".claude", ".test-artifacts", ".build"].includes(part),
        )
    )
      continue;
    if (!fs.existsSync(file)) continue;
    if (!fs.lstatSync(file).isFile()) continue;
    if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)) modules.push(file);
    else if (!path.extname(file) && /^#![^\n]*\bnode(?:\s|$)/.test(fs.readFileSync(file, "utf8"))) {
      entrypoints.push(file);
    }
  }
  if (!modules.length && !entrypoints.length) throw new Error("No JavaScript source files found");
  const safe = (file: string) => (file.startsWith("-") ? `./${file}` : file);
  return { modules: modules.map(safe).sort(), entrypoints: entrypoints.map(safe).sort() };
}

function run(tool: string, args: string[], options: SpawnSyncOptions = {}) {
  const result = spawnSync(path.join(root, "node_modules/.bin", tool), args, {
    stdio: "inherit",
    ...options,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

function lintEntrypoints(entrypoints: string[]) {
  // Oxlint ignores extensionless files; temporary .js copies preserve their full source.
  using scope = new DisposableStack();
  const temporary = scope.adopt(
    fs.mkdtempSync(path.join(os.tmpdir(), "hm-js-quality-")),
    (directory) => fs.rmSync(directory, { recursive: true, force: true }),
  );
  const copies = entrypoints.map((file) => {
    const target = path.join(temporary, `${file}.js`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
    return target;
  });
  if (!copies.length) return 0;
  return run("oxlint", [
    "-c",
    path.join(root, ".oxlintrc.json"),
    "--disable-nested-config",
    "--no-ignore",
    "--deny-warnings",
    ...copies,
  ]).status;
}

function formatEntrypoints(entrypoints: string[], options: string[]) {
  let failed = false;
  for (const file of entrypoints) {
    const input = fs.readFileSync(file, "utf8");
    const result = run("oxfmt", [...options, "--stdin-filepath", `${file}.js`], {
      input,
      stdio: ["pipe", "pipe", "inherit"],
    });
    if (result.status !== 0) failed = true;
    else if (mode === "write") fs.writeFileSync(file, result.stdout);
    else if (result.stdout !== input) {
      console.error(`Formatting differs: ${file}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

function positiveInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Formatter ${label} must be a positive integer`);
  }
  return value;
}

function booleanSetting(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new Error(`Formatter ${label} must be a boolean`);
  return value;
}

function trailingCommaSetting(value: unknown) {
  if (value !== "all" && value !== "es5" && value !== "none") {
    throw new Error("Formatter trailingComma must be all, es5, or none");
  }
  return value;
}

function formatterConfiguration() {
  const config: unknown = JSON.parse(fs.readFileSync(".oxfmtrc.json", "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Formatter configuration must be an object");
  }
  const supported = new Set([
    "$schema",
    "printWidth",
    "tabWidth",
    "semi",
    "singleQuote",
    "trailingComma",
    "ignorePatterns",
  ]);
  if (Object.keys(config).some((key) => !supported.has(key))) {
    throw new Error("Formatter configuration contains an unsupported setting");
  }
  return {
    printWidth: positiveInteger(
      "printWidth" in config ? config.printWidth : undefined,
      "printWidth",
    ),
    tabWidth: positiveInteger("tabWidth" in config ? config.tabWidth : undefined, "tabWidth"),
    semi: booleanSetting("semi" in config ? config.semi : undefined, "semi"),
    singleQuote: booleanSetting(
      "singleQuote" in config ? config.singleQuote : undefined,
      "singleQuote",
    ),
    trailingComma: trailingCommaSetting(
      "trailingComma" in config ? config.trailingComma : undefined,
    ),
    ignorePatterns: [],
  };
}

function formatSources(modules: string[], entrypoints: string[]) {
  using scope = new DisposableStack();
  const temporary = scope.adopt(
    fs.mkdtempSync(path.join(os.tmpdir(), "hm-format-quality-")),
    (directory) => fs.rmSync(directory, { recursive: true, force: true }),
  );
  const config = formatterConfiguration();
  // Inventory owns scope; formatter ignore files/config must not hide selected code.
  const configPath = path.join(temporary, "format.json");
  fs.writeFileSync(configPath, JSON.stringify(config));
  const emptyIgnore = path.join(temporary, "empty-ignore");
  fs.writeFileSync(emptyIgnore, "");
  const options = ["--config", configPath, "--disable-nested-config", "--ignore-path", emptyIgnore];
  const sourceStatus = modules.length
    ? run("oxfmt", [mode === "write" ? "--write" : "--check", ...options, ...modules]).status
    : 0;
  const entrypointStatus = formatEntrypoints(entrypoints, options);
  return sourceStatus === 0 && entrypointStatus === 0 ? 0 : 1;
}

function assertionExpression(node: ts.Node): ts.Node {
  if (ts.isParenthesizedExpression(node)) return assertionExpression(node.expression);
  return node;
}

function isUnknownAssertion(node: ts.Node): boolean {
  const expression = assertionExpression(node);
  return (
    (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) &&
    expression.type.kind === ts.SyntaxKind.UnknownKeyword
  );
}

function checkAssertionChains(files: string[]): number {
  let failed = false;
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (
        (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
        isUnknownAssertion(node.expression)
      ) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        console.error(`${file}:${line + 1}: prohibited assertion through unknown`);
        failed = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return failed ? 1 : 0;
}

function checkSuppressions(files: string[]) {
  const forbidden =
    /\b(?:oxlint|eslint)-disable\b|\b(?:oxfmt|prettier)-ignore\b|@ts-(?:nocheck|ignore|expect-error)\b/;
  let failed = false;
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!forbidden.test(line)) return;
      console.error(`${file}:${index + 1}: prohibited inline quality suppression`);
      failed = true;
    });
  }
  return failed ? 1 : 0;
}

const { modules, entrypoints } = sourceFiles();
let sourceStatus;
let entrypointStatus;
const suppressionStatus = checkSuppressions([...modules, ...entrypoints]);
const assertionStatus = checkAssertionChains(modules);
if (mode === "lint") {
  sourceStatus = modules.length
    ? run("oxlint", ["--disable-nested-config", "--no-ignore", "--deny-warnings", ...modules])
        .status
    : 0;
  entrypointStatus = lintEntrypoints(entrypoints);
} else {
  sourceStatus = formatSources(modules, entrypoints);
  entrypointStatus = 0;
}
process.exitCode =
  sourceStatus === 0 && entrypointStatus === 0 && suppressionStatus === 0 && assertionStatus === 0
    ? 0
    : 1;
