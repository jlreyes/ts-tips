---
name: ts-whats-new
description: >
  Index of TypeScript and Node.js features that postdate most coding-model
  training data — TS 4.9 through 6.0.3 (satisfies, using/await using,
  decorators, isolatedDeclarations, the tsgo/TypeScript 7 native compiler) and
  Node 20 through 26 (native TS execution, built-in .env/watch/test-runner,
  fetch/AbortSignal/structuredClone, the permission model). Load whenever
  writing, editing, or reviewing TypeScript or Node.js code — especially
  before reaching for ts-node, tsx, CommonJS require, dotenv, node-fetch,
  hand-rolled AbortSignal timeouts, enum, or try/finally cleanup. Also load
  when asked what's new in TypeScript/Node, whether a feature is stable yet,
  or whether tsgo/TypeScript 7 is ready to adopt.
---

# TypeScript & Node: What's New

TypeScript and Node ship fast — TypeScript roughly quarterly, Node every six
months — and a coding model's training data lags both. This skill is a
terse, source-verified recency index: what actually shipped, what version it
landed in, and whether it's stable or still preview. It is **not** a tutorial
and **not** a house style guide — if the project you're working in has its
own coding-standards skill (canonical types, architecture, lint/tsconfig
rules), that skill is authoritative for doctrine; this one only answers "does
X exist yet, and can I use it here."

Facts here were verified against official sources (devblogs.microsoft.com/typescript,
nodejs.org/api, github.com/microsoft/TypeScript, github.com/microsoft/typescript-go,
github.com/nodejs/node) as of **2026-06-30**, including empirical checks
against real installed `typescript@6.0.3` and several Node binaries — not
from memory. Items marked **NEEDS RE-VERIFICATION** had no definitive
official source at write time; confirm before relying on them. Treat
`references/tsgo-native-compiler.md` as the most likely to be stale by the
time you read it — that project ships weekly.

Read the relevant reference before suggesting (or rejecting) an idiom. The
closing table in each reference file has an "Is it usable here?" column —
check the calling project's actual `tsconfig.json`/`lib`/Node version before
assuming a feature applies; "landed in TS 5.x" does not always mean "usable
under your `lib`/`target`" (see the lib-bucket gotchas in
`typescript-language.md`).

## At a glance — stale pattern → current idiom

Every swap documented in `references/*.md` is listed here too, not just a
curated subset — the table in this file is the part most likely to actually
get read, since a reference file only gets opened if something already
prompted a model to go looking for it. If you only ever see this file, you
should still get most of the value; open the references for the full
explanation, code example, version sourcing, and gotchas behind any row.

### TypeScript

| Instead of... | Use... | Lands / why |
|---|---|---|
| `const x: T = {...}` (widens, loses literal type) | `{...} satisfies T` | TS 4.9 — keeps the literal type, still checks shape |
| Caller writes `as const` at every call site | `<const T>` type parameter | TS 5.0 — literal type inferred without the caller doing anything |
| `--experimentalDecorators` + `reflect-metadata` | Standard `@decorator` syntax — **but avoid entirely if your runtime executes `.ts` natively** | TS 5.0 syntax; Node's native type-stripper hard-rejects decorator syntax as a parser error |
| `try { ... } finally { cleanup() }` | `using x = ...` / `await using x = ...` | TS 5.2 syntax (needs `esnext.disposable` added to `lib`) + Node 24+ runtime |
| `assert { type: "json" }` | `with { type: "json" }` | TS 5.3; `assert` deprecation widened to dynamic `import()` in 6.0 |
| Splitting a function into overloads to stop a default-value arg from polluting inference | `NoInfer<T>` | TS 5.4 |
| Hand-rolled `(x): x is Foo => ...` predicate | Plain `x => x.kind === "foo"` | TS 5.5 infers simple boolean-narrowing predicates automatically |
| Whole-program declaration emit only | `--isolatedDeclarations` for per-file/parallel `.d.ts` emit | TS 5.5 (no longer "experimental"; official wording stops short of "stable") |
| `Array.from(iter).filter(...)` just to filter a generator | `.filter()`/`.take()`/`.drop()` directly on the iterator | TS 5.6 (needs `ES2025`/`ESNext` lib — not in `ES2024`) |
| Manual set algebra (`new Set([...a].filter(x => b.has(x)))`) | `setA.union(setB)` / `.intersection()` / etc. | TS 5.5 (needs `ES2025` lib) |
| `if (!map.has(k)) map.set(k, computeDefault())` | `map.getOrInsertComputed(k, fn)` | TS 6.0 (needs `esnext` lib) |
| Real `enum Foo { A, B }` | `const Foo = {A:"a",B:"b"} as const` + derived union type | Blocked by `--erasableSyntaxOnly` (TS 5.8) and by Node's type-stripper outright |
| Passing a `Buffer` where `ArrayBuffer` is expected implicitly | Access `.buffer` explicitly | TS 5.9 — real breaking change, not just a new capability |
| Avoiding `.ts` extensions in source, or hand-writing `.js` | Write `.ts` extensions; `--rewriteRelativeImportExtensions` rewrites them at emit | TS 5.7 (only relevant if you add a `tsc`-emit build step) |
| Shipping dual CJS+ESM builds purely for require/import interop | `--module preserve` (5.4) and `require(esm)` support under `nodenext` (5.8) | TS 5.4 / 5.8 |
| Eager `await import()` purely to delay a dependency's cost | `import defer * as ns from "..."` | TS 5.9 — namespace-only, needs runtime support, early-adopter territory |
| `tsc` alone for typecheck | Consider `tsgo` / `typescript@rc` | ~10x faster; RC as of 2026-06-18 — verify GA hasn't already shipped before adopting in CI |

