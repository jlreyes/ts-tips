# Backend organization

How to decide where backend code goes and what to call it. Four principles
carry the reasoning. The examples after them show what each principle looks
like on disk in a production codebase, and the last section shows what each
approach cost those codebases. The examples disagree with each other, so read
them as evidence for the principles, not as layouts to copy. A repository
that already has a layout keeps it.

## Principles

**An operation earns its own file by having behavior or a second caller.**
A route that checks its input and runs one query has nothing to extract.
Moving that query into a service adds a file that forwards arguments and does
nothing else. When creating a record also means checking limits, writing a
cache, and recording an event, that sequence has behavior of its own, so it
deserves a name and a file.

**Behavior that several entry points need lives outside all of them.** An
HTTP route, a background job, and an agent tool are each a way in: a path
by which a request reaches the backend. A job cannot import a route handler.
Behavior written inside one entry point therefore gets copied into the others
or reached over HTTP. Put it where every entry point can import it.

**Names say what the code does in the product.** A folder called `links` that
holds `create-link.ts` and `delete-link.ts` tells a reader what the system can
do before they open a file. A folder called `services` that holds
`link.service.ts` tells them only which pattern was applied. For the same
reason, an operation's input and output shapes sit beside it under the same
name: the two change together.

**A hard boundary costs upkeep, so buy one only when something has to stand
alone.** A hard boundary here means a package that may not import the
application or the database package. Such a package has to describe by hand
everything it needs from them, and keep that description current. The price
is worth paying when a second runtime consumes the package or when a
dependency cycle would otherwise form. A folder inside the application is
just as easy to find and costs nothing to maintain.

## Examples

### create-t3-turbo and Epic Stack: nothing to extract

```text
create-t3-turbo
  packages/api/src/router/post.ts     all, byId, create, delete
  packages/db/src/schema.ts

epic-stack
  app/routes/users/index.tsx          loader and page in one file
```

[`post.ts`][t3-post] defines four procedures. Each is one Drizzle call on
`ctx.db`, with an input schema where the procedure takes input. There is no
service or repository file. Epic Stack's [users route][epic-users] runs a
typed Prisma query inside its loader. Both illustrate the first principle
(an operation earns a file only with behavior or a second caller) by what is
missing: these operations do nothing beyond the query and have one caller, so
they stay where they are used.

### Dub: a folder that lists what you can do

```text
apps/web/
  app/api/links/route.ts              parses the request, calls operations
  lib/api/links/
    create-link.ts
    update-link.ts
    delete-link.ts
    archive-link.ts
    bulk-create-links.ts
    process-link.ts
    get-link-or-throw.ts
    cache.ts
  lib/zod/schemas/links.ts            request and response shapes
  prisma/schema/link.prisma           one schema file per domain
```

The `POST` handler in [`route.ts`][dub-route] parses the body with a Zod
schema, calls `processLink`, then calls `createLink`.
[`createLink`][dub-create] is a plain exported function. It writes the row,
then sets the cache, records an analytics event, and publishes a usage event.
That sequence has behavior, so it has its own file, as the first principle
says it should. The listing also shows the third principle, that names say
what the code does in the product. The folder is named for the capability
(links) and each file for one thing you can do to a link, so a new operation
is a new file whose name you can guess. Dub keeps the request shapes in a
central `lib/zod/schemas/` folder under the capability's name, not beside each
operation.

### Midday: three ways in, one implementation

```text
apps/api/src/
  trpc/routers/transactions.ts
  rest/routers/transactions.ts
  schemas/transactions.ts
packages/db/src/
  queries/transactions.ts
  schema.ts
packages/jobs/src/tasks/transactions/
  enrich-transaction.ts
```

The [tRPC router][midday-trpc] and the [REST router][midday-rest] both import
`getTransactions` from `@midday/db/queries` and call it with the database
handle. The [enrichment job][midday-job] imports from the same package. This
is the second principle, shared behavior outside the entry points: the
behavior sits in a package that all three entry points can reach. Midday's top
level is split by technical layer, unlike Dub, but every layer uses the same
capability name, so searching for `transactions` finds each piece.

### Documenso: one file per operation, contract beside it

```text
packages/trpc/server/envelope-router/
  create-envelope.ts
  create-envelope.types.ts
  find-envelopes.ts
  find-envelopes.types.ts
  delete-envelope.ts
  delete-envelope.types.ts
packages/lib/server-only/envelope/
  create-envelope.ts
  find-envelopes.ts
  update-envelope.ts
```

Every procedure file has a `.types.ts` partner that holds its Zod request and
response schemas, as in [`create-envelope.types.ts`][doc-types]. The
[procedure][doc-proc] imports `createEnvelope` from
[`lib/server-only/envelope/create-envelope.ts`][doc-op], which has no tRPC
dependency and can be called from elsewhere. This is the third principle in
its strictest form: the file name is the operation, and the contract shares
the name. It also shows the second principle, since the operation lives in a
package outside the router.

### Formbricks: a package that stands alone

