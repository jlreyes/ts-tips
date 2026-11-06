# Async discipline

**Goal:** Async work is explicit, cancellable, non-blocking, and shaped around the
actual dependency graph.

## Smells

- `readFileSync`, sync crypto/compression, huge `JSON.parse`, or CPU-heavy loops in
  a request, message, job, or UI-facing handler.
- Independent I/O awaited serially.
- `Promise.all(items.map(...))` over unbounded user or external data.
- A promise started and neither awaited nor handled.
- An optional/heavy dependency imported at module load even though only one feature
  path needs it.
- Public async functions that call external systems but cannot accept an
  `AbortSignal`.

## Rules

- **Do not block hot paths.** Use async Node APIs for I/O in handlers and jobs.
  Move CPU-heavy work to a worker, queue, stream pipeline, or measured background
  path. Synchronous reads are acceptable at process startup for small static config.
- **Parallelize only independent work.** Start independent promises before the
  first `await`; keep data-dependent work serial because the dependency is real.
- **Bound concurrency.** For arrays from users, remote APIs, or files, cap parallel
  work and apply backpressure.
- **Propagate cancellation.** Async APIs that touch I/O, network, processes, timers,
  streams, or long loops accept `AbortSignal` and pass it to callees.
- **Handle fire-and-forget work.** If work intentionally continues after the caller
  returns, mark it with `void` and attach error logging/handling, or put it on an
  explicit queue.
- **Lazy-load optional/heavy modules.** Keep rare integrations and large parsers
  behind dynamic imports on the feature path that needs them. Keep import paths
  static/analyzable when possible.
- **Use typed failures for expected async outcomes.** Not-found, rate limit,
  parse failure, cancellation, and timeout are handled return states; `throw` is
  for bugs/invariants or truly unexpected failures.

## Examples

```ts
// no: independent calls serialized for no reason
const user = await loadUser(userId, { signal });
const prefs = await loadPreferences(userId, { signal });
const inbox = await loadInbox(userId, { signal });

// yes: independent work starts together
const [user, prefs, inbox] = await Promise.all([
  loadUser(userId, { signal }),
  loadPreferences(userId, { signal }),
  loadInbox(userId, { signal }),
]);
```

```ts
// no: optional heavy module paid at process startup
import { parseLargeAttachment } from "./attachment-parser.ts";

export async function maybeParseAttachment(message: Message) {
  if (!message.attachment) return undefined;
  return parseLargeAttachment(message.attachment);
}

// yes: module loads only for the feature path that needs it
export async function maybeParseAttachment(message: Message) {
  if (!message.attachment) return undefined;
  const { parseLargeAttachment } = await import("./attachment-parser.ts");
  return parseLargeAttachment(message.attachment);
}
```

```ts
// no: unbounded work over external data
await Promise.all(messages.map((message) => enrichMessage(message, { signal })));

// yes: cap concurrency; use the repository's existing helper if one exists
await mapWithConcurrency(messages, 8, (message) => enrichMessage(message, { signal }));
```
