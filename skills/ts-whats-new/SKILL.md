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

| Instead of... | Use... | Why |
|---|---|---|
| `ts-node` / `tsx` to run TypeScript | `node file.ts` directly | Native type stripping, Stable since Node 24.12/25.2 |
| `enum Foo { A, B }` | `const Foo = {A:"a",B:"b"} as const` | Real `enum` needs a transform step; Node's type-stripper rejects it outright (and many tsconfigs now set `erasableSyntaxOnly` to enforce this at compile time) |
| `@Decorator` on classes/methods | Avoid unless your runtime supports it | Decorators require runtime transformation, not pure type erasure — Node's native type-stripper hard-rejects decorator syntax as a parser error |
| `try { ... } finally { cleanup() }` | `using x = ...` / `await using x = ...` | Deterministic disposal — TS 5.2 syntax, Node 24+ runtime (V8 13.6) |
| `dotenv` package | `node --env-file=.env` | Built-in, Stable since Node 24.10/22.21 |
| `node-fetch` / axios for simple calls | global `fetch` | Stable since Node 21 |
| Manual `setTimeout(() => ctrl.abort())` | `AbortSignal.timeout(ms)` / `.any([…])` | Built-in since Node 17.3 / 20.3 |
| `const x: T = {...}` (widens, loses literal type) | `{...} satisfies T` | Keeps the literal type, still checks shape — TS 4.9 |
| Hand-rolled `(x): x is Foo => ...` | Plain `x => x.kind === "foo"` | TS 5.5 infers simple boolean-narrowing predicates automatically |
| `tsc` alone for typecheck | Consider `tsgo` / `typescript@rc` | ~10x faster; RC as of 2026-06-18 — verify GA hasn't already shipped before adopting in CI |
| `glob` / `fast-glob` for simple patterns | `fs.promises.glob()` | Built-in, Stable since Node 24.0/22.17 |
| `nodemon` | `node --watch` | Built-in, Stable since Node 22.0/20.13 |

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
