#!/usr/bin/env python3
"""Preview or install James's fallback quality files without replacing local policy."""

import argparse
import json
import subprocess
import sys
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"
VERSIONS = {
    "@types/node": "24.13.3",
    "lefthook": "2.1.10",
    "oxfmt": "0.56.0",
    "oxlint": "1.71.0",
    "typescript": "6.0.3",
}
SCRIPTS = {
    "quality:lint": "node .quality/javascript.ts lint",
    "quality:format": "node .quality/javascript.ts format",
    "quality:format:write": "node .quality/javascript.ts write",
    "quality:types": "node .quality/typecheck.ts",
    "quality:repository": "node .quality/repository.ts",
    "quality:check": "npm run quality:repository && npm run quality:lint && npm run quality:format && npm run quality:types",
}
POLICY_GLOBS = (
    "tsconfig*.json", "*eslint*", ".oxlintrc*", ".oxfmtrc*", "biome.json*",
    ".prettierrc*", "prettier.config.*", "lefthook.*", ".lefthook*", ".husky",
    "rome.json", "deno.json*", "jsconfig*.json", ".quality", ".editorconfig",
    "AGENTS.md", "CLAUDE.md",
)


def package_at(root):
    target = root / "package.json"
    if target.is_symlink():
        raise ValueError("Refusing a symlink package.json")
    package = json.loads(target.read_text()) if target.exists() else {}
    if not isinstance(package, dict):
        raise ValueError("package.json must contain an object")
    for key in ("scripts", "devDependencies", "dependencies", "optionalDependencies", "peerDependencies"):
        if not isinstance(package.get(key, {}), dict):
            raise ValueError(f"package.json {key} must contain an object")
    return package


def local_policy(root, package):
    found = {str(p.relative_to(root)) for pattern in POLICY_GLOBS for p in root.glob(pattern)}
    for name in package.get("scripts", {}):
        if name in SCRIPTS or any(term in name.lower() for term in ("lint", "format", "typecheck", "check", "prepare")):
            found.add(f"package.json scripts.{name}")
    for field in ("devDependencies", "dependencies", "optionalDependencies", "peerDependencies"):
        for name in package.get(field, {}):
            if name in VERSIONS or any(term in name for term in ("eslint", "prettier", "biome", "husky")):
                found.add(f"package.json {field}.{name}")
    if package.get("workspaces") or (root / "pnpm-workspace.yaml").exists():
        found.add("workspace configuration")
    if any((root / name).exists() for name in ("apps", "packages")):
        found.add("workspace-shaped repository; inspect package-local policy")
    for name in ("eslintConfig", "prettier", "lint-staged"):
        if name in package:
            found.add(f"package.json {name}")
    if package.get("type") not in (None, "module"):
        found.add("existing package module system; Node ESM preset does not apply")
    listing = subprocess.run(["git", "-C", str(root), "ls-files", "--cached", "--others",
                              "--exclude-standard", "-z"], capture_output=True, check=True)
    modules = (b".ts", b".tsx", b".mts", b".cts", b".js", b".jsx", b".mjs", b".cjs")
    if package.get("type") != "module" and any(
        file.endswith(modules) for file in listing.stdout.split(b"\0")
    ):
        found.add("existing modules without an ESM package policy; inspect module semantics")
    hooks = subprocess.run(["git", "-C", str(root), "config", "--get", "core.hooksPath"],
                           capture_output=True, text=True)
    if hooks.returncode == 0:
        found.add("existing core.hooksPath")
    git_dir = subprocess.run(["git", "-C", str(root), "rev-parse", "--path-format=absolute",
                              "--git-path", "hooks"], capture_output=True, text=True, check=True)
    for name in ("pre-commit", "pre-push"):
        if (Path(git_dir.stdout.strip()) / name).exists():
            found.add(f"existing Git {name} hook")
    if (root / ".gitignore").exists():
        for probe in ("node_modules", "node_modules/__typescript_defaults_probe__"):
            ignored = subprocess.run(["git", "-C", str(root), "check-ignore", "--no-index",
                                      probe], capture_output=True)
            if ignored.returncode != 0:
                found.add("existing .gitignore does not exclude dependency files and directories; preserve and inspect")
                break
    return sorted(found)


def asset_targets(root):
    files = {}
    for file in ASSETS.rglob("*"):
        if not file.is_file():
            continue
        relative = file.relative_to(ASSETS)
        if relative == Path(".gitignore") and (root / relative).exists():
            continue
        if relative.parts[0] == "quality":
            relative = Path(".quality", *relative.parts[1:])
        files[root / relative] = file
    return files


def apply(root, package, targets):
    package_file = root / "package.json"
    original = package_file.read_bytes() if package_file.exists() else None
    original_mode = package_file.stat().st_mode if original is not None else None
    for target in targets:
        if target.exists() or target.is_symlink():
            raise ValueError(f"Refusing to replace {target}")
    package.setdefault("private", True)
    package.setdefault("type", "module")
    package.setdefault("scripts", {}).update(SCRIPTS)
    package.setdefault("devDependencies", {}).update(VERSIONS)
    created = []
    try:
        for target, source in targets.items():
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as output:
                output.write(source.read_bytes())
            created.append(target)
        package_file.write_text(json.dumps(package, indent=2) + "\n")
    except Exception:
        for target in reversed(created):
            target.unlink()
        if original is None:
            package_file.unlink(missing_ok=True)
        else:
            package_file.write_bytes(original)
            package_file.chmod(original_mode)
        quality = root / ".quality"
        if quality.is_dir() and not any(quality.iterdir()):
            quality.rmdir()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.repository.resolve(strict=True)
    git = subprocess.run(["git", "-C", str(root), "rev-parse", "--show-toplevel"],
                         capture_output=True, text=True, check=True)
    if not Path(git.stdout.strip()).samefile(root):
        raise ValueError("Target must be the Git repository root")
    package = package_at(root)
    policy = local_policy(root, package)
    plan = {"repository": str(root), "status": "existing-policy" if policy else "ready",
            "existingPolicy": policy, "files": [str(p.relative_to(root)) for p in asset_targets(root)],
            "devDependencies": VERSIONS, "scripts": SCRIPTS, "packageType": "module"}
    if args.apply and not policy:
        apply(root, package, asset_targets(root))
        plan["status"] = "installed-files"
        plan["next"] = "Install development dependencies with the project package manager, run lefthook install, then quality:check."
    print(json.dumps(plan, indent=2))
    return 2 if args.apply and policy else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"typescript-defaults: {error}", file=sys.stderr)
        sys.exit(1)
