# make-forman-schema

TypeScript library for converting and validating **Forman Schema** (Make's internal form field DSL) to/from JSON Schema 7, with async validation supporting remote option resolution.

**Tech:** TypeScript, Jest+ts-jest, tsup (dual ESM+CJS output). No runtime dependencies — devDependencies only.

## Key Commands

- `npm run lint` — runs `tsc` (TypeScript check, not eslint)
- `npm test` — jest with `--runInBand --coverage --forceExit`
- `npm run build` — tsup → `dist/` (ESM + CJS + `.d.ts`/`.d.cts`)
- `npm run build:version` — syncs `package.json` version into `jsr.json`

## Domain Concepts

**Forman Schema** is Make's proprietary form field format. A schema is an array of `FormanSchemaField` objects. Each field has a `type` (one of ~40 types), optional `spec` (sub-fields for `collection`/`array`), `options` (select options or `rpc://` URL), `nested` (fields revealed when a select option is chosen), and `validate`.

**Forman types → JSON Schema types** mapping is in `src/forman.ts` at `FORMAN_TYPE_MAP`. Notable: `collection→object`, `array→array`, `filter→array`, `checkbox→boolean`, `hidden/any→undefined`.

**Domains** are named scopes (e.g. `default`, `additional`) used in multi-domain validation. Fields in one domain can reveal nested fields in another domain via `field.nested.domain`. The `x-domain-root` property on a `collection` field registers it as the anchor for cross-domain routing.

**rpc:// vs api://** — `rpc://` paths are passed verbatim to user-supplied `resolveRemote(path, data)`. `api://` paths (used for reference types like `account`, `hook`, etc.) are substituted from `API_ENDPOINTS` in `src/utils.ts` and are NOT passed to `resolveRemote`.

**Non-enumerable properties** — round-trip information that doesn't survive `JSON.stringify` is attached via `Object.defineProperty` on JSON Schema output objects: `x-filter` (marks filter arrays), `x-path` (file/folder metadata), `x-fetch` (remote options URL), `x-nested` (nested directive), `x-search` (RPC button). `toFormanSchema` checks these via `Object.getOwnPropertyDescriptor`.

**checkbox** has no round-trip fidelity: `checkbox → boolean` (toJSONSchema) but `boolean → boolean` (toFormanSchema), not back to `checkbox`.

**tail** — as validation/conversion descends into nested select fields, the selected values accumulate in a `tail: { name, value }[]` array. This is appended as a query string (`?name={{value}}&...`) on `rpc://` URLs passed to `resolveRemote`, providing context for dependent remote calls.

## Architecture

Source in `src/` (6 files), tests in `test/`, build artifacts in `dist/`.

**`src/index.ts`** — public API: re-exports `toJSONSchema`, `toFormanSchema`, `validateForman`, `validateFormanWithDomains`, and all types.

**`src/types.ts`** — all type definitions. Key types: `FormanSchemaField`, `FormanSchemaFieldType` (union of ~40 literals + template literals for prefixed types like `account:${string}`), `FormanSchemaExtendedOptions` (`store` + `nested` + `operators`), `FormanSchemaNested` / `FormanSchemaExtendedNested`, `FormanValidationResult` (`{ valid, errors[], states? }`), `FormanValidationOptions`.

**`src/forman.ts`** — `toJSONSchema`. Entry: `toJSONSchemaInternal(field, context)`. Dispatches by type to `handleCollectionType`, `handleArrayType`, `handleSelectOrPathType`, `handleFilterType`, `handlePrimitiveType`. `ConversionContext` carries `domain`, `path`, `tail`, `roots`, and `addConditionalFields` callback (for select-with-nested → `allOf[if/then]` generation on parent collection). `SchemaConversionError` is also defined here.

**`src/json.ts`** — `toFormanSchema`. Switches on `field.type` (`object→collection`, `array→array|filter`, `string→text|select|file`, etc.). Checks non-enumerable properties to recover Forman-specific info (e.g. `x-filter` to distinguish `filter` from plain `array`).

**`src/validator.ts`** — full validation. `validateFormanWithDomainsInternal` is the core; it builds a `roots` map per domain then calls `validateFormanValue` recursively. Handlers: `handleCollectionType`, `handleArrayType`, `handleSelectType`, `handleFilterType`, `handlePathType`, `handlePrimitiveType`, `handleNestedFields`. `resolveRemote` is wrapped into a closure that merges `context.tail` into the `data` argument before calling the user-supplied resolver.

**`src/utils.ts`** — shared helpers. Key exports: `noEmpty`, `isObject`, `isVisualType`, `isReferenceType`, `normalizeFormanFieldType` (expands prefixed types, injects `api://` URLs), `findValueInSelectOptions` (handles grouped/flat options), `containsIMLExpression`, `isPrimitiveIMLExpression`, `buildRestoreStructure`, `IML_FILTER_OPERATORS`, `IML_BINARY_FILTER_OPERATORS`, `IML_UNARY_FILTER_OPERATORS`, `API_ENDPOINTS`.

## Validation Flow

```
validateForman(values, schema, options)
  → validateFormanWithDomains({ default: { values, schema } }, options)
    → validateFormanWithDomainsInternal
        builds DomainRoot per domain
        for each domain → validateFormanValue(values, { type:'collection', spec:schema }, context)
          normalizeFormanFieldType → required/null checks → type check → IML expression check
          → handleCollectionType | handleArrayType | handleSelectType | handleFilterType
            | handlePathType | handlePrimitiveType
```

`validateForman` always wraps to a single `default` domain. `states` is only populated in result when `options.states === true` AND there are no errors.

**Strict mode** (`options.strict`): after processing all schema fields, checks `values` keys against `seen` set. Unknown keys produce `"Unknown field '${key}'"` errors.

**Filter validation** synthesizes an inline `collection` spec with fields `a` (operand), `o` (operator), `b` (optional), then delegates to `handleArrayType`. `field.logic === 'and'|'or'` → flat array; otherwise → array-of-arrays.

**Path/file/folder validation** (`handlePathType`) resolves options level-by-level via `resolveRemote` per path segment.

## Testing Patterns

Tests in `test/*.spec.ts` and `test/directives/*.spec.ts`. JSON fixtures in `test/mocks/`.

- Always import `describe`, `expect`, `it` explicitly from `@jest/globals`
- Source imports use `.js` extension on `.ts` files: `import { ... } from '../src/index.js'`
- `resolveRemote` is inlined per-test as a callback (no shared test utilities)
- Fixtures loaded with `readFileSync('./test/mocks/forman.json')`
- Shared schema defined at `describe` scope, used across multiple `it` blocks

## TypeScript Notes

- `module: "Preserve"` — TypeScript preserves the import/export style as-written
- `noEmit: true` — tsc is lint-only; tsup handles actual compilation
- `noUncheckedIndexedAccess: true` — array/record access may return `T | undefined`; handle accordingly
- `isolatedModules: true` — each file must be independently compilable; use `import type` for type-only imports

## When in Plan Mode
- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- Interview user in detail (for Claude: use the AskUserQuestionTool) about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. Be very in-depth and continue interviewing the user continually until it's complete. Use the answers to create a detailed spec.
- Make assumptions explicit: When you must proceed under uncertainty, list assumptions up front and continue.
