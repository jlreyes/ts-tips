# ts-tips

A personal [Claude Code plugin](https://code.claude.com/docs/en/plugins) for
TypeScript and Node.js development — sibling to
[`swift-tips`](https://github.com/jlreyes/swift-tips), same idea applied to
the TS/Node ecosystem.

Unlike `swift-tips`, nothing here is vendored copyrighted content — it's
original synthesis from public official sources, so this repo can be (and
is) public.

## Skills

- **`ts-whats-new`** — recency index for TypeScript and Node.js: what
  shipped that postdates most coding-model training data, with version
  numbers and stable-vs-preview status verified against official sources
  rather than memory. Three references:
  - `typescript-language.md` — TS 4.9 → 6.0.3 language/type-system features
    (`satisfies`, `using`/`await using`, decorators, `isolatedDeclarations`,
    `erasableSyntaxOnly`, and the `lib`-bucket gotchas that silently make
    several "landed" features unusable under common `lib` settings).
  - `tsgo-native-compiler.md` — status of the Go-native TypeScript compiler
    (tsgo / TypeScript 7): install paths, parity, performance, monorepo
    gotchas. The fastest-moving page in the plugin — re-verify often.
  - `node-runtime.md` — Node 20 → 26 runtime/platform features, including
    the Node 26 removal of `--experimental-transform-types` and a real,
    empirically-confirmed gotcha where `Temporal` is silently absent on some
    Node 26 builds depending on the Rust toolchain available at build time.

- **`oxc-whats-new`** — recency index for oxlint/oxfmt (the Rust-based
  ESLint+Prettier successor), which ships jointly, weekly. Headline facts:
  oxlint is 1.0-stable with 838 rules and ~97% type-aware-linting parity with
  `typescript-eslint` via a new `tsgolint` engine; oxfmt is still beta and
  ships breaking changes between releases; Cloudflare acquired oxc's backer
  VoidZero on 2026-06-04 (MIT license and vendor-neutrality pledged, but
  worth knowing).

More skills may land here over time, following the same template.

## How this was built

Every claim was checked against official sources (TypeScript release notes,
Node.js docs/changelogs, the relevant GitHub repos) via real web research,
not recalled from training data. Where a claim was checkable, it was also
verified empirically — by reading the actual installed `typescript` package's
`.d.ts` lib files, and by running real code against real Node binaries —
rather than trusted from prose alone. Content is dated; anything that
couldn't be pinned to a definitive official source is marked **NEEDS
RE-VERIFICATION** inline rather than stated as fact.

This index will go stale — that's the nature of the subject matter. Treat
the "Sources" section at the bottom of each reference file as the
re-verification starting point, and treat `tsgo-native-compiler.md`
specifically as likely outdated within weeks, not months.

### Staying current

A scheduled GitHub Action (`.github/workflows/check-upstream.yml`, weekly)
diffs `typescript`/`@typescript/native-preview`/`oxlint`/`oxfmt` npm
dist-tags and the latest Node release against
`.github/tracked-versions.json`, and opens or updates a tracking issue when
something changed. It's deliberately dumb — no LLM calls, no secrets, no
auto-commits — it only tells you *that* something shipped, not *what* to do
about it. Resolving the issue (re-research the changed item, update the
reference file, bump `tracked-versions.json`) is still a manual or
agent-assisted step. An LLM-driven version that drafts the update itself as
a PR is a natural next step, but needs an API key and a deliberate decision
to let an unattended agent edit this repo's content — not wired up yet.

## Install

- **Dev:** `claude --plugin-dir ~/repos/ts-tips` (hot-reload edits with `/reload-plugins`).
- **Permanent (every TS/Node repo):** `/plugin marketplace add jlreyes/ts-tips` → `/plugin install ts-tips@jlreyes`, enabled at **user scope** so every repo you open inherits it.

If a project has its own house coding-standards skill (canonical types, DI,
lint/tsconfig conventions, etc.), that skill stays authoritative for
doctrine — `ts-whats-new` only answers "does this exist yet, and is it safe
to use here." It's deliberately silent on style/architecture opinions.

### Improving auto-trigger reliability

Skill frontmatter descriptions are a soft signal — a model can still answer
a "familiar-looking" question from memory without consulting the skill, even
with a strong trigger description. If you notice that happening, the
mitigation that's worked well for sibling plugins is a short push-layer line
in your own `~/.claude/CLAUDE.md`, e.g.:

> For any TypeScript or Node.js work, load `ts-tips:ts-whats-new` before
> assuming an idiom is current.
