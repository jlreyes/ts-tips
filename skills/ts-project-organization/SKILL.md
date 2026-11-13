---
name: ts-project-organization
description: >
  Principles for where TypeScript code goes and what to call it, with
  production codebases as evidence. Load when laying out a new TypeScript
  repository, package, server, Worker or command-line program, including in a
  repository that mixes TypeScript with another language; when adding a
  product capability (links, comments, sessions), a contract between client
  and server, an agent tool or generated code and the existing layout does
  not already say where it goes; when deciding whether something should be a
  package; and when asked to review or reorganize a layout. Not needed to add
  a file beside existing ones in an established layout, and not for the
  inside of a user interface.
---

# Project organization

How to decide where TypeScript code goes and what to call it: the top of a
repository, a server, a Worker, a command-line program, and the code they
share. Seven principles carry the reasoning. The examples after them show
each principle on disk in a production codebase, and a later section shows
what each approach cost those codebases. The examples disagree with each
other, so read them as evidence for the principles, not as layouts to copy.

Use the principles to lay out something new, or to settle a question an
existing layout leaves open. Inside a repository that already has a layout,
put new code where its neighbors are and name it the way they are named, even
where a principle here would choose differently. Reorganizing existing code
is a separate decision, and it belongs to the repository's owner.

The inside of a user interface (components, hooks, view state) is a separate
subject and is not covered here.

The examples come from codebases that have run in production for more than a
year, most of them still changing daily. All carry their own instructions for
coding agents.

## Principles

**TypeScript runs in browsers, servers, Workers and command-line programs,
and the compiler does not keep them apart.** Server code imported into a
browser bundle brings its database driver with it, and code that reads
`window` fails on a server. Often nothing reports either mistake, because one
compiler configuration usually covers both sides. So the first division in a
layout is by where code runs, and it should be the first thing a reader sees.
Code that both sides use has to run everywhere, so it imports from neither.
The codebases below separate the runtimes in three ways: top-level folders,
packages, or, inside a framework that mixes browser and server code in one
program, a file suffix that the build checks.

**Code that changes together lives together, under one name.** A change to
one capability of the product, say links, touches the operations on a link,
their queries and their checks. Folders named
`controllers`, `services`, `repositories` and `models` put those in four
places and mix every capability in each. Keep the behavior for one capability
in one folder named for it, in files named for the things it does, such as
`links/create-link.ts`. A new operation is then a new file whose name can be
guessed. Pieces that a framework or a tool keeps elsewhere, such as a route
or a table, carry the same name, so one search finds them all. A name that
records a pattern, a kind or a moment in history (`services`, `utils`, `v3`)
says nothing about what is inside, so anything fits there. One thing gets one
name across its folder, its package and its deployment.

**Every route, background job, command and agent tool is a caller of the same
behavior.** Each is a way in: a path by which a request reaches behavior.
Behavior written inside one way in is missing from the others, and nothing
warns whoever adds the next one. Keep ways in together by kind, routes with
routes and tools with tools, because each kind shares its own plumbing. Each
holds only what differs between them: reading the request, working out who is
asking, shaping the reply. The behavior lives in its capability's folder,
with everything that has to happen each time: the permission rule, the cache
write, the usage record. When a stateful object such as a Durable Object
holds the data, each way in calls a method on that object, and the method is
the one implementation.

**"Schema" means three different things.** A table definition says what is
stored. A contract says what crosses between two sides: a request, a
response, a message, a job's payload. Working types say what code holds in
memory. The table belongs to whichever part of the system owns the store,
with one migration history beside it. The contract belongs where both sides
can read it, written once, in a file named for what it describes. When one
side is not TypeScript, the contract is in a neutral format, or the other
side's types are generated from the one definition. These codebases write the
table and the contract by hand and keep them apart even when they look the
same, because the two change for different reasons. Code derived from either
is generated, never edited by hand, and marked as generated. A folder named
`generated` is a mark that a reader and every tool can see without opening a
file.

