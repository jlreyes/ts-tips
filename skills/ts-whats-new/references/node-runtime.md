# Node.js runtime & platform: 20 → 26

Verified 2026-06-30 against official Node.js docs (nodejs.org/api), raw
GitHub doc source (which carries unambiguous `added`/`changes` YAML version
history — more reliable than rendered-HTML summaries, which were caught
fabricating at least one wrong version number during research), and direct
execution against real local Node binaries spanning v16 → v26. Where a claim
was confirmed by actually running code, it's marked accordingly below.

## Native TypeScript execution (type stripping)

**Lands:** experimental v22.6.0 · default-on v23.6.0/v22.18.0 · **Stable at v25.2.0/v24.12.0**

Node parses `.ts` files directly, stripping type annotations at the syntax
level — zero transpilation step for erasable syntax.

**Replaces:** `ts-node`, `tsx`, `@swc-node/register`, or a `tsc --watch` +
`nodemon` build loop for local dev.

```bash
node app.ts                  # just works on a current Node, no flags
node --no-strip-types app.ts # opt out if you really need to
```

## `--experimental-transform-types` — removed entirely in Node 26

**Lands:** v22.7.0 (always experimental) · **removed in v26.0.0** (2026-05-05, semver-major)

The companion flag that let Node *transform* (not just strip) non-erasable
TS syntax — `enum`, `namespace` with runtime code, parameter properties,
import-equals — was deleted outright, not stabilized.

**Replaces:** confirms there is **no** native-Node alternative to a real
build step (`tsc`, `tsx`, `swc`, `esbuild`) for that syntax going forward.

```ts
// BAD on Node 26 — throws ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX
enum Status { Active = "active" }

// GOOD — erasable, runs natively, no build step needed
const Status = { Active: "active" } as const;
type Status = (typeof Status)[keyof typeof Status];
```

**Confirmed by direct execution:** on Node 26.3.0, `node --experimental-transform-types`
→ `node: bad option`; `node enum-test.ts` → `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX:
TypeScript enum is not supported in strip-only mode`. This directly validates
setting TypeScript's `erasableSyntaxOnly` flag (see `typescript-language.md`)
for any project running `.ts` natively.

## `node:` protocol — mandatory for anything added since ~Node 18

**Status:** no bare-name alias exists for newer built-ins

All built-in modules introduced from Node 18 onward register **only** under
the `node:`-prefixed specifier. For older built-ins (`fs`, `path`, etc.) the
bare name still works, but `node:` is recommended style there too.

```ts
import { test } from "node:test";       // works
import { test } from "test";             // MODULE_NOT_FOUND — no bare alias exists
```

**Confirmed by direct execution:** on Node 26.3.0, bare `require('test')`,
`require('sqlite')`, and `require('sea')` all throw `MODULE_NOT_FOUND`, while
bare `require('fs')` still works.

## Built-in `.env` support

**Lands (experimental → stable, all three at v24.10.0/v22.21.0):**

| API | Experimental since |
|---|---|
| `--env-file` | v20.6.0 |
| `--env-file-if-exists` | v22.9.0 |
| `process.loadEnvFile()` | v21.7.0/v20.12.0 |

**Status:** Stable (all three)

**Replaces:** the `dotenv` package.

```bash
node --env-file=.env --env-file-if-exists=.env.local server.ts
```

## `node --watch`

**Lands:** experimental v18.11.0/v16.19.0 · **Stable at v22.0.0/v20.13.0**

**Replaces:** `nodemon`, `node-dev`.

```bash
node --watch --watch-path=./src server.ts
```

**Note:** `--watch-path` is macOS/Windows-only — throws
`ERR_FEATURE_UNAVAILABLE_ON_PLATFORM` elsewhere.

## Built-in test runner (`node:test`)

**Lands:** v18.0.0/v16.17.0 · **Stable since v20.0.0**

A real, Stable, dependency-free test runner (`describe`/`it`/mocking/
snapshots/coverage) ships in Node itself.

**Note:** if your project already standardizes on vitest or Jest, this isn't
a reason to migrate — it's here so you know it exists and don't assume a
project needs an external test-runner dependency by default. Code coverage
specifically remains behind `--experimental-test-coverage`.

