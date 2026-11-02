# Shared standards validation

Behavior: installing the packed npm artifact into an otherwise independent repository
must load its configs, reject violations, and honor repository-owned overrides.
The package is optional; existing consumers and installed agent skills stay unchanged.

| Seam | Tier | Real | Mocked | Why mocked |
| --- | --- | --- | --- | --- |
| Package contents → consumer installation | Integration | npm pack, tarball, npm install with real registry tool dependencies, exported files | None | — |
| Consumer config → lint/compiler/formatter | Integration | Pinned Oxlint, TypeScript, Oxfmt binaries and filesystem | None | — |
| Workspace config → hoisted dependency | Integration | npm workspace install, root-owned config, real tools from workspace | None | — |
| Local override → merged effective policy | Integration | Tool config loading and failing/passing source | None | — |
| New package version → existing consumer | Integration | Repack a changed preset, install it, rerun same source | None | — |

Negative cases introduce actual violations: explicit any, too many parameters,
a long function/file, unchecked indexed access, and mismatched formatting. Local
exceptions must affect only their documented scope. A changed shared rule must take
effect after a consumer installs the changed artifact, without editing its config.
No registry publishing, credentials, Git hooks, CI migration, or consumer migration
is part of this change. Registry release and dependency-bot operation remain untested.

Review findings and pinning evidence:

- Workspace dependency hoisting: documented root-owned config layout and the real
  workspace consumer test verify root resolution and inherited rejection behavior.
- Cold npm cache lacked metadata needed for offline resolution: consumer tests now
  allow normal registry resolution while always installing the preset from its
  local tarball. A new empty-cache `npm ci` followed by checks/tests validates CI
  setup; offline delivery of third-party tools is outside the package contract.

CI starts each matrix job with a fresh runner-temporary npm cache, then runs
`npm ci`, checks and consumer tests. This permanently pins the cold-cache setup
without recursively reinstalling the repository inside each test invocation.
