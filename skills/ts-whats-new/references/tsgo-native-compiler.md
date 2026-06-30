# tsgo / TypeScript 7 — the native Go compiler

**This is the fastest-moving page in this skill — it shipped weekly as of
research time. Re-verify against https://devblogs.microsoft.com/typescript/
and `npm view typescript dist-tags` before trusting anything below if you're
reading this more than a few weeks after 2026-06-30.**

## Status as of 2026-06-30 (read this first)

**tsgo/TypeScript 7 is at Release Candidate**, not an early preview —
`typescript@7.0.1-rc`, RC announced 2026-06-18. The TypeScript team's own
words: it is "ready to be put to the test in your daily workflows and CI
pipelines *today*," and is "already in use in multiple multi-million
line-of-code codebases both inside and outside Microsoft." **GA was expected
within about a month of 2026-06-18** — plausibly already shipped by the time
you're reading this. Check before assuming "RC" still applies:

```bash
npm view typescript dist-tags
```

If `dist-tags.latest` is `7.x` (not `6.x`), TypeScript 7 has gone GA and most
of the "two install paths" guidance below collapses into "just use
`typescript`, the normal way."

Sources: [Announcing TypeScript 7.0 RC](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/) (2026-06-18), [Announcing TypeScript 7.0 Beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/) (2026-04-21).

## What it is

TypeScript 7 (codenamed "tsgo" / Project Corsa) is a from-scratch Go port of
the TypeScript compiler, announced March 2025. It is the **direct successor**
to the classic compiler, not a fork or rewrite-with-different-semantics —
same algorithms, ported file-by-file. **TypeScript 6.0 (GA 2026-03-23) is the
official, team-confirmed last release on the classic JS-based codebase** —
its own announcement says so explicitly: *"TypeScript 6.0 is a unique release
in that we intend for it to be the last release based on the current
JavaScript codebase."* This has been reaffirmed at every step since the
original announcement (Mar 2025 reveal → May 2025 previews → Dec 2025
progress update → Mar 2026 TS 6.0 GA → Apr 2026 Beta → Jun 2026 RC).

## Two install paths today

```bash
# Option A — dedicated nightly/preview channel, decoupled from your
# `typescript` version pin. Lowest-risk way to try it on one package.
pnpm add -Dw @typescript/native-preview
pnpm exec tsgo --noEmit -p path/to/tsconfig.json

# Option B — the RC, through the real `typescript` package — closer to what
# GA will actually look like, and the path the team now points people to.
pnpm add -Dw typescript@rc
pnpm exec tsc --noEmit -p path/to/tsconfig.json
```

Wiring a package's `typecheck` script:

```json
// package.json
"scripts": { "typecheck": "tsgo --noEmit" }
```

Note this is **transitional**: once 7.0 GA ships, the long-term move is to
bump the existing `typescript` devDependency itself (it becomes `tsc` =
Go-native by default), not keep `@typescript/native-preview` around
permanently.

## Parity with classic `tsc`

| Area | Status |
|---|---|
| Type-checking | **Done.** "Structurally identical" — ~99.6%+ conformance-test agreement (all but 74 of ~20,000 cases) |
| `.d.ts` declaration emission | **Done** for the general case. Declaration emit *from* `.js` files (allowJs/checkJs) was still "coming soon" as of the April 2026 Beta post — NEEDS RE-VERIFICATION if your project uses `allowJs` |
| Project references / build mode / incremental builds | **Done.** RC adds a new `--builders` flag to parallelize builds across referenced projects |
| Watch mode | **Prototype only** — "no incremental rechecking, not optimized" per the project's own README as of today |
| Programmatic Compiler API (custom transformers, ts-plugins) | **Not ready.** No stable API until **TypeScript 7.1+** (several months past 7.0 GA). If your build uses `ts-patch`/`ttypescript`-style custom transformers or TS language-service plugins, they will not work under tsgo yet |
| Editor/LSP | **Solid.** "TypeScript (Native Preview)" VS Code extension, standard LSP underneath: auto-imports, hover, go-to-definition/type-definition/implementation, find-all-references, rename, signature help, inlay hints, call hierarchy, semantic highlighting. Editor project-load time improved ~8x in one cited case (9.6s → 1.2s on the VS Code codebase itself) |

## Performance

Original claim (Mar 2025): ~10x across VS Code, Playwright, TypeORM
(10.1–13.5x). Reaffirmed with real-world numbers in Dec 2025: Sentry 8.19x,
VS Code 10.2x, TypeORM 9.88x, Playwright 7.51x. The "~10x" figure has held up
across four independently dated official posts, not been walked back — real
spread is roughly **7.5x–13.5x** depending on project shape.

## Known gotchas for monorepos (pnpm + TS project references)

Both **NEEDS RE-VERIFICATION** — check current issue status before relying
on tsgo for a CI-blocking typecheck gate in a pnpm workspace:

- [microsoft/typescript-go#809](https://github.com/microsoft/typescript-go/issues/809) — `tsgo` not following the `references` array / failing module resolution in a pnpm-monorepo subpackage, where `tsc -b` works fine on the same repo. Open at research time.
- [microsoft/typescript-go#2175](https://github.com/microsoft/typescript-go/issues/2175) — auto-import in a workspace monorepo suggesting a deep relative path instead of the workspace package specifier. Closed, but no confirmed-fixed release note visible at research time.

No official source explicitly confirms `verbatimModuleSyntax` /
`erasableSyntaxOnly` / NodeNext ESM support by name — the "structurally
identical to 6.0" parity claim implies it, but this is inferred, not
directly stated. Cheap to self-check: run Option A above against any project
already using those flags.

## Sources

- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/ (2026-06-18)
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/ (2026-04-21)
- https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/
- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ (2026-03-23)
- https://devblogs.microsoft.com/typescript/typescript-native-port/ (original announcement, 2025-03-11)
- https://github.com/microsoft/typescript-go (README, CHANGES.md)
- npm registry dist-tags for `typescript` and `@typescript/native-preview`, queried live 2026-06-30
