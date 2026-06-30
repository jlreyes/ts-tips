---
name: oxc-whats-new
description: >
  Recency index for the oxc toolchain (oxlint, oxfmt) — the Rust-based
  successor to ESLint + Prettier. Covers oxlint's 838 built-in rules and its
  new type-aware linting (tsgolint, ~97% typescript-eslint parity), oxfmt's
  beta status and weekly breaking changes, the June 2026 Cloudflare
  acquisition of VoidZero (oxc's backer), and official ESLint/Prettier
  migration tooling. Load whenever writing or reviewing oxlint/oxfmt config,
  migrating a project from ESLint/Prettier, or asked whether oxc is mature
  enough to adopt for production.
---

# oxc: What's New

oxlint and oxfmt (the `oxc` project) ship **jointly, weekly, almost always
on Mondays** — this ecosystem moves faster than TypeScript or Node, and a
coding model's sense of "is this still beta / does this rule exist yet" goes
stale within weeks, not years. This skill is a terse, source-verified
status index — not a tutorial, not a rules reference (use `oxlint --help` /
the live docs at oxc.rs for that).

Facts verified 2026-06-30 against npm registry data, `oxc-project/oxc`'s
GitHub releases, and oxc.rs's live docs/blog — not from memory. Given the
weekly cadence, **treat every version number here as already one release
stale by the time you read it**; the governance and maturity-status claims
(oxlint stable, oxfmt beta, the Cloudflare acquisition) age much slower than
the version numbers do.

## Top-line status (read this first)

**oxlint is production-mature** — hit its 1.0 stability bar in June 2025,
runs at Shopify/Airbnb/Mercedes-Benz/Bun/Preact scale, 838 built-in rules
across native Rust ports of ESLint core + typescript-eslint + react +
import + jsx-a11y + jest/vitest + unicorn + node + jsdoc + next + vue, and
now covers ~97% of typescript-eslint's *type-aware* rules (its historically
biggest gap) via a separate engine called `tsgolint`. **oxfmt is explicitly
still "beta,"** not stable — still 0.x versioned, still shipping breaking
changes in weekly releases, though it claims a 100% pass rate on Prettier's
own JS/TS conformance suite. Bottom line: oxlint is a safe, confident
ESLint+typescript-eslint replacement today; oxfmt is a good, fast Prettier
replacement, adopted with the explicit understanding that it may reformat
code between minor versions — pin discipline and a `format:check` CI gate
matter more here than they would for Prettier.

## At a glance

| Instead of... | Use... | Why |
|---|---|---|
| `eslint` + `typescript-eslint` + `eslint-plugin-{react,import,jsx-a11y,unicorn,n,...}` | `oxlint` | Native Rust ports of all of the above, 838 rules, 1.0-stable since June 2025 |
| `typescript-eslint`'s type-checked rule configs (`parserOptions.project`) | `oxlint --type-aware` | ~97% rule parity via the `tsgolint` engine — but root-config-only, and budget time to verify the missing ~3% |
| `prettier` | `oxfmt` | Faster, 100% Prettier-conformance-suite pass rate — but still beta, expect occasional reformat-the-repo bumps |
| `prettier-plugin-tailwindcss`, prettier import-sort plugins | oxfmt's built-in `sortTailwindcss`/`sortImports` options | Natively absorbed, no separate plugin dependency |
| Hand-migrating `.eslintrc`/`.prettierrc` | `npx @oxlint/migrate` / `oxfmt --migrate prettier` | Official, automated config converters |

## References

- `references/oxc-toolchain.md` — full entries: oxlint scale/stability,
  type-aware linting (tsgolint), oxfmt's beta status and absorbed Prettier
  plugins, JS Plugins (alpha custom-rule API), migration tooling,
  nested-config behavior, native import analysis, and the Cloudflare/VoidZero
  governance change.