### Node.js

| Instead of... | Use... | Lands / why |
|---|---|---|
| `ts-node` / `tsx` to run TypeScript | `node file.ts` directly | Native type stripping, Stable since Node 24.12/25.2 |
| Hoping `--experimental-transform-types` covers enums/decorators/namespaces | There is no native path anymore — use a real build step | Flag removed entirely in Node 26.0.0 |
| Bare specifier for a newer builtin (`require('test')`) | `node:test`, `node:sqlite`, etc. | `node:`-prefix is mandatory for anything added since ~Node 18, no bare alias exists |
| `dotenv` package | `node --env-file=.env` / `--env-file-if-exists` | Built-in, Stable since Node 24.10/22.21 |
| `nodemon` | `node --watch` | Built-in, Stable since Node 22.0/20.13 |
| `node-fetch` / axios for simple calls | global `fetch` | Stable since Node 21.0 |
| `lodash.cloneDeep` / `JSON.parse(JSON.stringify(x))` | `structuredClone(x)` | Stable since Node 17.0 |
| Manual `setTimeout(() => ctrl.abort())` wiring | `AbortSignal.timeout(ms)` / `AbortSignal.any([…])` | Built-in since Node 17.3 / 20.3 |
| `try { ... } finally { cleanup() }` (runtime side) | `using`/`DisposableStack`/`Symbol.dispose` | Node 24.0+ (V8 13.6) — pairs with the TS-side syntax above |
| Dynamic-`import()`-only workarounds for sync ESM-from-CJS | `require()` of a synchronous ESM module | Stable since Node 25.4 |
| `glob` / `fast-glob` for simple patterns | `fs.promises.glob()` | Built-in, Stable since Node 24.0/22.17 |
| `minimist` / `yargs` / `commander` for simple flag parsing | `util.parseArgs()` | Stable since Node 20.0 |
| `chalk` / `kleur` / `picocolors` for simple terminal styling | `util.styleText()` | Stable since Node 23.5/22.13 |
| `npm run <script>` / `pnpm run <script>` for fast single-script iteration | `node --run <script>` | Stable since Node 24.10/22.21 (not a replacement for workspace-aware orchestration) |
| `ws` package for outbound-client-only use | global `WebSocket` | Stable since Node 22.4 (still need `ws` for a server) |
| `better-sqlite3` when you don't want a native-addon build step | `node:sqlite` — **Release Candidate, not Stable yet** | RC since Node 25.7 |

### Also worth knowing (status facts, not swaps)

- **`erasableSyntaxOnly` (TS 5.8)** is what makes the `enum`/decorator/parameter-property rows above compile errors instead of silent runtime breakage — pair it with `verbatimModuleSyntax` on any project executing `.ts` natively.
- **The `lib`-bucket gotcha is general**, not just for the rows above: several "landed" TS 5.5/5.6/6.0 features (iterator helpers, Set methods, `using`/`Disposable`, Map/WeakMap upsert) live in `ES2025`/`ESNext`-bucket lib files, not `ES2024` — a project targeting `lib: ["ES2024"]` doesn't get them for free. Always check.
- **TypeScript 6.0** is a version-realignment/bridge release (default-flips + deprecation wave), not a language-feature release — don't expect new syntax from it specifically.
- **The permission model (`--permission`)** graduated to Stable at Node 23.5/22.13 — it was Experimental through Node 22 in most training data.
- **`node:test`** is Stable (since Node 20.0) but situational — don't suggest migrating off an existing test runner (vitest/Jest) just because it exists.
- **`Temporal`** is conditionally absent on Node 26 depending on whether the binary was built with a Rust toolchain available — runtime-check `typeof Temporal !== "undefined"` rather than assuming target/version implies it.
- **Single Executable Applications (`node:sea`)** is still not stable (Active Development) even in Node 26 — don't assume a newer Node version implies it graduated.

## References

- `references/typescript-language.md` — TS 4.9 → 6.0.3 language and type-system
  features: `satisfies`, decorators (and why they're likely unusable wherever
  Node executes `.ts` natively), `using`/`await using`, `const` type
  parameters, `NoInfer`, inferred type predicates, `isolatedDeclarations`,
  `erasableSyntaxOnly`, iterator helpers, Set/Map builtins, the
  `Buffer`/`ArrayBuffer` breaking change, and what TypeScript 6.0 actually is.
- `references/tsgo-native-compiler.md` — current status of the Go-native
  TypeScript compiler (tsgo / TypeScript 7): install paths, parity with
  classic `tsc`, performance, known monorepo gotchas, and the TS6→TS7
  relationship. The single fastest-moving topic in this skill.
- `references/node-runtime.md` — Node 20 → 26 runtime/platform features:
  native TS execution and its v26 removal of the transform-types escape
  hatch, the `node:` protocol, built-in `.env`/watch/glob, `fetch`/
  `AbortSignal`/`structuredClone`, the permission model, `require(esm)`, and
  explicit don't-overclaim notes on `node:sqlite` and `Temporal`.