**Structure is a cost, paid against complexity.** Each file between a request
and its effect is one more thing to read, name and keep in step with the
rest. An operation with rules or side effects has enough behavior to fill a
file, even with one caller, because the second caller arrives without
warning. A single query does not. A fixed set of files for every operation
charges the small cases in full and does not keep the large ones small. Add
the file when the behavior exists, and split a file where one idea ends and
another begins, not when it gets long.

**A package marks a real boundary.** A workspace package can stop one part of
the code from importing another, and can be built, shipped and run without
the rest. It costs a manifest, compiler settings and an entry in every tool's
configuration. That is worth paying when a second program consumes the code,
when it runs somewhere else, when it ships to someone else, or when one part
must never reach into another. Each separately deployed program is such a
boundary. Give it a folder holding what every program has one of: its entry
file, the module that reads its environment, and its deploy settings. To find
things inside one of these, a folder does the job.

**Imports point one way, and only a tool keeps them that way.** A way in
imports behavior, behavior imports contracts, and shared code imports nothing
above it. An import in the other direction, from lower-level code to
higher-level code, such as behavior reaching into a route or shared code
reaching into the server, ties the lower piece to everything above it. Some
things hold the direction whoever or whatever writes the next change: a lint
rule that bans the import, a package that can see only the dependencies it
declares, a build that leaves the other side out, a test that bundles an
entry point and fails when the wrong file is inside. A folder name and a
sentence in a contributor guide do not. When you draw a new boundary between
runtimes or packages, add its check in the same change.

## Examples

### Outline and Langfuse: separating runtimes at the top level

```text
outline
  app/                  browser only
  server/               Node only
    routes/api/comments/  commands/  models/  policies/  presenters/
    mcp/tools/  queues/  env.ts  main.ts
  shared/               both
    editor/  utils/  validations.ts
  plugins/<name>/       client/  server/  shared/

langfuse
  web/                  the web app and its API
  worker/               background jobs
  packages/shared/      both programs
    src/index.ts            safe to import in the browser
    src/server/index.ts     server only
```

Both are products that publish no library. Outline is a single package whose
top-level folders name where code runs, and a plugin has whichever of the
same three folders it needs. Tools keep the sides apart without any package
boundary. A [lint rule][ol-lint] in `shared/` bans imports from the app and
from the server. The browser build in [`vite.config.mts`][ol-vite] has
aliases for `app/` and `shared/` only, so it cannot resolve an import of
server code. The server build in [`build.js`][ol-build] compiles `server`,
`shared` and `plugins` and never `app`. No file in `app/` or `shared/`
imports from the server.

Langfuse's top level names its two programs and the package they share. The
split between browser and server is inside that package, as two entry points.
The root is safe to import in the browser, and `./src/server` is not. A
comment at the top of [`db.ts`][lf-db] says why the database handle is kept
out of the root: "we must not import this into FE code." Langfuse's
[notes on its web app][lf-structure] say why the layout itself has to carry
this: when server code reaches the browser, "nothing crashes when that
happens, which is exactly why it has to be structural."

### opencode: runtimes separated by packages, and checked

```text
packages/
  schema/src/permission.ts            contract: Request, Reply, Rule, events
  protocol/src/groups/permission.ts   HTTP endpoints
  core/src/permission.ts              the behavior
  core/src/permission/sql.ts          its table
  core/src/tool/plugin/schedule.ts    a tool the agent calls
  server/src/handlers/schedule.ts     HTTP handler
  client/src/promise/generated/       client generated from the protocol
  cli/  tui/  app/  desktop/          one package per front end
services/                             separately deployed services
```

