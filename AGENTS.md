# make-forman-schema

TypeScript library for converting and validating **Forman Schema** (Make's internal form field DSL) to/from JSON Schema 7, with async validation supporting remote option resolution.

**Tech:** TypeScript, Jest+ts-jest, tsup (dual ESM+CJS output). No runtime dependencies — devDependencies only.

## Project map

- `src/index.ts` — public API: re-exports `toJSONSchema`, `toFormanSchema`, `validateForman`, `validateFormanWithDomains`, and all types
- `src/types.ts` — all type definitions
- `src/forman.ts` — `toJSONSchema` conversion
- `src/json.ts` — `toFormanSchema` conversion
- `src/validator.ts` — validation engine
- `src/utils.ts` — shared helpers
- `src/composites/` — composite field type handlers (`udtspec.ts`, `udttype.ts`) used by forman, json, and validator
- `test/` — tests (`*.spec.ts`, `directives/*.spec.ts`, `composites/*.spec.ts`); fixtures in `test/mocks/`

<important if="you need to run commands to build, test, or lint">

| Command                 | What it does                                   |
| ----------------------- | ---------------------------------------------- |
| `npm run lint`          | runs `tsc` (TypeScript check, not eslint)      |
| `npm test`              | jest with `--runInBand --coverage --forceExit` |
| `npm run build`         | tsup → `dist/` (ESM + CJS + `.d.ts`/`.d.cts`)  |
| `npm run build:version` | syncs `package.json` version into `jsr.json`   |

</important>

## Domain Concepts

**Forman Schema** is Make's proprietary form field format. A schema is an array of `FormanSchemaField` objects. Each field has a `type` (one of ~40 types), optional `spec` (sub-fields for `collection`/`array`), `options` (select options or `rpc://` URL), `nested` (fields revealed by the value of a select or boolean), and `validate`.

**Domains** are named scopes (e.g. `default`, `additional`) used in multi-domain validation. Fields in one domain can reveal nested fields in another domain via `field.nested.domain`. The `x-domain-root` property on a `collection` field registers it as the anchor for cross-domain routing.

<important if="you are modifying toJSONSchema conversion or the forman.ts file">

**Public signatures:**

- `toJSONSchema(field, options?)` returns a bare `JSONSchema7` (backward-compatible). Delegates to `toJSONSchemaAdvanced` and returns `.schema`.
- `toJSONSchemaAdvanced(field, options?)` returns `{ schema: JSONSchema7, skippedPaths?: { advanced?: string[] } }`. `skippedPaths` is omitted entirely when nothing was skipped.

**Forman types → JSON Schema types** mapping is in `src/forman.ts` at `FORMAN_TYPE_MAP`. Notable: `collection→object`, `array→array`, `filter→array`, `checkbox→boolean`, `hidden/any→undefined`.

**There are TWO `FORMAN_TYPE_MAP` constants and they are NOT the same object** — `src/forman.ts` (converter) and `src/validator.ts` (validator). They have drifted: the validator's has `upload`, the converter's has `dynamicCollection`/`editor`, and several values differ (`json`, `list`/`radio`/`select`) because the validator uses `undefined` to mean "skip the type check", which is load-bearing for polymorphic selects. Adding a type means updating BOTH. `device` was missing from the converter map for exactly this reason while being present in the validator map, the type union, `API_ENDPOINTS`, and the converter's own dispatch switch — so its `case` was dead code and every `device:*` field hard-failed conversion.

**Type resolution** goes through `resolveFormanFieldType(rawType)` (`src/forman.ts`, exported): splits any `:kind` suffix, then exact → case-insensitive (index derived from `FORMAN_TYPE_MAP` keys, so it can't drift) → `FORMAN_TYPE_ALIASES`. Canonicalization MUST happen before `normalizeFormanFieldType`, whose `API_ENDPOINTS` lookup is keyed by lowercase type — otherwise `Device:ios` silently loses its `api://` store. Alias only information-preserving synonyms; anything needing a guess about intent degrades instead.

**Unresolvable types degrade, they do not throw** (default). `degradeUnconvertibleField` returns the permissive `any` shape and records the path on `context.skippedPaths.unconvertible`; `{ strictFieldTypes: true }` restores throwing. The old behaviour threw at the top of _every_ recursive call, so one bad leaf field aborted the entire schema — in production this made Maia conclude the user's module was broken and replace it. Note the validator has always been tolerant of unknown types (`if (expectedType && ...)` skips the check), so this aligns the two paths rather than loosening one. A field with **no** type is still a structured `validateForman` error — it used to crash with a raw `TypeError` from `normalizeFormanFieldType`.

Entry: `toJSONSchemaInternal(field, context)`. Dispatches by type to `handleCollectionType`, `handleArrayType`, `handleSelectOrPathType`, `handleFilterType`, `handlePrimitiveType`. `ConversionContext` carries `domain`, `path`, `tail`, `roots`, `addConditionalFields` callback (for select-with-nested → `allOf[if/then]` generation on parent collection), `excludeAdvancedFields` (default `false`), `strictFieldTypes` (default `false`), and `skippedPaths` (mutable accumulator, keyed by skip reason — `advanced` and `unconvertible` — shared across recursion via context spread). `SchemaConversionError` is also defined here.

**Advanced field tracking:** filter point is `handleCollectionType.addField`. Fields with `advanced: true` are **included by default** and stamped with `x-advanced: true` (enumerable, configurable, writable). When `excludeAdvancedFields: true` is passed, they're omitted from the schema and their paths accumulate in `context.skippedPaths.advanced`. Path segments are built via the `collectionPath` helper, which is `[...context.path, field.name]` when `field.name` is set, else `context.path` (this handles synthetic anonymous collection wrappers — array items, nested-by-option, RPC params, composite expansions — cleanly so `[]` array paths don't get a literal `"undefined"` segment). Composite types (`udtspec`, `udttype`) memoize via `context.definitions[type]`; advanced fields inside a composite are recorded once per `toJSONSchemaAdvanced` call, not per usage.
</important>

<important if="you are modifying toFormanSchema conversion or the json.ts file">

`toFormanSchema` switches on `field.type` (`object→collection`, `array→array|filter`, `string→text|select|file`, etc.). Checks non-enumerable properties to recover Forman-specific info (e.g. `x-filter` to distinguish `filter` from plain `array`).

**checkbox** has no round-trip fidelity: `checkbox → boolean` (toJSONSchema) but `boolean → boolean` (toFormanSchema), not back to `checkbox`.
</important>

<important if="you are modifying remote option resolution, rpc://, or api:// handling">

**rpc:// vs api://** — `rpc://` paths are passed verbatim to user-supplied `resolveRemote(path, data)`. `api://` paths (used for reference types like `account`, `hook`, etc.) are substituted from `API_ENDPOINTS` in `src/utils.ts` and are NOT passed to `resolveRemote`.

**tail** — as validation/conversion descends into nested select fields, the selected values accumulate in a `tail: { name, value }[]` array. This is appended as a query string (`?name={{value}}&...`) on `rpc://` URLs passed to `resolveRemote`, providing context for dependent remote calls.
</important>

<important if="you are modifying x-* round-trip markers or round-trip conversion">

**`x-*` round-trip markers** — Forman-specific metadata that JSON Schema doesn't have a native slot for is attached via `Object.defineProperty` on JSON Schema output objects: `x-filter`, `x-path`, `x-fetch`, `x-nested`, `x-search`, `x-advanced`, `x-composite`, `x-filestorage`, `x-json`. Most are declared `enumerable: true` (so they DO appear in `JSON.stringify` output and are part of the serialized schema); `x-filestorage` is the exception at `enumerable: false`. `defineProperty` is used (rather than plain assignment) to keep these out of the structural TypeScript shape of `JSONSchema7` and to keep them isolated from spec-compliant property handling. `toFormanSchema` reads them back via `Object.getOwnPropertyDescriptor`. For `x-advanced`, recovery happens in the top-level `toFormanSchema` wrapper (after delegating to `toFormanSchemaInternal`) so all branches — including composite short-circuits — inherit it uniformly.

**`json` type** — a `json` field carrying an explicit `schema` (a `JSONSchema7`) echoes that schema verbatim (`handleJsonType` in `forman.ts`), letting complex schema parts be authored directly in JSON Schema and mixed with primitive Forman fields. The schema is shallow-cloned (caller input never mutated); `label`/`help` fill `title`/`description` only when the echoed schema omits them. An enumerable `x-json: true` marker (stripped from the recovered `schema`) lets `toFormanSchemaInternal` short-circuit back to `{ type: 'json', schema }`, and survives JSON serialization. A `json` field **without** a `schema` returns the pre-built `result` as-is — `{ type: 'object' }` (the `FORMAN_TYPE_MAP` entry) plus any `title`/`description` — so it round-trips to `dynamicCollection` (empty object → dynamic collection).
</important>

<important if="you are modifying validation logic or the validator.ts file">

`validateFormanWithDomainsInternal` is the core; it builds a `roots` map per domain then calls `validateFormanValue` recursively. Handlers: `handleCollectionType`, `handleArrayType`, `handleSelectType`, `handleFilterType`, `handlePathType`, `handlePrimitiveType`, `handleNestedFields`, `handleBooleanNestedFields`. `resolveRemote` is wrapped into a closure that merges `context.tail` into the `data` argument.

`validateForman` always wraps to a single `default` domain. Result type: `{ valid, errors[], warnings[], states?, schemas?, resolvedSchemas?, normalizedValues, appliedDefaults }` (`FormanNormalizedValidationResult`; `normalizedValues`/`appliedDefaults` are always present on entry-point results — without fills they echo the input values / an empty list). `warnings` do not affect `valid`. `states` populated only when `options.states === true` AND no errors. `schemas` populated only when `options.schemas === true` AND no errors — returns resolved field definitions per domain. `resolvedSchemas` is the same data as `schemas` but present on the failure path too, so a rejection can name remote-resolved fields the caller never saw.

**Default filling** (`options.fillDefaults: 'requiredOnly' | 'always'`, off by default; contract in the `FormanValidationOptions` JSDoc): the substitution happens just before the mandatory check in `validateFormanValue` — an `undefined` or `''` value with a non-`null`/`''` default fills (BlueprintValidator's `useDefaults` predicate and modes; explicit `null` stays a provided value). `'requiredOnly'` fills required fields only; `'always'` fills omitted optional fields too. The filled value flows through the rest of the walk and defaults under an armed nested branch fill recursively, `rpc://`-resolved specs included. Nothing fills under `suppressRequired` (inactive branches). Fills are recorded per domain root (`DomainRoot.appliedDefaults`, raw path segments); the result exposes `appliedDefaults` (dot-joined paths, matching error paths) and `normalizedValues`, built with `setValueAtPath` (`src/utils.ts`, copy-on-write along the path; inputs never mutated). Both are present on success and failure, since a filled default can arm requirements the caller still has to repair.

Per-domain inputs accept `restoreExtras` (extra values injected into restore states, keyed by dot-notation path) and `allowDynamicValues` (when true, IML expressions and unresolved RPC select options produce warnings instead of errors; default false). `allowDynamicValues` can also be set globally via `FormanValidationOptions`.

**Boolean nested** is conditioned on the toggle value, matching how imt-forman renders it (`docs/inputs/boolean.md`). Single-branch `nested` (spec array or `rpc://` string) applies when the value is `true`, or `false` if `reversedNested: true`; the two-branch object form `{ true?, false? }` applies whichever branch matches. An inactive single-branch is still walked, under `context.suppressRequired`, which disables only the `"Field is mandatory."` check — provided values stay type-checked, `validate` rules still apply, and the fields stay registered for strict mode, so stale values of hidden fields do not become `Unknown field`. `suppressRequired` is transitive: it propagates to the whole subtree, so a toggle that is on inside an inactive parent keeps its own nested fields unenforced. That is intended — nothing under a hidden branch is renderable, so nothing there can be filled in. An inactive two-branch branch is not validated, since both branches may reuse a name for different types; it is walked under `context.registerOnly`, which registers its names for strict mode and does nothing else. Every other type keeps unconditional `handleNestedFields`.

**Strict mode** (`options.strict`): checks `values` keys against `seen` set. Unknown keys produce `"Unknown field '${key}'"` errors.

**Filter validation** synthesizes an inline `collection` spec with fields `a` (operand), `o` (operator), `b` (optional), then delegates to `handleArrayType`. `field.logic === 'and'|'or'` → flat array; otherwise → array-of-arrays.

**Path/file/folder validation** (`handlePathType`) resolves options level-by-level via `resolveRemote` per path segment.

**JSON validation** (`handleJsonType`) — a `json` field with a `schema` is validated by the optional `validateJson(schema, value)` callback (`FormanValidationOptions`/`ValidationContext`, awaitable), which returns a `FormanExternalValidationResult` fragment (`{ valid, errors?, warnings? }` — a generic external-validator verdict, reusable for future callback-based validation). Its messages are stamped with the current domain/path and spliced into the result; the `valid: false` flag is honored even with no messages (a generic error is synthesized) so failures can't be swallowed. Runs after the required/empty checks; IML expression detection runs before the json dispatch, so IML values exit validation before `validateJson` is invoked (they cannot be schema-validated). Without a callback, the value passes (schema unenforced).
</important>

<important if="you are writing or modifying tests">

- Always import `describe`, `expect`, `it` explicitly from `@jest/globals`
- Source imports use `.js` extension on `.ts` files: `import { ... } from '../src/index.js'`
- `resolveRemote` is inlined per-test as a callback (no shared test utilities)
- Fixtures loaded with `readFileSync('./test/mocks/forman.json')`
- Shared schema defined at `describe` scope, used across multiple `it` blocks
  </important>

<important if="you are modifying TypeScript config or adding new files">

- `module: "Preserve"` — TypeScript preserves import/export style as-written
- `noEmit: true` — tsc is lint-only; tsup handles actual compilation
- `noUncheckedIndexedAccess: true` — array/record access may return `T | undefined`
- `isolatedModules: true` — use `import type` for type-only imports
  </important>

## Keeping AGENTS.md current

When your changes alter anything described in this file — project map, domain concepts, architectural patterns, validation flow, or test patterns — notify the user that AGENTS.md should be updated and suggest the specific edit.
