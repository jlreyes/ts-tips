# oxc toolchain: oxlint & oxfmt

Verified 2026-06-30 via the npm registry, `oxc-project/oxc`'s GitHub
releases, and live oxc.rs docs/blog posts. oxlint and oxfmt release jointly,
weekly, almost always on Mondays — version numbers below are a snapshot, not
a stable fact; the maturity/status claims are the durable part.

## oxlint: scale and stability

**Status:** Stable (1.0 since June 2025)

838 built-in rules (113 enabled by default, 310 with autofixes) across
native Rust ports of ESLint core, `typescript-eslint`, `eslint-plugin-react`
(including hooks rules like `exhaustive-deps`), `eslint-plugin-import`,
`eslint-plugin-jsx-a11y`, `eslint-plugin-jest`/`vitest`, `eslint-plugin-unicorn`,
`eslint-plugin-n`, `eslint-plugin-jsdoc`, plus Next.js and Vue rule sets. Up
from "500+ rules" at the June 2025 1.0 launch — roughly 68% growth in about
a year, consistent with the weekly cadence. Runs in production at
Shopify/Airbnb/Mercedes-Benz/Bun/Preact scale.

**Replaces:** `eslint` + `typescript-eslint` + the usual stack of
`eslint-plugin-*` packages, installed and configured separately.

```bash
oxlint --disable-nested-config --no-error-on-unmatched-pattern
```

**Note:** there's no official single number for "% parity with
`eslint-plugin-react`" or similar per-plugin comparisons — only the overall
838-rule count is an official figure. Treat narrower parity claims as
**NEEDS RE-VERIFICATION** unless sourced directly.

## Type-aware linting (`tsgolint`)

**Lands:** technical preview ~Aug 2025 (40 rules) → alpha Dec 2025 (43/59
rules) → current: ~97% (59/61 typescript-eslint type-aware rules) · **Status:** Close to complete, not 100%

oxlint can now run `typescript-eslint`'s *type-checked* rules (e.g.
`no-floating-promises`, `no-unsafe-assignment`) via `tsgolint`, a separate
Go binary built on `typescript-go` that oxlint shells out to. This closes
oxlint's historically biggest gap versus `typescript-eslint`.

**Replaces:** `typescript-eslint`'s `parserOptions.project` + type-checked
rule configuration.

```jsonc
// .oxlintrc.json — typeAware/typeCheck must be set in the ROOT config only
{ "options": { "typeAware": true } }
```
```bash
oxlint --type-aware
```

**Note:** the `tsgolint`/`oxlint-tsgolint` engine is still versioned 0.x —
less mature than the core `oxlint` 1.x CLI — and has a known caveat about
high memory use on very large monorepos. The remaining ~3% of rules and
exact memory behavior on your repo size are worth a real trial before
treating this as a hard CI gate.

## oxfmt: beta, not stable — expect breaking changes between releases

**Lands:** beta announced 2026-02-24 · **Status:** Beta, 0.x versioned, no committed stable date

Claims a 100% pass rate on Prettier's own JS/TS conformance test suite (up
from ~95% at alpha, Dec 2025), and is compatible with Prettier v3.8 output
specifically — upgrade Prettier first before migrating, to minimize diff
noise.

**Replaces:** Prettier, as a full replacement (not a wrapper around it).

```bash
oxfmt --check   # CI gate, same shape as `prettier --check`
```

**Note:** despite "beta" framing, releases ship real breaking changes — e.g.
the release immediately after this research removed a Prettier-syntax
fallback and switched CSS/LESS/SCSS formatting to oxfmt's own native engine.
Pin the exact version and bump deliberately; don't use a `^` range the way
you might for a stable formatter, and expect an occasional
reformat-the-whole-repo commit when you do bump.

## oxfmt absorbs several Prettier plugins natively

**Status:** Stable feature set within oxfmt's beta

Built-in Tailwind CSS class sorting, import sorting, `package.json` key
sorting, JSDoc reformatting, and embedded-language formatting. Supported
file types span JS/JSX/TS/TSX/JSON/JSONC/JSON5/YAML/TOML/HTML/Angular/
Vue/Svelte/CSS/SCSS/Less/Markdown/MDX/GraphQL/Ember/Handlebars.

**Replaces:** `prettier-plugin-tailwindcss`, `prettier-plugin-sort-imports`-style
packages, `prettier-plugin-packagejson`.

```jsonc
// .oxfmtrc.json
{ "singleQuote": true, "sortImports": true, "sortTailwindcss": true }
```

**Note:** if a project still carries any of these as separate Prettier
plugin dependencies, this is a direct dependency-deletion opportunity — but
re-diff the output given oxfmt's beta status above.

## JS Plugins — custom rules and ESLint-plugin compatibility

**Lands:** 2026-03-11 · **Status:** Alpha, actively developed

An ESLint v9+-compatible plugin API: oxlint can run most existing ESLint
plugins largely unmodified, and supports authoring custom rules in JS/TS via
`definePlugin`/`defineRule`, with autofixes, suggestions, and live LSP
diagnostics. This closes oxlint's other classic gap (no custom-rule story)
from the 1.0 launch.

**Replaces:** in-house ESLint plugins, niche community ESLint plugins oxlint
hasn't natively ported.

**Note:** not yet supported — custom file-format parsers (Svelte/Vue/Angular
as JS-plugin lint targets) and type-aware rules inside JS plugins
(type-awareness is only available via the separate `tsgolint` path above).
Because it's alpha, don't make it load-bearing for a hard CI gate yet;
prefer natively-ported rules where they already exist.

