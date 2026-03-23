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

| Command | What it does |
|---|---|
| `npm run lint` | runs `tsc` (TypeScript check, not eslint) |
| `npm test` | jest with `--runInBand --coverage --forceExit` |
| `npm run build` | tsup → `dist/` (ESM + CJS + `.d.ts`/`.d.cts`) |
| `npm run build:version` | syncs `package.json` version into `jsr.json` |
</important>

## Domain Concepts

**Forman Schema** is Make's proprietary form field format. A schema is an array of `FormanSchemaField` objects. Each field has a `type` (one of ~40 types), optional `spec` (sub-fields for `collection`/`array`), `options` (select options or `rpc://` URL), `nested` (fields revealed when a select option is chosen), and `validate`.

**Domains** are named scopes (e.g. `default`, `additional`) used in multi-domain validation. Fields in one domain can reveal nested fields in another domain via `field.nested.domain`. The `x-domain-root` property on a `collection` field registers it as the anchor for cross-domain routing.

<important if="you are modifying toJSONSchema conversion or the forman.ts file">

**Forman types → JSON Schema types** mapping is in `src/forman.ts` at `FORMAN_TYPE_MAP`. Notable: `collection→object`, `array→array`, `filter→array`, `checkbox→boolean`, `hidden/any→undefined`.

Entry: `toJSONSchemaInternal(field, context)`. Dispatches by type to `handleCollectionType`, `handleArrayType`, `handleSelectOrPathType`, `handleFilterType`, `handlePrimitiveType`. `ConversionContext` carries `domain`, `path`, `tail`, `roots`, and `addConditionalFields` callback (for select-with-nested → `allOf[if/then]` generation on parent collection). `SchemaConversionError` is also defined here.
</important>

<important if="you are modifying toFormanSchema conversion or the json.ts file">

`toFormanSchema` switches on `field.type` (`object→collection`, `array→array|filter`, `string→text|select|file`, etc.). Checks non-enumerable properties to recover Forman-specific info (e.g. `x-filter` to distinguish `filter` from plain `array`).

**checkbox** has no round-trip fidelity: `checkbox → boolean` (toJSONSchema) but `boolean → boolean` (toFormanSchema), not back to `checkbox`.
</important>

<important if="you are modifying remote option resolution, rpc://, or api:// handling">

**rpc:// vs api://** — `rpc://` paths are passed verbatim to user-supplied `resolveRemote(path, data)`. `api://` paths (used for reference types like `account`, `hook`, etc.) are substituted from `API_ENDPOINTS` in `src/utils.ts` and are NOT passed to `resolveRemote`.

**tail** — as validation/conversion descends into nested select fields, the selected values accumulate in a `tail: { name, value }[]` array. This is appended as a query string (`?name={{value}}&...`) on `rpc://` URLs passed to `resolveRemote`, providing context for dependent remote calls.
</important>

<important if="you are modifying non-enumerable property handling or round-trip conversion">

**Non-enumerable properties** — round-trip information that doesn't survive `JSON.stringify` is attached via `Object.defineProperty` on JSON Schema output objects: `x-filter`, `x-path`, `x-fetch`, `x-nested`, `x-search`. `toFormanSchema` checks these via `Object.getOwnPropertyDescriptor`.
</important>

<important if="you are modifying validation logic or the validator.ts file">

`validateFormanWithDomainsInternal` is the core; it builds a `roots` map per domain then calls `validateFormanValue` recursively. Handlers: `handleCollectionType`, `handleArrayType`, `handleSelectType`, `handleFilterType`, `handlePathType`, `handlePrimitiveType`, `handleNestedFields`. `resolveRemote` is wrapped into a closure that merges `context.tail` into the `data` argument.

`validateForman` always wraps to a single `default` domain. Result type: `{ valid, errors[], warnings[], states?, schemas? }`. `warnings` do not affect `valid`. `states` populated only when `options.states === true` AND no errors. `schemas` populated only when `options.schemas === true` AND no errors — returns resolved field definitions per domain.

Per-domain inputs accept `restoreExtras` (extra values injected into restore states, keyed by dot-notation path) and `allowDynamicValues` (when true, IML expressions and unresolved RPC select options produce warnings instead of errors; default false). `allowDynamicValues` can also be set globally via `FormanValidationOptions`.

**Strict mode** (`options.strict`): checks `values` keys against `seen` set. Unknown keys produce `"Unknown field '${key}'"` errors.

**Filter validation** synthesizes an inline `collection` spec with fields `a` (operand), `o` (operator), `b` (optional), then delegates to `handleArrayType`. `field.logic === 'and'|'or'` → flat array; otherwise → array-of-arrays.

**Path/file/folder validation** (`handlePathType`) resolves options level-by-level via `resolveRemote` per path segment.
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
