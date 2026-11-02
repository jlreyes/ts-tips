# @jlreyes/typescript-standards

Optional, versioned TypeScript quality presets. One shared source, with explicit
repository overrides. Intended for **public npm distribution**, usable from both
public and private repositories. Package visibility does not change consumer
visibility. Keep private application details and exceptions in the consumer.

**Status: proposed 0.1.0, not published.** The npm scope/name has not been reserved
or verified for publishing. This PR creates the package and tests its tarball;
it does not publish it, migrate a repo, or change either machine's agent setup.

## What is shared

| Export                 | Shared policy                                                                                        | Consumer owns                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `oxlint.json`          | Complexity, file/function limits, type-import discipline, explicit-any and TS-comment restrictions   | Files, ignores, environments, plugins, scoped exceptions          |
| `oxfmt`                | Width 100, indentation 2, semicolons, double quotes, trailing commas                                 | Config wrapper, ignored paths, intentional style overrides        |
| `tsconfig.strict.json` | Strictness, indexed-access checking, unused checks, isolated modules and type-only import discipline | Runtime, module resolution, JSX, types, emit and source selection |
| `tsconfig.node.json`   | Strict preset plus ES2024, NodeNext, Node types and no emit                                          | Source selection, Node types dependency, project-specific options |

Lint limits: modified complexity 12; nesting 4; 3 classes/file; 1,000 lines/file;
100 lines/function; 6 parameters; 40 statements/function. Blank/comment lines
are excluded from line limits. These detect size, not architectural quality.

Compiler presets intentionally contain no `include`, `exclude`, `files`, `paths`,
`rootDir` or `outDir`; those paths must resolve in the consuming repository.
The Node preset is for typechecking source run by Node or another tool. A library
that emits JavaScript/declarations should use the strict preset and choose its
own build settings. Browser/framework projects should likewise extend strict,
then retain their scaffold's module resolution, JSX, libraries and emit policy.

## Consumer example (after publication)

Install exact versions with your package manager and commit its lockfile:

```sh
npm install --save-dev --save-exact @jlreyes/typescript-standards@0.1.0 \
  typescript@6.0.3 oxlint@1.71.0 oxfmt@0.56.0 @types/node@24.13.3
```

Those are the tested peer versions, not a promise that every future tool release
is compatible. The consumer installs the binaries; the preset does not silently
select a different toolchain. Tool version updates need validation here first.

`.oxlintrc.json`:

```json
{
  "extends": ["./node_modules/@jlreyes/typescript-standards/oxlint.json"],
  "env": { "node": true, "es2024": true },
  "ignorePatterns": ["dist/**"]
}
```

The explicit relative path is intentional: Oxlint's JSON `extends` resolves file
paths, rather than npm package specifiers. This example assumes a standalone
project with the package at that relative path. A direct workspace dependency
can still be hoisted; it does not guarantee a workspace-local `node_modules`.

`tsconfig.json`:

```json
{
  "extends": "@jlreyes/typescript-standards/tsconfig.node.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`oxfmt.config.mjs`:

```js
import defaults from "@jlreyes/typescript-standards/oxfmt";

