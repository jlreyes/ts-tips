// Integration: real npm tarballs, installs, filesystem and tool binaries; no mocks.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageSource = path.join(root, "packages/typescript-standards");

function run(cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

function succeeds(result) {
  assert.equal(result.status, 0, result.output);
}

function rejects(result, diagnostic) {
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, diagnostic);
}

function json(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function pack(source, destination) {
  const result = run(source, "npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    destination,
  ]);
  succeeds(result);
  const [packed] = JSON.parse(result.output);
  return { tarball: path.join(destination, packed.filename), files: packed.files };
}

function tool(cwd, name, ...args) {
  return run(cwd, path.join(cwd, "node_modules/.bin", name), args);
}

function install(cwd, tarball) {
  succeeds(
    run(cwd, "npm", [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-dev",
      "--save-exact",
      tarball,
    ]),
  );
}

const clean = 'export const greeting = "Hello";\n';

const cases = [
  [
    "published file set and documented example",
    ({ consumer, files }) => {
      assert.deepEqual(
        files.map((file) => file.path).sort(),
        [
          "LICENSE",
          "README.md",
          "oxfmt.mjs",
          "oxfmt.d.mts",
          "oxlint.json",
          "package.json",
          "tsconfig.node.json",
          "tsconfig.strict.json",
        ].sort(),
      );
      succeeds(run(consumer, "npm", ["run", "check"]));
    },
  ],
  [
    "inherited lint rules reject real violations",
    ({ source, lint }) => {
      writeFileSync(source, "export function tooMany(a, b, c, d, e, f, g) { return g; }\n");
      rejects(lint(), /max-params/);
      writeFileSync(source, "export function rest(a, b, c, d, e, f, ...g) { return g; }\n");
      rejects(lint(), /max-params/);
      writeFileSync(source, "export function rest(a, b, c, d, e, ...f) { return f; }\n");
      succeeds(lint());
      writeFileSync(source, "export const value: any = 1;\n");
      rejects(lint(), /no-explicit-any/);
      writeFileSync(source, "// @ts-ignore\nexport const value = 1;\n");
      rejects(lint(), /ban-ts-comment/);
    },
  ],
  [
    "inherited size limits reject large functions and files",
    ({ source, lint }) => {
      writeFileSync(source, `export function large() {\n${"  console.log(1);\n".repeat(101)}}\n`);
      rejects(lint(), /max-lines-per-function/);
      writeFileSync(source, "console.log(1);\n".repeat(1001));
      rejects(lint(), /max-lines/);
    },
  ],
  [
    "Node profile typechecks consumer files and indexed access",
    ({ source, compile }) => {
      writeFileSync(
        source,
        "const items: string[] = [];\nexport const first: string = items[0];\n",
      );
      rejects(compile(), /TS2322/);
      writeFileSync(source, clean);
      succeeds(compile());
    },
  ],
  [
    "strict policy composes with browser and bundler settings",
    ({ source, typeFile, originalTypes, compile }) => {
      json(typeFile, {
        extends: "@jlreyes/typescript-standards/tsconfig.strict.json",
        compilerOptions: {
          target: "ES2024",
          lib: ["ES2024", "DOM"],
          module: "ESNext",
          moduleResolution: "Bundler",
          types: [],
          noEmit: true,
        },
        include: ["src/**/*.ts"],
      });
      writeFileSync(source, 'export const heading = document.createElement("h1");\n');
      succeeds(compile());
      writeFileSync(typeFile, originalTypes);
    },
  ],
  [
    "formatter defaults have a strict TypeScript import contract",
    ({ consumer, source, compile }) => {
      writeFileSync(source, clean);
      const config = path.join(consumer, "src/formatter.ts");
      writeFileSync(
        config,
        'import defaults from "@jlreyes/typescript-standards/oxfmt";\n' +
          "export const width: number = defaults.printWidth;\n",
      );
      succeeds(compile());
      writeFileSync(
        config,
        'import defaults from "@jlreyes/typescript-standards/oxfmt";\n' +
          "export const width: string = defaults.printWidth;\n",
      );
      rejects(compile(), /TS2322/);
      rmSync(config);
    },
  ],
  [
    "local lint exception applies only to its selected files",
    ({ consumer, source, lintFile, originalLint, lint }) => {
      json(lintFile, {
        ...JSON.parse(originalLint),
        overrides: [
          {
            files: ["src/generated.ts"],
            rules: { "max-params": ["error", 7] },
          },
        ],
      });
      const seven = "export function seven(a, b, c, d, e, f, g) { return g; }\n";
      const generated = path.join(consumer, "src/generated.ts");
      writeFileSync(source, clean);
      writeFileSync(generated, seven);
      succeeds(lint());
      writeFileSync(source, seven);
      rejects(lint(), /max-params/);
      rmSync(generated);
      writeFileSync(lintFile, originalLint);
    },
  ],
  [
    "formatter uses shared defaults and explicit local overrides",
    ({ consumer, source }) => {
      const format = (...args) =>
        tool(consumer, "oxfmt", "--config", "oxfmt.config.mjs", ...args, "src/index.ts");
      writeFileSync(source, "export const greeting='Hello'\n");
      rejects(format("--check"), /index\.ts/);
      succeeds(format("--write"));
      assert.equal(readFileSync(source, "utf8"), clean);
      writeFileSync(
        path.join(consumer, "oxfmt.config.mjs"),
        'import defaults from "@jlreyes/typescript-standards/oxfmt";\n' +
          "export default { ...defaults, singleQuote: true };\n",
      );
      succeeds(format("--write"));
      assert.equal(readFileSync(source, "utf8"), "export const greeting = 'Hello';\n");
      succeeds(format("--check"));
    },
  ],
  [
    "installing a new shared version changes policy without a local edit",
    ({ consumer, source, lintFile, originalLint, lint, temporary }) => {
      const changed = path.join(temporary, "changed-package");
      cpSync(packageSource, changed, { recursive: true });
      const manifest = JSON.parse(readFileSync(path.join(changed, "package.json"), "utf8"));
      manifest.version = "0.2.1";
      json(path.join(changed, "package.json"), manifest);
      const rules = JSON.parse(readFileSync(path.join(changed, "oxlint.json"), "utf8"));
      rules.rules["max-params"] = ["error", 7];
      json(path.join(changed, "oxlint.json"), rules);
      writeFileSync(source, "export function seven(a, b, c, d, e, f, g) { return g; }\n");
      rejects(lint(), /max-params/);
      install(consumer, pack(changed, temporary).tarball);
      succeeds(lint());
      assert.equal(readFileSync(lintFile, "utf8"), originalLint);
    },
  ],
];

