# TypeScript language & type-system: 4.9 → 6.0.3

Verified 2026-06-30 against the official release notes
(typescriptlang.org/docs/handbook/release-notes/, devblogs.microsoft.com/typescript)
and, where noted, by reading the actual `.d.ts` lib files inside an installed
`typescript@6.0.3` package — not inferred from prose alone. For the native
Go compiler (tsgo / TypeScript 7), see `tsgo-native-compiler.md` instead.

## `satisfies`

**Lands:** TS 4.9 · **Status:** Stable

Validates an expression against a type without widening the expression's
inferred type (unlike a `: Type` annotation) and without losing literal
precision (unlike no annotation at all).

**Replaces:** `const x: SomeType = {...}` — which widens the literal type away
and loses downstream inference precision.

```ts
type Routes = Record<string, { method: "GET" | "POST" }>;
const routes = {
  health: { method: "GET" },
} satisfies Routes;
routes.health.method; // type is "GET", not widened to "GET" | "POST"
```

## `const` type parameters

**Lands:** TS 5.0 · **Status:** Stable

`<const T>` on a generic infers the literal/readonly-tuple type directly,
without the caller needing `as const`.

**Replaces:** requiring every call site to write `as const`, or accepting
widened `string[]`/`number` inference.

```ts
function tuple<const T extends readonly unknown[]>(...items: T): T {
  return items;
}
const t = tuple("a", "b"); // readonly ["a", "b"], no `as const` needed at the call site
```

## Decorators (TC39 Stage 3 standard decorators)

**Lands:** TS 5.0 · **Status:** Stable syntax — **but likely unusable wherever your runtime executes `.ts` files natively**

Native `@decorator` syntax for classes/methods/fields/accessors using a
`(value, context)` signature — replaces the old `--experimentalDecorators` +
`reflect-metadata` legacy decorators (`(target, key, descriptor)` signature).

```ts
function logged(orig: any, ctx: ClassMethodDecoratorContext) {
  return function (this: any, ...args: any[]) {
    console.log(`call ${String(ctx.name)}`);
    return orig.call(this, ...args);
  };
}
class Foo { @logged greet() { return "hi"; } }
```

**Note — read before using:** decorators require real runtime code
transformation (calling the decorator function and reassigning the member),
not pure type erasure. Node's own docs say this in as many words: *"Since
Decorators are currently a TC39 Stage 3 proposal, they are not transformed
and will result in a parser error. Node.js does not provide polyfills and
thus will not support decorators until they are supported natively in
JavaScript."* If your project runs `.ts` files directly via Node's native
type stripping (see `node-runtime.md`), decorators will break at runtime
regardless of what `tsc` says. Interestingly, TypeScript's own
`--erasableSyntaxOnly` flag does **not** list decorators among its forbidden
constructs (confirmed against the official tsconfig reference page) — so a
project relying on `erasableSyntaxOnly` alone to catch this at compile time
will **not** be warned; the failure shows up at `node file.ts` runtime
instead. `--experimentalDecorators` (the legacy mode) remains supported
indefinitely as a separate opt-in and is unaffected by this.

## `using` / `await using` — Explicit Resource Management

**Lands:** TS 5.2 · **Status:** Stable syntax — **but check your `lib` setting**

Block-scoped declarations that automatically call
`[Symbol.dispose]()`/`[Symbol.asyncDispose]()` on scope exit (sync/async),
including on early return or thrown exceptions, in LIFO order.

**Replaces:** hand-rolled `try { ... } finally { resource.close() }` /
`try { ... } finally { await conn.release() }` boilerplate.

```ts
async function withTx(db: Db) {
  await using tx = await db.beginTransaction();
  await tx.query("INSERT ...");
} // tx[Symbol.asyncDispose]() runs automatically, even if query() throws
```

**Note:** `Disposable`/`AsyncDisposable`/`Symbol.dispose`/`Symbol.asyncDispose`/
`DisposableStack`/`AsyncDisposableStack` live only in the `esnext.disposable`
lib file. A project targeting `"lib": ["ES2024"]` does **not** pull this in —
confirmed by checking the installed package's actual lib reference chains,
not just prose — and will get "Cannot find name" errors on first use. You
need `"esnext.disposable"` added to `lib` explicitly (or `lib`/`target` set
to `esnext`). On the runtime side, this needs Node 24+ (V8 13.6) — see
`node-runtime.md`.