export default {
  ...defaults,
  ignorePatterns: ["dist/**"],
};
```

Oxfmt has no JSON `extends`. The JavaScript wrapper composes the shared object.
Pass it explicitly: `oxfmt --check --config oxfmt.config.mjs src`. This avoids
relying on automatic discovery of `.mjs` configs in a particular Oxfmt version.
Replace the repo's previous formatter config when deliberately adopting this;
do not leave two competing configs.

Suggested checks: `oxlint --deny-warnings src`, the formatter command above, and
`tsc -p tsconfig.json`. Wire them into that repo's existing scripts and CI.
The complete runnable example is in `examples/node` in the source repository.

## npm workspaces

Prefer one root-owned lint config and root dev dependency. For a layout with
`app/src`, root `node_modules` and root `.oxlintrc.json`, use the same root config
shown above. From the `app` workspace, run:

```sh
oxlint --deny-warnings --config ../.oxlintrc.json src
```

The `extends` path is relative to the root config; the selected `src` path is
relative to the command's working directory. Adjust the `../` for deeper apps.
TypeScript's package-based extends and the formatter's module import can resolve
upward to the root package. Their local source paths and ignore patterns remain
owned by the workspace. Do not copy the standalone JSON extends path into a
nested workspace without checking the actual package layout. The test suite
exercises both the standalone and this npm-hoisted workspace layout. Other
package-manager layouts need equivalent verification when adopting the package.

## Overrides

Keep an exception as narrow as possible, with its reason in local documentation.
For example, retain the shared limits for application code while allowing a
seventh parameter in a single generated file:

```json
{
  "extends": ["./node_modules/@jlreyes/typescript-standards/oxlint.json"],
  "env": { "node": true, "es2024": true },
  "overrides": [
    {
      "files": ["src/generated.ts"],
      "rules": { "max-params": ["error", 7] }
    }
  ]
}
```

A root `rules` entry overrides that rule for the whole project. Other inherited
rules remain active. Rule option values are replaced, not concatenated. If you
set `plugins`, include the inherited `typescript` and `unicorn` entries too;
plugin lists replace the base list. Shared configs contain no path ignores.

For formatting, `{ ...defaults, printWidth: 120 }` changes only the width. This
is a shallow JavaScript spread; arrays and nested objects are replaced, not
deep-merged. For TypeScript, local `compilerOptions` override inherited options;
source-selection arrays replace inherited arrays. Project references stay local.

## Promote an experiment upstream

1. Try a rule as a local override in the consuming repo, for example reducing
   `max-lines-per-function` from 100 to 80. Do not edit `node_modules`.
2. If it should apply everywhere, open a PR here changing `oxlint.json` and its
   relevant behavioral test. Include the motivating consumer case. Private
   source stays private; use a minimal public reproduction.
3. Review, validate, then release a new package version. Stricter rules, tighter
   limits and changed formatting can break consumers even without an API change.
   During 0.x, make those minor releases; reserve patches for compatible fixes.
   From 1.0 onward, use major releases for newly failing existing code.
4. Each consumer updates its exact dependency and lockfile in a normal PR, runs
   its checks, then removes any override that would mask the upstream change.

A local `.oxlintrc` edit does **not** fan out automatically. Only the accepted
shared change does, after release and consumer updates. Dependency bots can
propose those updates later; none are added to consumer repos by this PR.
Laptop and Studio then install the same locked version for the same revision.
A global npm install is unnecessary. Different repo revisions may intentionally
use different versions, and neither machine is updated behind your back.

## Boundaries

This package can distribute configuration and, later, portable checkers. It
cannot make a check run: file inventory, CI invocation, staged-index checking,
Git-hook installation and test/service commands still require repo wiring.
It does not configure editors or agents globally, replace coding guidance,
provide independent review, or guarantee correctness from a green lint result.

This first version does **not** port the custom guards from the private fallback:
AST checks for double assertions and all inline lint/formatter suppressions;
folder file-count caps; dependency-pin and script-path checks; extensionless
Node entrypoint handling; or checks against staged Git content. The TS-comment
rule and explicit-any rule are included, but that is not equivalent to the full
suppression guard. No type-aware Oxlint engine is bundled; TypeScript performs
typechecking. Keep existing guards until deliberately extracted and validated.

Future portable guards could be additional versioned exports/commands in this
same package. Private repo paths, service checks and business policy should
remain local. This package can coexist with local standards; it does not have
to replace every quality script in order to eliminate duplicated presets.

## Review without publishing

From the repository root:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm pack --workspace @jlreyes/typescript-standards --ignore-scripts
```

The tests install the real tarball into a temporary consumer with real registry tool dependencies
(network access may be needed), run the real tools, verify overrides and install a second
locally packed version to verify policy propagation. No registry release occurs.
You can also copy `examples/node` outside the checkout, install the resulting
`.tgz` there with `npm install --save-dev --save-exact /absolute/path/to/file.tgz`,
and run `npm run check`. Its remaining dev dependencies come from npm.

A future release can publish this workspace to npm after package-name access,
contents and version have been reviewed. There is deliberately no automatic
publish workflow or postinstall hook in this proposal.

Configuration references: [Oxlint](https://oxc.rs/docs/guide/usage/linter/config),
[Oxfmt](https://oxc.rs/docs/guide/usage/formatter/config),
[TypeScript extends](https://www.typescriptlang.org/tsconfig/#extends).