test("packed presets work in a standalone consumer", async (t) => {
  const temporary = mkdtempSync(path.join(tmpdir(), "typescript-standards-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const consumer = path.join(temporary, "consumer");
  cpSync(path.join(root, "examples/node"), consumer, { recursive: true });
  const { tarball, files } = pack(packageSource, temporary);
  install(consumer, tarball);
  const source = path.join(consumer, "src/index.ts");
  const lintFile = path.join(consumer, ".oxlintrc.json");
  const originalLint = readFileSync(lintFile, "utf8");
  const typeFile = path.join(consumer, "tsconfig.json");
  const originalTypes = readFileSync(typeFile, "utf8");
  const lint = () => tool(consumer, "oxlint", "--deny-warnings", "src");
  const compile = () => tool(consumer, "tsc", "-p", "tsconfig.json");

  const context = {
    files,
    temporary,
    consumer,
    source,
    lintFile,
    originalLint,
    typeFile,
    originalTypes,
    lint,
    compile,
  };
  for (const [name, exercise] of cases) {
    await t.test(name, () => exercise(context));
  }
});

test("root-owned lint config works from a hoisted npm workspace", (t) => {
  const temporary = mkdtempSync(path.join(tmpdir(), "typescript-standards-workspace-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const workspace = path.join(temporary, "app");
  cpSync(path.join(root, "examples/node"), workspace, { recursive: true });
  const manifestFile = path.join(workspace, "package.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  manifest.scripts.lint = "oxlint --deny-warnings --config ../.oxlintrc.json src";
  json(manifestFile, manifest);
  json(path.join(temporary, "package.json"), {
    name: "workspace-consumer",
    private: true,
    workspaces: ["app"],
  });
  cpSync(path.join(workspace, ".oxlintrc.json"), path.join(temporary, ".oxlintrc.json"));
  rmSync(path.join(workspace, ".oxlintrc.json"));
  install(temporary, pack(packageSource, temporary).tarball);
  succeeds(run(temporary, "npm", ["run", "check", "--workspace", "standards-node-example"]));
  writeFileSync(path.join(workspace, "src/index.ts"), "export const value: any = 1;\n");
  rejects(
    run(temporary, "npm", ["run", "lint", "--workspace", "standards-node-example"]),
    /no-explicit-any/,
  );
});