## Import attributes — `with { type: "json" }`

**Lands:** TS 5.3 (tightened in 5.7, deprecation of the old syntax extended in 6.0) · **Status:** Stable

Standardized syntax for attaching runtime-relevant metadata to module
imports, replacing the deprecated `assert` keyword.

**Replaces:** `import data from "./x.json" assert { type: "json" }` (import
*assertions* — deprecated).

```ts
import config from "./config.json" with { type: "json" };
// dynamic form:
const config2 = await import("./config.json", { with: { type: "json" } });
```

**Note:** TS 5.7 requires the attribute and restricts JSON imports to
default-only access under `nodenext`. TS 6.0 extends the `assert`-syntax
deprecation to dynamic `import()` calls too — use `with` everywhere, never
`assert`, regardless of which form you're using.

## `NoInfer<T>`

**Lands:** TS 5.4 · **Status:** Stable

A utility type that excludes a type-parameter position from being used as an
inference site.

**Replaces:** splitting a function into curried/overloaded forms just to stop
a "default value" argument from polluting union inference.

```ts
function pickColor<C extends string>(options: C[], chosen: NoInfer<C>) {}
pickColor(["red", "green"], "blue"); // error: "blue" correctly rejected
```

## Inferred type predicates

**Lands:** TS 5.5 · **Status:** Stable

Functions with a single return statement that's a boolean expression
refining their parameter now automatically narrow their return type to a
predicate (`x is T`) — no explicit annotation needed.

**Replaces:** manually writing `function isDefined<T>(x: T | undefined): x is T { ... }`,
or accepting that `.filter()` doesn't narrow and needing a post-hoc cast.

```ts
const items = [1, 2, undefined, 3].filter(x => x !== undefined);
// inferred as number[], not (number | undefined)[]
```

**Note:** truthiness checks (`.filter(x => !!x)`) are deliberately **not**
inferred as predicates, since `0`/`""` would be wrongly excluded — only
strict comparisons against the exact excluded value narrow automatically.

## `--isolatedDeclarations`

**Lands:** TS 5.5 · **Status:** No longer flagged experimental — **NEEDS RE-VERIFICATION on the word "stable"** specifically; no official source uses that exact word, only the absence of "experimental" framing as of 6.0

Requires explicit type annotations on every export so `.d.ts` files can be
generated file-by-file, without a full cross-file type-checking pass.

**Replaces:** relying on inferred return/export types plus a single
whole-program `tsc` declaration-emit pass.

```ts
// Error under isolatedDeclarations: "must have explicit type annotation"
export function add(a: number, b: number) { return a + b; }
// Fix:
export function add(a: number, b: number): number { return a + b; }
```

**When to use:** monorepos wanting parallel/per-package declaration builds,
or compatibility with faster non-`tsc` declaration emitters — including
`tsgo`, which lists fast declaration emit as one of the last gaps it closed
on the way to parity (see `tsgo-native-compiler.md`).

## Iterator helper methods

**Lands:** TS 5.6 · **Status:** Stable — **but check your `lib` setting**

Native `.map`/`.filter`/`.take`/`.drop`/`.toArray` directly on
iterator/generator objects, so you don't need to materialize an array first.

**Replaces:** `Array.from(iter).filter(...)` or manual `for...of`
accumulation loops just to filter/map a generator.

```ts
function* nums() { let i = 0; while (true) yield i++; }
for (const n of nums().filter(x => x % 2 === 0).take(3)) console.log(n);
```

**Note:** as of TS 6.0.3, these types live in the `es2025`-bucket lib files,
not `es2024`. A project targeting `"lib": ["ES2024"]` will not have these
types available, even though the feature "landed" in TS 5.6 — confirmed by
reading the installed package's lib files directly. Needs `lib: ["ES2025"]`
(which cascades down through ES2024) or `"ESNext"`.

## `--erasableSyntaxOnly`

**Lands:** TS 5.8 · **Status:** Stable

