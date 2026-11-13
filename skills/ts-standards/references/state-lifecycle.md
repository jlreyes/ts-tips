# State lifecycle

**Goal:** Reactive, lifecycle-scoped state. Data has one owner, derived values are
computed from that source, and abstractions match the lifetime of the thing they
represent.

## Smells

- A module-global `currentUser`, `currentSession`, active conversation, or mutable
  request context.
- A class whose methods are just stateless functions with a `this` wrapper.
- Stored duplicate state such as counts, totals, status booleans, or filtered
  lists that are manually kept in sync.
- `refresh()`, `notify()`, `syncFromX()`, or observer plumbing used to compensate
  for duplicated state.
- A singleton chosen because it is convenient, without naming whether the state is
  process, request, user, session, conversation, or message scoped.

## Rules

- **Name the lifecycle before designing the abstraction.** Is this process/module,
  request, user, session, conversation, or message state? The owner determines
  where it is constructed and how it is passed.
- **Module scope is process-wide.** It is fine for immutable config, static lookup
  tables, process-wide connection pools, and bounded keyed caches. It is not fine
  for user/session/request/conversation/message state.
- **Inject or pass non-process state.** If the state changes per user/session/
  request/conversation/message, build it at that boundary and pass it through a
  context object or dependency interface.
- **Derive, don't duplicate.** Totals, filtered views, status booleans, and display
  summaries are functions/getters over canonical state unless profiling proves a
  cache is needed.
- **Stateless logic is a function.** Use classes or objects when there is real
  identity, lifecycle, protocol state, or resource ownership. Do not create
  service classes just to group free functions.
- **Make updates flow through the owner.** Prefer commands/events to the owning
  state object over scattered writes plus manual refresh/notify calls.
- **Prefer readonly boundaries.** Expose readonly data from owners; keep mutation
  local to the owner or to small local builders that do not escape.

## Examples

```ts
// no: request/user state leaked into process-wide module memory
let currentUser: User | undefined;

export async function handleMessage(raw: unknown) {
  currentUser = await authenticate(raw);
  return runAgent(raw);
}

export function canUsePrivateData() {
  return currentUser?.plan === "pro";
}

// yes: request state is owned by the handler and passed explicitly
export async function handleMessage(raw: unknown) {
  const user = await authenticate(raw);
  const ctx = { user, now: new Date() };
  return runAgent(ctx, raw);
}

export function canUsePrivateData(ctx: { readonly user: User }) {
  return ctx.user.plan === "pro";
}
```

```ts
// no: duplicate state requires manual sync after every write
type DraftStore = {
  readonly messages: Message[];
  unreadCount: number;
  refreshUnreadCount(): void;
};

// yes: one source of truth; the count is derived where needed
type DraftStore = {
  readonly messages: readonly Message[];
};

export function unreadCount(store: DraftStore) {
  return store.messages.filter((m) => !m.readAt).length;
}
```

```ts
// no: object wrapper around stateless logic
class MessageFormatter {
  format(message: Message) {
    return `${message.sender}: ${message.body}`;
  }
}

// yes: stateless logic is just a function
export function formatMessage(message: Message) {
  return `${message.sender}: ${message.body}`;
}
```