```text
apps/web/app/api/v3/workflows/
  route.ts                            26 lines
  lib/context.ts                      builds the handlers with real dependencies
packages/workflows/src/
  contracts/
  handlers/workflows.handlers.ts
  services/workflows.service.ts
  services/ports.ts
packages/database/schema/workflows.prisma
```

[`route.ts`][fb-route] authenticates and hands the request to handlers from
`@formbricks/workflows`. The package's only runtime dependency is `zod`.
`lib/context.ts` passes the application's Prisma client into the package when
it builds the service. The header comment in [`ports.ts`][fb-ports] states the
reason for the boundary: the database package imports the workflows package,
so an import in the other direction would create a build cycle. This is the
fourth principle, the hard boundary, with its justification written in the
code.

## Where each approach cost something

**Midday's shared query file took in everything.**
[`queries/transactions.ts`][midday-queries] is 2,207 lines and exports 18
functions. Some are queries. Others, such as `getSimilarTransactions`,
`searchTransactionMatch`, `moveTransactionToReview`, and
`markTransactionsAsExported`, are product behavior. A shared home named for a
technical role accepts whatever any caller needs. Midday kept behavior outside
the entry points, but gave it a name that says nothing about the product.

**Documenso's operation files can grow large.** The `create-envelope`
procedure is 251 lines and the operation it calls is 777 lines, built around a
Prisma client imported as a module global. One file per operation tells a
reader where the code is. It does not keep the operation small, and it left
two files with the same name in two packages.

**Dub's operations only run inside Dub.** `create-link.ts` imports the
application's Prisma client, storage client, queue, and analytics client as
module globals. Callers pass nothing in, which keeps them short, but the
function cannot run unless all of that infrastructure is configured. For one
application that is a fair trade. It is the cost of not drawing a hard
boundary.

**Formbricks maintains its boundary by hand.** `ports.ts` is 282 lines and
declares 19 interfaces and types that restate the row and query shapes Prisma
already generates. A change to the workflow tables has to be repeated there.
That is the price of a hard boundary, paid here to break one build cycle.

## Sources

Files were read on 2026-11-06 at the commits below. Line counts and file
lists are as of those commits.

| Repository | Commit |
| --- | --- |
| [t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo/tree/8f945b7bb3bfb3ca8358d48b1ff0214079bc11ee) | `8f945b7` |
| [epicweb-dev/epic-stack](https://github.com/epicweb-dev/epic-stack/tree/893610db76127fb5a5f1ffa786bee6b050637429) | `893610d` |
| [dubinc/dub.link](https://github.com/dubinc/dub.link/tree/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e) | `6b463b4` |
| [midday-ai/midday](https://github.com/midday-ai/midday/tree/51587319f26a0ffaa9dfccab1920373cb65689b7) | `5158731` |
| [documenso/documenso](https://github.com/documenso/documenso/tree/fdd0337bdd8f6afac64faf97113c65ed2dd0e2a2) | `fdd0337` |
| [formbricks/formbricks](https://github.com/formbricks/formbricks/tree/19e87ea16c4445bc3108f845c88062211ffa43fc) | `19e87ea` |

[t3-post]: https://github.com/t3-oss/create-t3-turbo/blob/8f945b7bb3bfb3ca8358d48b1ff0214079bc11ee/packages/api/src/router/post.ts
[epic-users]: https://github.com/epicweb-dev/epic-stack/blob/893610db76127fb5a5f1ffa786bee6b050637429/app/routes/users/index.tsx
[dub-route]: https://github.com/dubinc/dub.link/blob/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e/apps/web/app/api/links/route.ts
[dub-create]: https://github.com/dubinc/dub.link/blob/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e/apps/web/lib/api/links/create-link.ts
[midday-trpc]: https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/api/src/trpc/routers/transactions.ts
[midday-rest]: https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/api/src/rest/routers/transactions.ts
[midday-job]: https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/packages/jobs/src/tasks/transactions/enrich-transaction.ts
[midday-queries]: https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/packages/db/src/queries/transactions.ts
[doc-types]: https://github.com/documenso/documenso/blob/fdd0337bdd8f6afac64faf97113c65ed2dd0e2a2/packages/trpc/server/envelope-router/create-envelope.types.ts
[doc-proc]: https://github.com/documenso/documenso/blob/fdd0337bdd8f6afac64faf97113c65ed2dd0e2a2/packages/trpc/server/envelope-router/create-envelope.ts
[doc-op]: https://github.com/documenso/documenso/blob/fdd0337bdd8f6afac64faf97113c65ed2dd0e2a2/packages/lib/server-only/envelope/create-envelope.ts
[fb-route]: https://github.com/formbricks/formbricks/blob/19e87ea16c4445bc3108f845c88062211ffa43fc/apps/web/app/api/v3/workflows/route.ts
[fb-ports]: https://github.com/formbricks/formbricks/blob/19e87ea16c4445bc3108f845c88062211ffa43fc/packages/workflows/src/services/ports.ts
