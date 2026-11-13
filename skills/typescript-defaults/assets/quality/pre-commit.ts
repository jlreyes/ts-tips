import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function capture(args: string[], cwd: string): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || "Git snapshot failed");
  return result.stdout;
}

function source(file: string, snapshot: string): boolean {
  const absolute = path.join(snapshot, file);
  if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile()) return false;
  if (
    file.split("/").some((part) => ["node_modules", ".agents", ".claude", ".build"].includes(part))
  ) {
    return false;
  }
  if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)) return true;
  return !path.extname(file) && /^#![^\n]*\bnode(?:\s|$)/.test(fs.readFileSync(absolute, "utf8"));
}

function check(snapshot: string, mode: string, files: string[]): void {
  const result = spawnSync(process.execPath, [".quality/javascript.ts", mode, ...files], {
    cwd: snapshot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Staged ${mode} check failed`);
}

function main(): void {
  const root = capture(["rev-parse", "--show-toplevel"], process.cwd()).trim();
  const changed = capture(["diff", "--cached", "--name-only", "-z"], root)
    .split("\0")
    .filter(Boolean);
  if (!changed.length) return;
  const indexed = capture(["ls-files", "-z"], root).split("\0").filter(Boolean);
  const configChanged = changed.some((file) =>
    [
      ".oxlintrc.json",
      ".oxfmtrc.json",
      ".quality/javascript.ts",
      ".quality/pre-commit.ts",
      "lefthook.yml",
      "package.json",
      "pnpm-lock.yaml",
      "package-lock.json",
    ].includes(file),
  );
  using scope = new DisposableStack();
  const snapshot = scope.adopt(
    fs.mkdtempSync(path.join(os.tmpdir(), "ts-defaults-index-")),
    (directory) => fs.rmSync(directory, { recursive: true, force: true }),
  );
  capture(["checkout-index", "--all", `--prefix=${snapshot}/`], root);
  const files = (configChanged ? indexed : changed).filter((file) => source(file, snapshot));
  if (!files.length) return;
  for (const file of [".oxlintrc.json", ".oxfmtrc.json", ".quality/javascript.ts"]) {
    if (!fs.existsSync(path.join(snapshot, file))) throw new Error(`Missing staged ${file}`);
  }
  fs.symlinkSync(path.join(root, "node_modules"), path.join(snapshot, "node_modules"), "dir");
  check(snapshot, "lint", files);
  check(snapshot, "format", files);
}

main();
