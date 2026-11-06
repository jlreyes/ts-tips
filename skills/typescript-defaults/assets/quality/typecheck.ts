import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const entrypointSuffix = ".__entrypoint__.js";

function sourceFiles() {
  const listing = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  );
  if (listing.status !== 0) throw new Error(listing.stderr || "Cannot enumerate Node entrypoints");
  const entrypoints: Map<string, string> = new Map();
  const modules: string[] = [];
  for (const relative of new Set(listing.stdout.split("\0").filter(Boolean))) {
    if (/^(?:node_modules|\.agents|\.claude|\.test-artifacts)\//.test(relative)) continue;
    if (relative.split("/").includes(".build")) continue;
    const source = path.join(root, relative);
    if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) continue;
    if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(relative)) modules.push(source);
    else if (
      !path.extname(relative) &&
      /^#![^\n]*\bnode(?:\s|$)/.test(fs.readFileSync(source, "utf8"))
    ) {
      entrypoints.set(source + entrypointSuffix, source);
    }
  }
  return { modules, entrypoints };
}

function compilerHost(entrypoints: Map<string, string>, options: ts.CompilerOptions) {
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  // Virtual JS names let the compiler check extensionless commands at their real
  // directory, preserving relative module resolution without writing source copies.
  host.getSourceFile = (filename, languageVersion, onError, shouldCreateNewSourceFile) => {
    const original = entrypoints.get(filename);
    if (!original) {
      return originalGetSourceFile(filename, languageVersion, onError, shouldCreateNewSourceFile);
    }
    return ts.createSourceFile(
      filename,
      fs.readFileSync(original, "utf8"),
      languageVersion,
      true,
      ts.ScriptKind.JS,
    );
  };
  return host;
}

function check() {
  const configPath = path.join(root, "tsconfig.json");
  const configErrors: ts.Diagnostic[] = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => configErrors.push(diagnostic),
    },
  );
  if (!parsed) return configErrors;
  if (parsed.errors.length) return parsed.errors;
  const { modules, entrypoints } = sourceFiles();
  const program = ts.createProgram({
    rootNames: [...new Set([...parsed.fileNames, ...modules, ...entrypoints.keys()])],
    options: parsed.options,
    host: compilerHost(entrypoints, parsed.options),
  });
  return ts.getPreEmitDiagnostics(program);
}

const diagnostics = check();
if (diagnostics.length) {
  const output = ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (filename) => filename,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  });
  process.stderr.write(output.replaceAll(entrypointSuffix, ""));
  process.exitCode = 1;
}