Errors on any TS-specific construct that can't be mechanically erased into
valid JS without real code transformation — matching exactly what a native
type-stripping runtime (e.g. Node's, see `node-runtime.md`) can execute.

**Replaces:** nothing syntactically — it's a guard rail that catches
incompatible patterns at `tsc` time instead of failing at `node app.ts`
runtime.

```ts
// All of these error under --erasableSyntaxOnly:
enum Color { Red, Green }                    // use a `const ... as const` object instead
class P { constructor(public x: number) {} } // declare fields explicitly instead
import Foo = require("foo");                  // use `import foo from "foo"` instead
```

**Note:** pair with `verbatimModuleSyntax`. Its forbidden-construct list does
**not** include decorators — see the Decorators entry above for why that
still matters.

## TypedArray generics & the `Buffer`/`ArrayBuffer` breaking change

**Lands:** generics in TS 5.7, breaking change in TS 5.9 · **Status:** Stable

All TypedArrays (`Uint8Array`, etc.) and Node's `Buffer` became generic over
their underlying buffer type in 5.7; in 5.9, `ArrayBuffer` stopped being
treated as a supertype of `TypedArray`/`Buffer`.

**Replaces/breaks:** code passing a `Buffer` where `ArrayBuffer` is expected
now needs `.buffer` accessed explicitly — this is a real breaking change, not
just a new capability.

```ts
let data = new Uint8Array([1, 2, 3]);
someFn(data.buffer); // must access .buffer explicitly as of 5.9
```

**Note:** high-impact for any binary/crypto/stream-handling code — exactly
the kind of silent break a model trained pre-5.9 will not anticipate.

## Set methods, `Map`/`WeakMap` upsert, `RegExp.escape`

**Lands:** Set methods TS 5.5, `Map`/`WeakMap.getOrInsert(Computed)` and
`RegExp.escape` TS 6.0 · **Status:** Stable — **but check your `lib` setting**

`Set.prototype.union/intersection/difference/symmetricDifference/isSubsetOf/
isSupersetOf/isDisjointFrom`; `Map`/`WeakMap.prototype.getOrInsert`/
`getOrInsertComputed` ("upsert" without a separate has-check); `RegExp.escape`.

**Replaces:** manual `new Set([...a].filter(x => b.has(x)))`-style set
algebra; `if (!map.has(k)) map.set(k, computeDefault())` existence-check-then-set.

```ts
const merged = setA.union(setB);
const bucket = cache.getOrInsertComputed(key, () => expensiveCompute(key));
```

**Note:** Set methods live in `lib.es2025.collection.d.ts`, not
`es2024` — despite TS "supporting" them since 5.5. `Map`/`WeakMap` upsert
methods live in the `esnext` lib bucket. Neither is available under
`"lib": ["ES2024"]`; need `ES2025`/`ESNext`. This is the single easiest trap
in this whole reference — "I targeted ES2024, so ES2024-named features must
work" is false here.

## TypeScript 6.0 itself

**Lands:** 6.0 GA 2026-03-23, patched to 6.0.3 on 2026-04-16 · **Status:** Stable

Confirmed via the official announcement: 6.0 is overwhelmingly a **version-
realignment/bridge release**, not a language-feature release — the team's
own framing is that 6.0 is "intended to be the last release based on the
current JavaScript codebase" before the Go-ported compiler takes over (see
`tsgo-native-compiler.md`).

What it actually contains, in order of substance:
1. **Default-config flips** for new projects: `strict` defaults `true`,
   `module` defaults `esnext`, `target` floats to `es2025`,
   `noUncheckedSideEffectImports` defaults `true`, `types` defaults to `[]`
   (must opt in explicitly), `rootDir` defaults to the tsconfig's own
   directory. A project that already sets all of these explicitly is
   insulated from this whole bucket.
2. **A deprecation/removal wave** ahead of 7.0: `target es5`, `module
   amd|umd|systemjs|none`, `moduleResolution node|classic`,
   `downlevelIteration`, `baseUrl`, `outFile` all removed or hard-deprecated;
   `esModuleInterop`/`alwaysStrict` can no longer be set to `false`; bare
   `module Foo {}` namespace syntax is hard-deprecated (ambient `declare
   module "specifier"` string-literal modules, the pattern used for
   `.css`/`.json` shims, are **unaffected**). A `"ignoreDeprecations": "6.0"`
   escape hatch exists for migration.