opencode is a coding agent with a background server and several front ends,
so it separates runtimes with packages. Its [`AGENTS.md`][oc-agents] gives
the direction imports may point: "Client runtime code may depend on Schema
and Protocol but never Core or Server". A [test][oc-boundary] bundles the
client's main entry points and fails if a file from `core` or `server` is
inside, so the direction does not depend on anyone remembering it. The
contract in `schema` and the table in [`sql.ts`][oc-sql] are separate files
in separate packages. The agent's [schedule tool][oc-tool] and the
[HTTP handler][oc-handler] for schedules both call `Schedule.Service.create`:
two ways in, one implementation. Generated client code sits in a `generated`
folder, and a script reruns the generator and fails on any difference. The
team moved to this chain of packages in mid-2026, so it is newer than the
other layouts here.

### Playwright: two sides and the protocol between them

```text
packages/
  protocol/spec/page.yml        the only hand-written definition
  protocol/src/validator.ts     generated
  playwright-core/src/
    client/page.ts    client/channels.d.ts    generated
    server/page.ts    server/channels.d.ts    generated
    client/DEPS.list  server/DEPS.list
  isomorphic/                   no Node, no DOM
  injected/                     runs inside the page
```

Playwright's [`AGENTS.md`][pw-agents] says: "Client code NEVER imports server
code. Server code NEVER imports client code. Communication is only through
the protocol." The protocol is the contract. It is written once, in YAML that
neither side owns, and the types each side uses are generated from it. Those
files sit beside hand-written ones and are marked only by a header comment,
so a reader has to open one to know. A
[`DEPS.list`][pw-deps] file beside the source lists what a folder may import,
and a script in the lint step fails on an import that is not listed.
`isomorphic` and `injected` are named for where their code can run, and lint
bans `process` and browser globals in the first.

### tldraw: a folder per deployed program, one function behind every way in

```text
apps/dotcom/
  client/                       the browser app
  sync-worker/                  a Cloudflare Worker
    wrangler.toml
    src/worker.ts               routes; exports the Durable Object classes
    src/TLFileDurableObject.ts
    src/routes/tla/forwardRoomRequest.ts
    src/routes/tla/createBoard.ts
  asset-upload-worker/  image-resize-worker/
  zero-cache/migrations/        numbered SQL files
packages/
  dotcom-shared/src/            browser and Workers: mutators.ts, routes.ts
  worker-shared/                Workers only
  editor/  tldraw/  store/      the SDK
```

Each deployed program is a folder with its own settings file, and the two
shared packages are named for who shares them, so the name says what the code
may import. A room's data is held by a Durable Object, and the Worker's route
for a room does nothing but [forward the request][tl-forward] to it. Creating
a board shows one function behind two ways in. The browser runs the
`createFile` mutator from [`dotcom-shared/src/mutators.ts`][tl-mutators], and
the agent tool in [`createBoard.ts`][tl-create] calls the same mutator. Its
comment gives the reason: "The same mutator the client pushes, so the role
check, id validation and the rows it writes (file, group_file, file_state)
cannot drift from a board created on tldraw.com."

### Dub: plain functions in a folder that lists what you can do

```text
apps/web/
  app/api/links/route.ts         reads the request, calls operations
  app/api/tags/route.ts          queries the database itself
  lib/api/links/
    create-link.ts  update-link.ts  delete-link.ts  archive-link.ts
    process-link.ts  bulk-create-links.ts  get-link-or-throw.ts  cache.ts
  lib/zod/schemas/links.ts       request and response shapes
  prisma/schema/link.prisma      the table
```

Dub is one web app, and nothing sits between a route and the database unless
it has work to do. Listing and creating tags is a few queries, and
[`tags/route.ts`][dub-tags] runs them itself. Creating a link has rules and
side effects, so it is [`create-link.ts`][dub-create]: a plain exported
function that writes the row, caches it, records it for analytics and
publishes a usage event. The HTTP route, the Slack command and the route that
adds a domain all import it, so all three get those steps. The folder is
named for a capability and each file for one thing you can do to a link. The
route, the shapes and the table live where the framework and the database
tool put them, and each is named for links.

