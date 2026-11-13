---
name: ts-standards
description: >-
  James's shared TypeScript coding standards for type integrity, state ownership,
  async work and resource cleanup. Use when writing, editing or reviewing TypeScript.
  Follow the repository's own build settings and project rules.
---

# TypeScript standards

Apply these principles alongside the repository’s own rules. Follow its module
system, import conventions, build settings, and checks. Read the relevant
reference before working in or reviewing that area.

This skill supplies judgment the compiler cannot supply. The checked compiler,
lint, and formatter configuration remains the executable source for rules it
can enforce.

## Non-negotiables

**Type integrity.** Use the canonical type in full. Do not invent one-off
shapes or partials, use `any`, thread loose `unknown`, or cast only to satisfy
the compiler. `unknown` appears only at trust boundaries and is parsed
immediately. Parse external inputs into domain types at the edge. Brand IDs
when distinct identifiers could otherwise be mixed. See
[type-integrity.md](references/type-integrity.md).

**State lifecycle.** Prefer one source of truth and derived values over
manually synchronized state. Before creating state, name its owner:
process/module, request, user, session, conversation, or message. Module
singletons are limited to process-wide concerns such as immutable configuration,
static tables, process-wide pools, and bounded keyed caches. Construct and pass
other state at its boundary. See [state-lifecycle.md](references/state-lifecycle.md).

**Async discipline.** Do not hide slow work behind synchronous APIs. I/O,
network work, process work, large file work, and CPU-heavy transforms must not
block a handler or the event loop. Start independent work early, await it when
needed, bound concurrency, propagate `AbortSignal`, and lazy-load optional or
heavy modules on the feature path that uses them. See
[async-discipline.md](references/async-discipline.md).

**Structural release.** Acquired timers, sockets, stream readers, generators,
locks, file handles, and child processes need cleanup on every exit path. Tie
cleanup to scope. Where supported, implement `Symbol.dispose` or
`Symbol.asyncDispose` and acquire resources with `using` or `await using`.
Compose several resources with `DisposableStack` or `AsyncDisposableStack`.
Wrap APIs that require manual cleanup at the boundary so each caller gets
the same guarantee.

**Repository mechanics.** Match the project's module system, import spelling,
compiler target, and build tools. Use type-only imports and preserve strict
compiler settings. Do not relax a checked rule to make a change pass.

**Comments.** Preserve durable reasoning, not implementation or review
history. Explain a non-obvious invariant, constraint, failure mode, or external
contract. Do not repeat syntax that clear names and structure already express.

## References

- [type-integrity.md](references/type-integrity.md) — canonical types, trust boundaries,
  parse-don't-validate, and branded IDs. Read when modeling types or handling
  external input.
- [state-lifecycle.md](references/state-lifecycle.md) — lifecycle ownership, derived state, safe
  module state, and stateless logic. Read when creating services, stores,
  caches, handlers, or stateful abstractions.
- [async-discipline.md](references/async-discipline.md) — async shape, cancellation, bounded
  concurrency, and lazy loading. Read when doing I/O, network, process, file,
  CPU-heavy, or optional-integration work.