## Global `fetch`

**Lands:** experimental v17.5.0/v16.15.0 · default-on v18.0.0 · **Stable since v21.0.0**

Spec-compliant `fetch`/`Request`/`Response`/`Headers`, backed by `undici`.

**Replaces:** `node-fetch`, `axios` for simple cases, `got` for basic JSON/HTTP calls.

```ts
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
const json = await res.json();
```

## `structuredClone`

**Lands:** v17.0.0 · **Status:** Stable (no experimental phase)

**Replaces:** `lodash.cloneDeep`, `JSON.parse(JSON.stringify(x))` deep-clone
hacks (which lose `Map`/`Set`/`Date`/`undefined` fidelity).

```ts
const copy = structuredClone(original);
```

## `AbortSignal.timeout()` / `AbortSignal.any()`

**Lands:** `.timeout()` v17.3.0/v16.14.0 · `.any()` v20.3.0/v18.17.0 · **Status:** Stable, no experimental phase noted for either

**Replaces:** manual `setTimeout(() => controller.abort(), ms)` wiring with
manual cleanup, and hand-rolled "combine multiple abort signals" utilities.

```ts
const res = await fetch(url, {
  signal: AbortSignal.any([userSignal, AbortSignal.timeout(5000)]),
});
```

## `using`/`await using` runtime support (Explicit Resource Management)

**Lands:** **Node 24.0.0** (V8 13.6) · **Status:** Stable from 24+, absent before

`Symbol.dispose`/`Symbol.asyncDispose`/`DisposableStack`/`AsyncDisposableStack`
become globally available — the runtime half of the TS 5.2 syntax feature
(see `typescript-language.md`).

**Confirmed by direct execution:** absent on Node v23.10.0 (`using` syntax →
`SyntaxError`, `DisposableStack` → `undefined`); present and working on Node
v24.4.1 and v26.3.0 with no flag required.

## Permission model

**Lands:** v20.0.0, Experimental · **Stable at v23.5.0/v22.13.0**

Process-level sandboxing flags (`--permission`, `--allow-fs-read`,
`--allow-fs-write`, `--allow-child-process`, `--allow-worker`,
`--allow-addons`) restricting what the running process can touch.

**Replaces:** relying solely on container/OS-level sandboxing for
untrusted-code execution paths; coarse `vm`/`child_process` ad hoc guards.

```bash
node --permission --allow-fs-read=/app/data --allow-fs-write=/app/tmp worker.ts
```

```ts
process.permission.has("fs.write", "/app/tmp"); // true
```

**Note:** this was Experimental through Node 22 in most training data — it
is genuinely Stable now. Worth real consideration for any process executing
less-trusted code paths (e.g. agent-directed file or subprocess actions).

## `require(esm)`

**Lands:** experimental v22.0.0/v20.17.0 · default v23.0.0/v22.12.0/v20.19.0 · **Stable at v25.4.0**

CommonJS `require()` can load a fully-synchronous (no top-level `await`) ESM
module directly.

**Replaces:** dynamic-`import()` workarounds, dual CJS/ESM package builds,
bundler-only interop shims for synchronous ESM-only dependencies.

```js
// CJS file requiring a synchronous ESM module
const distance = require("./distance.mjs");
// throws ERR_REQUIRE_ASYNC_MODULE if the target has top-level await
```

## Built-in glob

**Lands:** experimental v22.0.0 · **Stable at v24.0.0/v22.17.0**

`fs.glob`, `fs.globSync`, `fs.promises.glob`.

**Replaces:** `glob`, `fast-glob`, `tiny-glob` for simple pattern matching
(still evaluate before ripping out a glob dependency wholesale — advanced
exclude logic may still favor the npm packages).

```ts
import { glob } from "node:fs/promises";
for await (const file of glob("src/**/*.test.ts")) console.log(file);
```

**Note:** recent additions worth knowing — `exclude` pattern support
(v23.7.0/v22.14.0), `URL` instances for `cwd` (v24.1.0/v22.17.0),
`followSymlinks` option (v26.1.0/v24.16.0).