### atproto: ways in on one side, parts of the server on the other

```text
lexicons/com/atproto/repo/createRecord.json    the contract
services/pds/index.ts                           15 lines: start the server
packages/pds/src/
  index.ts  context.ts                          start-up; one AppContext
  config/                                       env.ts, config.ts, secrets.ts
  api/com/atproto/repo/createRecord.ts          path mirrors the method name
  actor-store/record/                           reader.ts, transactor.ts
  actor-store/db/                               schema/, migrations/
  account-manager/db/                           schema/, migrations/
  sequencer/
  lexicons/                                     generated, not committed
```

This is the personal data server from Bluesky's AT Protocol implementation.
`api/` holds the ways in, one file per method at a path that mirrors the
method's name, `com.atproto.repo.createRecord`. Folders such as
`actor-store`, `account-manager` and `sequencer` are parts of the server, and
each part with a store keeps its table definitions and migrations beside its
code. What the program needs only once, such as its environment settings and
its dependencies, each has a single owner. Nothing in `packages/pds/src`
reads `process.env` outside `config/`. [`context.ts`][at-context] builds
every dependency once, and [`services/pds/index.ts`][at-service] only starts
it. The contract is a [lexicon file][at-lexicon] that code is generated from.
The tables are written by hand and are not derived from it.

### Trigger.dev: run logic in its own package

```text
apps/webapp/app/
  routes/api.v1.tasks.$taskId.trigger.ts
  v3/services/triggerTask.server.ts
  runEngine/services/triggerTask.server.ts
  env.server.ts                    one schema for the whole environment
packages/                          published: core, trigger-sdk, cli-v3
  core/src/v3/schemas/api.ts       contract, imported by the SDK and the app
internal-packages/                 private: database, run-engine, run-store
  run-engine/src/engine/index.ts
  database/prisma/schema.prisma
```

Trigger.dev runs background tasks. Its team [wrote][tr-rules] that the code
that manages a run was at first "spread out all over the codebase, with no
real separate or encapsulation", and that they rewrote it as one package.
Only the app consumes that package, so the reason for it is not a second
consumer. It is that one part must never reach into another: the engine's
source imports nothing from the app, and its
[`AGENTS.md`][tr-engine] says "This is where ALL new run lifecycle logic
should go". Nine files in the app construct the same `TriggerTaskService`,
among them the HTTP route, the scheduler and the dashboard's test button. The
two package folders are divided by who the code ships to: `packages/` holds
the packages customers install, and everything in `internal-packages/` is
private. Inside the app, browser and server code share folders, and the
`.server.ts` suffix separates them: the build keeps those files out of the
browser.

## Where each approach cost something

**Behavior left in one way in was missing from the others.** Dub sends its
`link.created` webhook from [`app/api/links/route.ts`][dub-route], after
`createLink` returns. A link created by the Slack command goes through
`createLink` and sends no webhook. Outline's agent tool for creating a
comment, [`server/mcp/tools/comments.ts`][ol-mcp], repeats the route's steps
instead of calling shared code, and the copies differ. The route saves the
document with `silent: true`, with a comment saying this keeps a new comment
from marking the document as updated. The tool saves it without that option.
tldraw's shared mutator has no limit on the number of files, because "the
client enforces it before calling", so the agent tool that calls the mutator
had to add a limit check of its own. atproto's four handlers that write
records each end with the same two calls.

**A shape with no shared definition was written twice.** Outline's server
builds each response in a presenter, and the browser never imports those
shapes. It declares each entity again: twenty-six model files have the same
name in `app/models` and `server/models`.

**Splitting by role spread one capability's behavior across the tree.**
Inside `server/`, Outline groups by role. What the server does with a comment
is in `models/Comment.ts`, `policies/comment.ts`, `presenters/comment.ts` and
the route file. Matching names make it searchable, and a change to the
behavior still opens four folders. opencode pays the same kind of price for
its chain: permissions are four files in four packages, and the smallest
handlers in `server` are 8 lines. What opencode gets for it is a client that
cannot reach the core, checked by a test.

