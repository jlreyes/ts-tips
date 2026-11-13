# Type integrity

**Goal:** A codebase you can reason about by following the types — one source of
truth per concept, trust enforced at the edge.

## Smells

- "Type soup": `any` / loose `unknown` / `as` sprinkled to make the compiler stop
  complaining.
- A one-off interface that near-duplicates an existing domain type to fit one call
  site.
- Reading fields straight off a `Record<string, unknown>` (or `any`) that came
  from HTTP, a file, a process, browser APIs, or another external boundary.
- A raw `string` flowing where a specific ID is meant.

## Rules

- **One canonical type per concept**, defined once and imported everywhere; use it
  in full. Need a subset? Derive it (`Pick`/`Omit`) so it stays in sync — don't
  fork a near-duplicate.
- A function that "needs a different shape" usually means the canonical type is
  wrong or the boundary is misplaced — fix that, don't fork the type.
- **No `any`** in first-party code. **`unknown` only at trust boundaries**,
  narrowed/parsed on the next line — never threaded through.
- **No `as` to force compilation** (`as unknown as` is blocked on commit). `as
  const` and narrowing a validated `unknown` after a guard are fine.
- **Parse, don't validate**: external input is parsed into a domain type at the
  edge; downstream code trusts the type and never re-checks.
- **Brand IDs** so kinds can't be mixed; mint a brand only at the boundary that
  creates or validates it.

## Examples

```ts
// edge: untrusted -> domain type (throws / returns Result on bad input)
const msg: InboundMessage = parseInboundMessage(rawWebhookBody);
// everywhere else: msg is fully typed — no re-checking, no `any`

type UserId = string & { readonly __brand: "UserId" };
type MessageId = string & { readonly __brand: "MessageId" };
// a fn taking UserId won't accept a MessageId or a raw string
```