3. **New ambient type declarations** for already-shipped JS runtime features
   (Temporal, `RegExp.escape`, Map/WeakMap upsert, an `es2025`
   target/lib) — lib additions, not new TypeScript syntax.
4. One real language-level change: method-position function type inference
   now matches arrow-function inference priority for methods that don't use
   `this`.
5. `tsc foo.ts` now errors if a `tsconfig.json` is present in the directory
   (`--ignoreConfig` to override) — a footgun-prevention change worth
   knowing about for ad hoc CLI invocations.

## Also notable (condensed — landed, lower priority for most backend code)

- **Control-flow narrowing bundle (5.3–5.7):** `switch(true)` narrows
  per-case (5.3); narrowing survives into closures created after it, as long
  as the variable isn't reassigned in any nested function (5.4); `obj[key]`
  narrows when both are effectively constant (5.5); "never assigned" (not
  just "possibly unassigned") detection across nested functions (5.7).
- **`--module preserve` (5.4), `node18` (5.8), `node20` (5.9):** stable
  alternatives to the ever-floating `nodenext` — only relevant if you're not
  already settled on `nodenext`.
- **`--rewriteRelativeImportExtensions` (5.7):** rewrites `.ts`/`.mts`/`.cts`
  extensions in relative imports to `.js`/`.mjs`/`.cjs` at emit time, so you
  can write `.ts` extensions in source and still get valid emitted output if
  you ever add a `tsc`-emit build step.
- **`import defer` (5.9):** deferred-evaluation namespace imports — module
  resolves but its body doesn't execute until a property is first touched.
  Namespace-only, needs `--module preserve`/`esnext`, and needs runtime
  support — early-adopter territory, check your runtime before relying on it.
- **Disallowed always-truthy/always-falsy conditionals (5.6):** `tsc` now
  flags conditions that are structurally always truthy/falsy (e.g. a regex
  literal where you meant to call `.test()`).
- **`--noUncheckedSideEffectImports` (5.6):** errors on bare side-effect
  imports (`import "./mod";`) that resolve to nothing, catching typo'd or
  deleted modules.

## Summary

| Feature | Lands | Status | Is it usable under `lib: ["ES2024"]`? |
|---|---|---|---|
| `satisfies` | TS 4.9 | Stable | Yes |
| `const` type parameters | TS 5.0 | Stable | Yes |
| Decorators | TS 5.0 | Stable (syntax) | Syntax yes, but check your **runtime** — see note above |
| `using`/`await using` | TS 5.2 | Stable (syntax) | **No** — needs `esnext.disposable` added to `lib` |
| Import attributes (`with`) | TS 5.3 | Stable | Yes |
| `NoInfer<T>` | TS 5.4 | Stable | Yes |
| Inferred type predicates | TS 5.5 | Stable | Yes |
| `--isolatedDeclarations` | TS 5.5 | No longer "experimental" (NEEDS RE-VERIFICATION on "stable") | N/A — opt-in flag |
| Iterator helpers | TS 5.6 | Stable | **No** — needs `ES2025`/`ESNext` lib |
| `--erasableSyntaxOnly` | TS 5.8 | Stable | N/A — opt-in flag |
| TypedArray generics / `Buffer`↔`ArrayBuffer` | TS 5.7 / 5.9 | Stable | Yes |
| Set methods / Map upsert / `RegExp.escape` | TS 5.5 / 6.0 | Stable | **No** — needs `ES2025`/`ESNext` lib |
| TypeScript 6.0 (bridge release) | TS 6.0 | Stable | N/A |

## Sources

- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html through `typescript-5-9.html` (per-version release notes)
- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html
- https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html
- https://nodejs.org/api/typescript.html (decorators-rejection statement)
- microsoft/TypeScript PR #61011 and design-meeting notes #61020 (erasableSyntaxOnly construct list)
- Empirical: `lib.es2024.full.d.ts` / `lib.es2025.*.d.ts` / `lib.esnext.*.d.ts` reference chains read directly from an installed `typescript@6.0.3` package, 2026-06-30