**Rules that nothing checks were not kept.** Langfuse's notes ask every
feature for two entry points, one safe for the browser and one for the
server. Its tool reports violations as warnings against a recorded baseline,
and none of its 90 features has the server entry point. Trigger.dev's
instructions for its app say never to read `process.env` outside
`env.server.ts`, and twenty files do. Nothing checks the folders inside
tldraw's sync Worker, and [`TLFileDurableObject.ts`][tl-do] imports three
modules from `routes/`. Outline's rule, which lint and its builds check, has
no exceptions.

**Structure sorted the behavior without shrinking it.**
`TLFileDurableObject.ts` holds routing, sign-in checks, room start-up and
saving in one class of 3,766 lines. Trigger.dev's run queue, inside the
package built to contain run logic, is one file of 7,815 lines. Good
boundaries told a reader where each kind of code goes. They did not keep it
small.

**Names that said nothing collected everything.** Dub's `lib/` holds 565
files. Its folders are vendor names (`tinybird`, `upstash`, `stripe`),
technical kinds (`zod`, `swr`, `actions`, `middleware`) and capabilities of
the product (`analytics`, `webhook`, `folder`). Browser code in `lib/swr` and
`lib/hooks` sits beside the database client in `lib/prisma`, and three files
in the repository are marked `server-only`. Outline's `server/utils` holds 55
files. Trigger.dev's app has a folder named `v3/`, and the repository's
`AGENTS.md` says the "directory name is historical - everything there now
serves V2". The same app has three folders named `services` and two files
named `triggerTask.server.ts`. tldraw's sync Worker is the folder
`sync-worker`, the package `@tldraw/dotcom-worker`, and the deployed Worker
`tldraw-multiplayer`.

## What these codebases do not agree on

They split on how code reaches what it depends on. Dub and Outline import a
module-level database handle. atproto and tldraw pass one context object to
every handler. opencode resolves its services through a library. Playwright
wires objects together with constructor arguments. They split on whether
tests sit beside the source or in their own tree, and on whether generated
code is committed. The principles above do not settle these. Follow what the
repository already does.

## Sources

Files were read on 2026-11-13 at the commits below. Line counts and file
lists are as of those commits.