## Also notable (condensed)

- **`util.parseArgs()`** — Stable since v20.0.0. Replaces `minimist`/`yargs`/`commander` for straightforward CLI flag parsing.
- **`util.styleText()`** — Stable since v23.5.0/v22.13.0. Built-in terminal styling respecting `NO_COLOR`/`FORCE_COLOR`/TTY detection; replaces `chalk`/`kleur`/`picocolors` for simple cases. Hex color support added v26.1.0/v24.16.0.
- **`node --run`** — Stable since v24.10.0/v22.21.0. Runs a `package.json` script directly via Node, skipping package-manager startup overhead for single-script iteration (not a replacement for workspace-aware orchestration like `pnpm -r run build`).
- **Built-in `WebSocket` client** — Stable since v22.4.0. Global, browser-compatible, outbound-client-only (still need the `ws` package for a WebSocket *server*).
- **`diagnostics_channel` / `TracingChannel`** — Stable. Near-zero-cost pub/sub instrumentation channels with automatic async-context propagation; useful for custom tracing without per-call overhead when nothing's subscribed.
- **`node:sqlite`** — **Release Candidate, not Stable** (v25.7.0). Built-in synchronous SQLite (`DatabaseSync`), no native-addon build step — but don't claim it's production-stable yet.
- **Single Executable Applications (`node:sea`)** — still **not stable** (Stability 1.1, Active Development) even in v26, despite being added back in v19.7.0/v18.16.0. Don't assume newer-Node implies this graduated.
- **`Temporal` — conditionally absent, verify at runtime.** Node 26's release notes describe Temporal as "enabled by default," but this depends on the Rust toolchain being present at the binary's *build* time — if not, it's silently disabled. Confirmed directly: `typeof globalThis.Temporal` was `undefined` on a real Homebrew-built Node v26.3.0 binary on this research machine, despite v8-options showing the harmony flag enabled. **Always runtime-check `typeof Temporal !== "undefined"` rather than assuming target/Node-version implies availability.**

## Summary

| Feature | Stable since | Replaces |
|---|---|---|
| Native TS execution | v25.2/v24.12 | ts-node, tsx |
| `--experimental-transform-types` | **removed in v26.0.0** | (no native replacement — use a build step) |
| `node:` protocol | mandatory for new builtins | — |
| `.env` support | v24.10/v22.21 | dotenv |
| `--watch` | v22.0/v20.13 | nodemon |
| `node:test` | v20.0 | (situational — don't migrate off an existing runner unprompted) |
| `fetch` | v21.0 | node-fetch |
| `structuredClone` | v17.0 | lodash.cloneDeep |
| `AbortSignal.timeout`/`.any` | v17.3 / v20.3 | manual setTimeout+abort wiring |
| `using` runtime support | Node 24.0.0 | try/finally |
| Permission model | v23.5/v22.13 | — |
| `require(esm)` | v25.4 | dynamic-import workarounds |
| Built-in glob | v24.0/v22.17 | glob, fast-glob |
| `node:sqlite` | **RC only** (v25.7) | better-sqlite3 (situational) |
| `Temporal` | conditional — verify at runtime | date-fns/luxon (eventually) |

## Sources

- https://nodejs.org/api/typescript.html
- https://nodejs.org/en/blog/release/v26.0.0
- https://nodejs.org/en/blog/release/v24.0.0
- https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require
- https://nodejs.org/api/permissions.html
- https://nodejs.org/api/globals.html
- https://nodejs.org/api/test.html
- https://nodejs.org/api/sqlite.html
- https://nodejs.org/api/single-executable-applications.html
- Raw doc source: raw.githubusercontent.com/nodejs/node/main/doc/api/*.md (YAML version-history blocks)
- github.com/nodejs/node PR #61803 (`--experimental-transform-types` removal), PR #61806 (Temporal default-on, Rust-toolchain conditionality), PR #51912 (glob trio)
- Empirical: direct execution against Node v16.20.1, v23.10.0, v24.4.1, v26.3.0 binaries, 2026-06-30
