# TypeScript standards

Fallback principles when the repository supplies no local standards. The non-negotiables
are condensed here; read the relevant reference before working in or reviewing
that area. Match the surrounding code.

This skill supplies judgment the compiler cannot supply. The checked compiler,
lint, and formatter configuration remains the executable source for rules it
can enforce.

## Non-negotiables

**Type integrity.** Use the canonical type in full. Do not invent one-off
shapes or partials, use `any`, thread loose `unknown`, or cast only to satisfy
the compiler. `unknown` appears only at trust boundaries and is parsed
immediately. Parse external inputs into domain types at the edge. Brand IDs
when distinct identifiers could otherwise be mixed. See
`type-integrity.md`.

**State lifecycle.** Prefer one source of truth and derived values over
manually synchronized state. Before creating state, name its owner:
process/module, request, user, session, conversation, or message. Module
singletons are limited to process-wide concerns such as immutable configuration,
static tables, process-wide pools, and bounded keyed caches. Construct and pass
other state at its boundary. See `state-lifecycle.md`.

**Async discipline.** Do not hide slow work behind synchronous APIs. I/O,
network work, process work, large file work, and CPU-heavy transforms must not
block a handler or the event loop. Start independent work early, await it when
needed, bound concurrency, propagate `AbortSignal`, and lazy-load optional or
heavy modules on the feature path that uses them. See
`async-discipline.md`.

**Structural release.** Acquired timers, sockets, stream readers, generators,
locks, file handles, and child processes are released by scope, not memory.
Use `Symbol.dispose`/`Symbol.asyncDispose`, `using`/`await using`, and
`DisposableStack`/`AsyncDisposableStack` (TypeScript 5.2 syntax; the supported
Node 24 and Node 26 runtime lanes provide native support). An API whose correct
use requires callers to remember cleanup across early returns and throws is
defective: wrap the resource at the boundary where it enters the codebase.

**Repository mechanics.** Match the project's module system, import spelling,
compiler target, and build tools. Use type-only imports and preserve strict
compiler settings. Do not relax a checked rule to make a change pass.

**Comments.** Preserve durable reasoning, not implementation or review
history. Explain a non-obvious invariant, constraint, failure mode, or external
contract. Do not repeat syntax that clear names and structure already express.

## References

- `backend-organization.md` — capability ownership, named operations, transport
  and runtime boundaries, schema placement, and source-backed examples. Read
  when organizing or extending a backend.
- `type-integrity.md` — canonical types, trust boundaries,
  parse-don't-validate, and branded IDs. Read when modeling types or handling
  external input.
- `state-lifecycle.md` — lifecycle ownership, derived state, safe
  module state, and stateless logic. Read when creating services, stores,
  caches, handlers, or stateful abstractions.
- `async-discipline.md` — async shape, cancellation, bounded
  concurrency, and lazy loading. Read when doing I/O, network, process, file,
  CPU-heavy, or optional-integration work.

The Node preset is adapted from personal-agent-tools commit 1cf01fe;
its TypeScript principles derive from the repository's pinned Aegis adaptation.