## Official ESLint/Prettier migration tooling

**Status:** Stable, official

`npx @oxlint/migrate [eslint.config.js]` converts an ESLint **flat config**
(v9/v10) into `.oxlintrc.json`, preserving severities, options, per-path
overrides, `globals`/`env`, and ignore patterns. Legacy `.eslintrc.js`/`.json`
(ESLint v8 style) isn't supported directly — hop it through
`@eslint/migrate-config` first. `oxfmt --migrate prettier` converts
`.prettierrc.*` into `.oxfmtrc.jsonc`.

```bash
npx @oxlint/migrate eslint.config.js
oxfmt --migrate prettier
```

**Note:** local custom ESLint plugins must be re-added by hand after
migration either way; if ESLint stays around for non-style rules alongside
oxfmt, keep styling rules disabled (the `eslint-config-prettier` pattern) so
they don't fight oxfmt.

## Nested/monorepo config behavior

**Status:** Stable, but easy to get wrong in a monorepo

oxlint auto-discovers the *nearest* `.oxlintrc.json`/`oxlint.config.ts` per
file being linted (ESLint-legacy-style hierarchical resolution, not flat
config's single-file model). Configs are **not merged** — a child config
replaces the parent's unless it explicitly extends it.

**Replaces:** ESLint's hierarchical `.eslintrc` resolution / `overrides` field.

```bash
oxlint --disable-nested-config   # force single-root-config behavior
```

**Note:** `--disable-nested-config` (or passing `-c`/`--config` explicitly)
avoids an untracked nested config silently overriding root rules — the safer
default for most teams unless you deliberately want per-package rule
variance. Remember `typeAware`/`typeCheck` can *only* be set in the root
config; setting it in a nested config is a hard error.

## Native multi-file import analysis

**Lands:** alpha since 2024-05-04 · **Status:** Mature (oldest native plugin, continuously hardened — not new)

A from-scratch Rust port doing cross-file/multi-file analysis natively (e.g.
`import/no-cycle`), specifically built to avoid `eslint-plugin-import`'s
well-known performance cliff on multi-file rules.

**Replaces:** `eslint-plugin-import` and `eslint-import-resolver-typescript`
— TS path aliases resolve out of the box.

**Note:** unlike type-aware linting and JS Plugins, this has been stable for
about two years — safe to rely on without a trial period.

## Governance: Cloudflare acquired VoidZero (2026-06-04)

**Status:** Confirmed, very recent (26 days before this research) — re-verify if reading this much later

Cloudflare announced on 2026-06-04 that it acquired VoidZero Inc., Evan
You's company behind Vite, Vitest, Rolldown, Oxc (oxlint/oxfmt), and Vite+.
Both companies state these projects "will remain strictly open source under
MIT licenses," vendor-agnostic and community-driven; Evan You and the
VoidZero team continue leading them; Cloudflare committed $1M to a new,
independent Vite-ecosystem fund for maintainers unaffiliated with either
company.

**Note:** this is a backing-and-trust signal, not a feature. Accurate
framing: oxc is now backed by Cloudflare (previously independent VoidZero),
MIT-licensed, with an explicit neutrality pledge — **not** "no governance
risk at all." No foundation/trademark transfer (e.g. to OpenJS) was
announced; it's still single-vendor corporate backing, just a different
vendor than a few weeks ago. Worth citing whenever someone asks "who backs
this and is it going to be abandoned."

## Summary

| Item | Status | Lands/Changed |
|---|---|---|
| oxlint core | Stable (1.0) | June 2025, 838 rules as of 2026-06-30 |
| Type-aware linting (`tsgolint`) | ~97% parity, not 100% | Preview Aug 2025 → current Jun 2026 |
| oxfmt | **Beta**, not stable | Beta announced 2026-02-24 |
| oxfmt absorbed Prettier plugins | Stable (within oxfmt's beta) | Feb 2026 |
| JS Plugins (custom rules) | **Alpha** | 2026-03-11 |
| ESLint/Prettier migration tools | Stable, official | — |
| Nested config | Stable (opt out via `--disable-nested-config`) | — |
| Native import analysis | Mature (~2 years) | Alpha since 2024-05-04 |
| Governance | Cloudflare-backed, MIT, neutrality pledge | Acquisition 2026-06-04 |

## Sources

- https://registry.npmjs.org/oxlint, https://registry.npmjs.org/oxfmt, https://registry.npmjs.org/oxlint-tsgolint (npm registry, queried 2026-06-30)
- https://github.com/oxc-project/oxc/releases
- https://oxc.rs/docs/guide/usage/linter/rules
- https://oxc.rs/docs/guide/usage/linter/type-aware.html
- https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- https://oxc.rs/docs/guide/usage/linter/nested-config
- https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint
- https://oxc.rs/docs/guide/usage/formatter/migrate-from-prettier
- https://oxc.rs/docs/guide/usage/formatter/config-file-reference
- https://oxc.rs/blog/2026-02-24-oxfmt-beta
- https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha
- https://oxc.rs/blog/2024-05-04-import-plugin-alpha
- https://voidzero.dev/posts/announcing-oxlint-1-stable
- https://voidzero.dev/posts/announcing-oxlint-type-aware-linting
- https://voidzero.dev/posts/announcing-oxlint-type-aware-linting-alpha
- https://voidzero.dev/posts/voidzero-cloudflare (2026-06-04)
- https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-voidzero-to-build-the-future-of-the-ai-native-web/
- https://blog.cloudflare.com/voidzero-joins-cloudflare/
