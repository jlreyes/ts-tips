# Backend organization

Make a capability easy to find and an operation easy to follow. Preserve the
repository's established architecture. For new capabilities, start with the
smallest arrangement that explains behavior, state ownership, and dependencies.
A feature request does not authorize reorganizing unrelated code.

## Group by capability; split by meaningful operation

Use product names such as `conversations`, `access`, and `resources`. Keep
related operations and their local helpers together. A small capability may
start as one file; a substantial operation can become `send-message.ts` or
`decide-request.ts`. Avoid a mandatory controller/service/repository chain or
`routes/contracts/queries` file set for every capability.

Keep an operation's input schema and inferred type near its implementation
unless an existing contract package owns them. Common transport envelopes can
remain shared. Model operation-specific required fields instead of one command
object with optional properties for every possible action. Follow
`type-integrity.md` for canonical types and parsing at trust boundaries.

A possible small backend layout is:

```text
index.ts                      composition and runtime entry point
conversations/
  send-message.ts             input contract and operation
  list-messages.ts
access/
  decide-request.ts
database/                     schema and migrations
integrations/                 concrete external adapters, when needed
```

Use the framework's existing route or actor layout. Create only the files the
capability needs. A central registry or dispatcher is reasonable when explicit
composition is helpful; do not replace a small switch with a plugin framework
merely to avoid editing it.

## Share behavior across entry points

Routes, actor actions, jobs, and agent tools can call the same named operation.
Keep business decisions in that operation when several callers need them,
rather than making callers invoke internal HTTP or duplicate the rules.
A simple read can query the database directly; an extraction should add reuse,
substantial behavior, or an identifiable boundary rather than a forwarding hop.

Pass authenticated caller context separately from caller-supplied input.
Transport authentication establishes identity; shared operations enforce the
applicable business permissions and resource scope. Reusing an owner operation
from an agent tool must not silently confer the owner's privileges.

Pass the relevant database/transaction and specific external capabilities.
Avoid making every operation depend on the entire framework context or import
application configuration. Interfaces are useful for genuine substitution or
package isolation; don't hand-maintain a second database API by default.
Classes remain useful for actual connection, session, or resource lifetimes;
stateless business operations can be functions. See `state-lifecycle.md`.

## Preserve the runtime's owner

A process-wide SQL pool, a request transaction, and an actor-local database
have different lifetimes. Shared operation code does not make their state
globally accessible. With actor-owned data, route writes through the owning
actor and execute against its transaction context; a background caller should
not independently mutate its storage just to reuse a function.

Keep connection lifecycle and sandbox/process execution separate from product
record operations when their dependencies and failure semantics differ.
Reuse a platform's existing jobs or durable execution primitives before adding
a custom worker or queue solely to match a conventional backend diagram.

## Give persistence and external effects explicit semantics

Keep one authoritative schema and an ordered migration history. The schema may
be split by domain if the tooling supports it. An API input schema describes a
request, not a database table; don't make it the persistence definition.
Queries can stay beside their operations until enough reuse or complexity
justifies a dedicated query module. A database package should not absorb every
business rule merely because those rules touch SQL.

Choose one transaction owner for an atomic operation. Shared mutation handling
can provide deduplication, version checks, and durable outcomes while individual
operations supply their rules. Publish confirmed state after commit. Avoid
wrapping every database call in a nested transaction independently.

A database commit does not make a shell command, payment, or message send
atomic. Consider whether retry can repeat an external effect. Use provider or
platform mechanisms when that guarantee matters; don't generalize database
mutation deduplication into an execution guarantee. Add an outbox or workflow
only when the actual delivery requirement warrants it.

## Packages follow dependencies

Start with folders inside the existing application. Extract a package when
multiple runtimes need it, platform dependencies must be excluded, or an
independent build/public contract has value. Keep its dependency direction
explicit: shared operations should not import an entry point that imports
them. This is not a requirement to make all domain code persistence-agnostic.

## Evidence and limits

Representative source files rechecked on 2026-11-06. Links pin the inspected
commits. These are observations from those files, not endorsements of every
pattern in each repository. The rules above combine these observations with
implementation-review lessons; actor ownership and mutation semantics are
recommendations, not claims about these projects' runtimes.

| Source inspected | Observation | Lesson and limit |
| --- | --- | --- |
| Midday [tRPC transactions](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/api/src/trpc/routers/transactions.ts), [REST transactions](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/api/src/rest/routers/transactions.ts), and [enrichment task](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/packages/jobs/src/tasks/transactions/enrich-transaction.ts) | REST and tRPC call the same transaction query function with database/team context; the job imports the same database-query package. | Share implementation across entry points. Those files do not establish that all business authorization lives in shared queries. |
| Dub [create-link operation](https://github.com/dubinc/dub.link/blob/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e/apps/web/lib/api/links/create-link.ts) | A named function coordinates database creation and related integrations. | Functions can express substantial operations without a service-class chain. Its global infrastructure imports are not the dependency-injection model to copy everywhere. |
| Documenso [create-envelope procedure](https://github.com/documenso/documenso/blob/fdd0337bdd8f6afac64faf97113c65ed2dd0e2a2/packages/trpc/server/envelope-router/create-envelope.ts) and [domain operation](https://github.com/documenso/documenso/blob/fdd0337bdd8f6afac64faf97113c65ed2dd0e2a2/packages/lib/server-only/envelope/create-envelope.ts) | A procedure declares request/response contracts and calls an operation in a separate server-only package; substantial orchestration also remains near the procedure. | Named operations and nearby contracts aid discovery. File separation alone does not make an adapter thin. |
| Formbricks [workflow route](https://github.com/formbricks/formbricks/blob/5381fc5a364b3535b8d541976d6287731ca6cee4/apps/web/app/api/v3/workflows/route.ts) and [runtime ports](https://github.com/formbricks/formbricks/blob/5381fc5a364b3535b8d541976d6287731ca6cee4/packages/workflows/src/services/ports.ts) | The route delegates to workflow handlers; manually authored persistence ports keep package dependencies from forming a cycle. | Explicit interfaces can protect a real package boundary. That maintenance cost is not justified for every query. |

Trace a representative operation before accepting a layout: where its contract
lives, who authorizes it, who owns the transaction, and how another caller
reuses it. If several files merely forward unchanged arguments, consider
combining them. Introduce the next layer when it solves a concrete problem.