| Repository | Commit |
| --- | --- |
| [outline/outline](https://github.com/outline/outline/tree/2206588aa88a09b6ddd0698259954b6c8c92bc64) | `2206588` |
| [langfuse/langfuse](https://github.com/langfuse/langfuse/tree/a7147b24979a12eaed4cab7ec488e8d198273abd) | `a7147b2` |
| [anomalyco/opencode](https://github.com/anomalyco/opencode/tree/f6e0c2d0833ffe772035f221fed923e1cd5fb408) | `f6e0c2d` |
| [microsoft/playwright](https://github.com/microsoft/playwright/tree/dbcf1194a7978a59e05268edb7738cf1a0aeddb8) | `dbcf119` |
| [tldraw/tldraw](https://github.com/tldraw/tldraw/tree/7e0e52a3e3e38697bfb10f9107a004bbd5c6e51b) | `7e0e52a` |
| [dubinc/dub.link](https://github.com/dubinc/dub.link/tree/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e) | `6b463b4` |
| [bluesky-social/atproto](https://github.com/bluesky-social/atproto/tree/98bbf2b15648a7926401bd3dd0c448cffc4d9f28) | `98bbf2b` |
| [triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev/tree/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d) | `2fbd5c7` |

Dub's public repository was cut down to its links product on 2026-10-26 and
has had no commits since, so it shows that product as it stood then.

[ol-lint]: https://github.com/outline/outline/blob/2206588aa88a09b6ddd0698259954b6c8c92bc64/shared/.oxlintrc.json
[ol-vite]: https://github.com/outline/outline/blob/2206588aa88a09b6ddd0698259954b6c8c92bc64/vite.config.mts
[ol-build]: https://github.com/outline/outline/blob/2206588aa88a09b6ddd0698259954b6c8c92bc64/build.js
[ol-mcp]: https://github.com/outline/outline/blob/2206588aa88a09b6ddd0698259954b6c8c92bc64/server/mcp/tools/comments.ts
[lf-db]: https://github.com/langfuse/langfuse/blob/a7147b24979a12eaed4cab7ec488e8d198273abd/packages/shared/src/db.ts
[lf-structure]: https://github.com/langfuse/langfuse/blob/a7147b24979a12eaed4cab7ec488e8d198273abd/web/scripts/structure/README.md
[oc-agents]: https://github.com/anomalyco/opencode/blob/f6e0c2d0833ffe772035f221fed923e1cd5fb408/AGENTS.md
[oc-boundary]: https://github.com/anomalyco/opencode/blob/f6e0c2d0833ffe772035f221fed923e1cd5fb408/packages/client/test/import-boundaries.test.ts
[oc-sql]: https://github.com/anomalyco/opencode/blob/f6e0c2d0833ffe772035f221fed923e1cd5fb408/packages/core/src/permission/sql.ts
[oc-tool]: https://github.com/anomalyco/opencode/blob/f6e0c2d0833ffe772035f221fed923e1cd5fb408/packages/core/src/tool/plugin/schedule.ts
[oc-handler]: https://github.com/anomalyco/opencode/blob/f6e0c2d0833ffe772035f221fed923e1cd5fb408/packages/server/src/handlers/schedule.ts
[pw-agents]: https://github.com/microsoft/playwright/blob/dbcf1194a7978a59e05268edb7738cf1a0aeddb8/AGENTS.md
[pw-deps]: https://github.com/microsoft/playwright/blob/dbcf1194a7978a59e05268edb7738cf1a0aeddb8/packages/playwright-core/src/client/DEPS.list
[tl-forward]: https://github.com/tldraw/tldraw/blob/7e0e52a3e3e38697bfb10f9107a004bbd5c6e51b/apps/dotcom/sync-worker/src/routes/tla/forwardRoomRequest.ts
[tl-mutators]: https://github.com/tldraw/tldraw/blob/7e0e52a3e3e38697bfb10f9107a004bbd5c6e51b/packages/dotcom-shared/src/mutators.ts
[tl-create]: https://github.com/tldraw/tldraw/blob/7e0e52a3e3e38697bfb10f9107a004bbd5c6e51b/apps/dotcom/sync-worker/src/routes/tla/createBoard.ts
[tl-do]: https://github.com/tldraw/tldraw/blob/7e0e52a3e3e38697bfb10f9107a004bbd5c6e51b/apps/dotcom/sync-worker/src/TLFileDurableObject.ts
[dub-tags]: https://github.com/dubinc/dub.link/blob/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e/apps/web/app/api/tags/route.ts
[dub-create]: https://github.com/dubinc/dub.link/blob/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e/apps/web/lib/api/links/create-link.ts
[dub-route]: https://github.com/dubinc/dub.link/blob/6b463b4bdd9ed2fd9aa416f67b5b77d317b1471e/apps/web/app/api/links/route.ts
[at-context]: https://github.com/bluesky-social/atproto/blob/98bbf2b15648a7926401bd3dd0c448cffc4d9f28/packages/pds/src/context.ts
[at-service]: https://github.com/bluesky-social/atproto/blob/98bbf2b15648a7926401bd3dd0c448cffc4d9f28/services/pds/index.ts
[at-lexicon]: https://github.com/bluesky-social/atproto/blob/98bbf2b15648a7926401bd3dd0c448cffc4d9f28/lexicons/com/atproto/repo/createRecord.json
[tr-rules]: https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.cursor/rules/webapp.mdc
[tr-engine]: https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/internal-packages/run-engine/AGENTS.md
