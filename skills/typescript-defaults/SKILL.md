---
name: typescript-defaults
description: James's fallback TypeScript standards, backend organization principles, and executable quality setup. Use for TypeScript work when a repository has no local coding standards, lint, formatting, or type-checking policy; existing repository policy takes precedence.
---

# TypeScript defaults

Inspect repository instructions, package scripts, compiler and lint/format
configuration first. Follow existing local policy. Do not replace or supplement
an established toolchain automatically; report a material gap in that policy.

Without local standards, use the judgment in
[TypeScript principles](references/principles.md) and the relevant linked
reference. These defaults do not waive independent implementation review.

When deciding where backend code goes or what to name it, read
[Backend organization](references/backend-organization.md). It gives four
principles and shows each one in a production codebase's real file tree.

The bundled preset supplies the executable checks used in personal-agent-tools:
strict TypeScript; Oxlint and Oxfmt; file/function/complexity limits; suppression
and double-assertion checks; folder limits; exact dependency pins; staged commit
checks and a full push check. The preset targets Node 24/26 TypeScript with
NodeNext resolution. For a browser/framework project, use its native scaffold
and adapt equivalent checks to its compiler and bundler; do not force NodeNext.

During an authorized TypeScript implementation, inspect the bootstrap plan:

```sh
python3 <this-skill>/scripts/bootstrap.py /absolute/repository
```

An existing policy returns `existing-policy`; leave it intact. With no policy,
apply the plan with `--apply`, then use the project's package manager to install
the pinned development dependencies and run `lefthook install`. Installation
requires the normal task's authorization; this skill never authorizes changes
to an unrelated repository. No bootstrap command installs dependencies,
contacts a service, commits, or changes user-global Git hooks.

Run `quality:check` before treating setup as operational. The staged hook checks
staged source and staged configuration; pre-push runs full lint, formatting,
type checks, and repository checks. Commit the resulting lockfile and setup.
Check CI integration in the repository's normal workflow. If tests fail, retain
the failure evidence and follow the repository's independent-review policy.
