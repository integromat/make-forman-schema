# Forman Schema

Conversion and validation utilities for Forman Schema.

## v2.0.1 (patch): inactive branches stay out of `schemas`

The fields nested under a boolean toggle that is `false` (or absent and filled to `false` by
`fillDefaults`) are no longer reported in `schemas` / `resolvedSchemas`. They were listed flat with
`required: true`, so a consumer persisting that list as the resolved form would later demand a field
the form never showed. Validation outcomes are unchanged. Also in this release: an RPC-backed option
list that cannot see a reference value now warns instead of failing (#66).

## v2.0.0 — validated values on every result

`validateForman` and `validateFormanWithDomains` now always return `normalizedValues` and
`appliedDefaults`. Nothing was removed or renamed and `valid`/`errors`/`warnings` are unaffected,
but a caller that deep-compares the whole result, or forwards it into a fixed-shape response, will
see two new keys — assert on the fields you care about, or drop the keys before forwarding.

Also new: `fillDefaults: 'always'`. See [Filling defaults](#filling-defaults).

## v1.14.0 — advanced field tracking

Non-breaking minor release. New surface for working with `advanced: true` Forman fields:

- `toJSONSchema(field, options?)` still returns a bare `JSONSchema7` — fully backward-compatible.
- Fields marked `advanced: true` are now stamped with `x-advanced: true` on the JSON Schema output, and round-trip through `toFormanSchema` (which restores `advanced: true`).
- New option `excludeAdvancedFields?: boolean` (default `false`). When `true`, advanced sub-fields of a collection are omitted from the schema.
- New function `toJSONSchemaAdvanced(field, options?)` returns `{ schema: JSONSchema7, skippedPaths?: { advanced?: string[] } }`. Use it to learn which advanced fields were dropped (e.g. to render a "show advanced" toggle). `toJSONSchema` delegates to it internally and returns just `.schema`.

## Installation

```bash
npm install @makehq/forman-schema
```

## Usage

### Converting from Forman Schema to JSON Schema

```typescript
import { toJSONSchema } from '@makehq/forman-schema';

const formanField = {
    type: 'collection',
    spec: [
        {
            name: 'name',
            type: 'text',
            required: true,
        },
        {
            name: 'age',
            type: 'number',
        },
    ],
};

const jsonSchema = toJSONSchema(formanField);
```

Advanced fields (`advanced: true`) are included by default and stamped with `x-advanced: true`. To omit them from the rendered schema, pass `{ excludeAdvancedFields: true }`:

```typescript
const jsonSchema = toJSONSchema(formanField, { excludeAdvancedFields: true });
```

If you also need to know **which** advanced fields were dropped (e.g. to render a "show advanced" toggle), use `toJSONSchemaAdvanced`:

```typescript
import { toJSONSchemaAdvanced } from '@makehq/forman-schema';

const { schema, skippedPaths } = toJSONSchemaAdvanced(formanField, { excludeAdvancedFields: true });
// skippedPaths?.advanced is an array of dot-notation paths like ['wrapper.field', 'wrapper.arr[].nested']
```

The filter applies to **sub-fields of a collection** — including nested-by-option fields, array-of-collection items, composite expansions (`udtspec`, `udttype`), and cross-domain buffered fields. It does **not** apply to: the top-level field passed in (always converted), or the item type of an array whose `spec` is a single primitive field. To hide an entire array or any other top-level structure, mark the _parent_ field as `advanced: true`.

### Converting from JSON Schema to Forman Schema

```typescript
import { toFormanSchema } from '@makehq/forman-schema';

const jsonSchemaField = {
    type: 'object',
    properties: {
        name: {
            type: 'string',
        },
        age: {
            type: 'number',
        },
    },
    required: ['name'],
};

const formanSchema = toFormanSchema(jsonSchemaField);
```

### JSON fields (`type: 'json'`)

A `json` field can carry an explicit `schema` (a JSON Schema). This lets you author complex parts of a form directly in JSON Schema and mix them with primitive Forman fields:

```typescript
const formanField = {
    type: 'collection',
    spec: [
        { name: 'title', type: 'text' },
        {
            name: 'input',
            type: 'json',
            schema: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            },
        },
    ],
};
```

On conversion, the `schema` is **echoed verbatim** into the JSON Schema output (the field's `label`/`help` fill in `title`/`description` only when the schema omits them). An enumerable `x-json` marker is added so `toFormanSchema` can recover the `json` type; it survives JSON serialization. A `json` field **without** a `schema` renders as a plain object schema (`{ type: 'object' }`), since a JSON value is most naturally an object.

#### External validators

The library cannot validate a JSON value against an arbitrary JSON Schema on its own — it has **no JSON Schema validator built in**. Validation of `json` fields is therefore opt-in: **a `json` value is not validated unless you provide a `validateJson` callback.** Without it, the value passes through untouched.

This is the first of a general **external validator** concept: a callback that performs validation the library can't, and returns a `FormanExternalValidationResult` verdict (`{ valid, errors?, warnings? }`) that is spliced into the overall result. The callback may be async (awaited), and its `errors`/`warnings` are stamped with the field's domain and path automatically. A `valid: false` verdict always fails validation, even when it carries no messages.

```typescript
import { validateForman, type FormanExternalValidationResult } from '@makehq/forman-schema';
import Ajv from 'ajv'; // any JSON Schema validator works

const ajv = new Ajv({ allErrors: true });

const result = await validateForman({ input: { name: 'Alice', age: 30 } }, schema, {
    async validateJson(schema, value): Promise<FormanExternalValidationResult> {
        const validate = ajv.compile(schema);
        if (validate(value)) return { valid: true };
        return {
            valid: false,
            errors: (validate.errors ?? []).map(e => `${e.instancePath} ${e.message}`),
        };
    },
});
```

### Validation

Validate Forman values against a Forman Schema. Two entry points are available:

- `validateForman(values, schema, options?)` — validate without domains.
- `validateFormanWithDomains(domains, options?)` — validate multiple domains at once.

Both return `{ valid: boolean, errors: { path: string, message: string }[] }`, plus
`normalizedValues` (the input values per domain, with any filled defaults applied — see
[Filling defaults](#filling-defaults)) and `appliedDefaults` (what was filled, empty when
nothing was). The two are always present, so the consuming pattern is the same whether or
not default filling is enabled:

```typescript
const { valid, errors, normalizedValues } = await validateForman(values, schema);
if (valid) persist(normalizedValues.default);
```

#### Basic validation

```typescript
import { validateForman } from '@makehq/forman-schema';

const values = { array: [1, 2, 3], text: 'hello' };
const schema = [
    { name: 'array', type: 'array', spec: { type: 'number' } },
    { name: 'text', type: 'text' },
];

const result = await validateForman(values, schema);
// { valid: true, errors: [] }
```

#### Strict mode (unknown fields)

```typescript
const values = { text: 15, unknown: true };
const schema = [
    {
        name: 'text',
        type: 'text',
    },
];

const result = await validateForman(values, schema, { strict: true });
// {
//   valid: false,
//   errors: [
//     { path: 'default.text', message: "Expected type 'string', got type 'number'" },
//     { path: 'default', message: "Unknown field 'unknown'" }
//   ]
// }
```

#### Select with nested fields

```typescript
const values = { sheet: 'sheet 1', row: 1 };
const schema = [
    {
        name: 'sheet',
        type: 'select',
        options: [
            { value: 'sheet 1', nested: [{ name: 'row', type: 'number', required: true }] },
            { value: 'sheet 2' },
        ],
    },
];

const result = await validateForman(values, schema);
```

#### Remote options and nested stores

You can resolve options or nested field stores by providing `resolveRemote(path, data)`.

```typescript
const values = { sheet: 'sheet 1', column: 'A1' };
const schema = [
    {
        name: 'sheet',
        type: 'select',
        options: {
            store: 'rpc://sheets',
            nested: [{ name: 'column', type: 'select', options: 'rpc://columns' }],
        },
    },
];

const result = await validateForman(values, schema, {
    async resolveRemote(path, data) {
        if (path === 'rpc://sheets') return [{ value: 'sheet 1' }, { value: 'sheet 2' }];
        if (path === 'rpc://columns') return [{ value: 'A1' }, { value: 'B1' }];
        throw new Error('Unknown resource');
    },
});
```

#### Filling defaults

With `fillDefaults: 'requiredOnly'`, an omitted required field whose schema declares a usable
default (`null` and `''` cannot satisfy a required check) validates as that default instead of
failing as mandatory. With `fillDefaults: 'always'`, omitted optional fields with usable defaults
are filled too — the same modes as the platform's BlueprintValidator `useDefaults` option. The
filled value participates in the rest of the walk, so a filled boolean conditions its nested branch
exactly as a provided one would, and defaults under an armed branch fill recursively — including
fields injected by `rpc://`-resolved specs. Fills land in `normalizedValues` (the values with fills
applied; the input is never mutated, though subtrees nothing was written into are shared with it)
and are itemized in `appliedDefaults`, on the failure path too, so remaining errors can be repaired
on top of the filled values. Values you provide are never overwritten, **except `''`, which counts as
an omission and fills** — matching blueprint validation and the builder UI. Under `'always'` that
means an optional field you deliberately cleared comes back with its default; pass `'requiredOnly'`
if you need a cleared optional field left alone. An explicit `null` is a provided value: it never
fills and still fails as mandatory. Inactive nested branches are never filled.

```typescript
const schema = [
    {
        name: 'fallbackEnabled',
        type: 'boolean',
        required: true,
        default: false,
        nested: [{ name: 'fallbackConnectionId', type: 'text', required: true }],
    },
];

const result = await validateForman({}, schema, { fillDefaults: 'requiredOnly' });
// {
//   valid: true,
//   errors: [],
//   normalizedValues: { default: { fallbackEnabled: false } },
//   appliedDefaults: [{ domain: 'default', path: 'fallbackEnabled', value: false }]
// }
```

#### Multi-domain validation

Use `validateFormanWithDomains` to validate cross-domain schemas (e.g., `default` and `additional`).

```typescript
import { validateFormanWithDomains } from '@makehq/forman-schema';

const result = await validateFormanWithDomains(
    {
        default: {
            values: { ... },
            schema: defaultSchema
        },
        additional: {
            values: { ... },
            schema: additionalSchema
        },
    },
    {
        async resolveRemote(path, data) {
            // resolve API-backed options/nested fields here
        },
    },
);
```

## Supported Types

### Forman Schema Types

- account → number
- aiagent → string
- array → array
- buffer → string
- cert → string
- collection → object
- color → string
- datastore → number
- date → string
- email → string
- file → string
- filename → string
- filestorage → array (of UUID strings)
- filter → array
- folder → string
- hidden → string
- hook → number
- integer → number
- json → object (or its `schema` echoed verbatim when provided — see [JSON fields](#json-fields-type-json))
- keychain → number
- number → number
- path → string
- pkey → string
- port → number
- scenario → string
- select → string with enum
- text → string
- time → string
- timestamp → string
- timezone → string
- uinteger → number
- url → string
- uuid → string

### JSON Schema Types

- string → text
- number → number
- boolean → boolean
- object → collection
- array → array

## Field type resolution

Field types resolve through three steps, so schemas authored with loose casing or common synonyms
still convert:

1. **Exact match** against `FORMAN_TYPE_MAP`.
2. **Case-insensitive match** — `fileName`, `Boolean`, `URL`, `Select` resolve to their canonical
   lowercase types. The index is derived from the map itself, so new entries get this for free.
3. **Aliases** — `string→text`, `bool→boolean`, `datetime→date`, `float→number`,
   `upload→filestorage`. Only unambiguous, information-preserving synonyms are aliased.

A `type:kind` suffix (`account:google`, `device:apn`) resolves on its base type and keeps the kind,
which drives the `api://` store expansion.

### Unconvertible fields

A field whose type is **missing or unresolvable** is degraded to a permissive typeless schema (the
same shape `any` produces) instead of aborting the conversion, and its dot-notation path is reported
on `toJSONSchemaAdvanced`'s `skippedPaths.unconvertible`:

```js
const { schema, skippedPaths } = toJSONSchemaAdvanced({
    name: 'wrapper',
    type: 'collection',
    spec: [
        { name: 'good', type: 'text' },
        { name: 'odd', type: 'somethingNew' },
    ],
});
// schema.properties → { good: { type: 'string' }, odd: {} }
// skippedPaths      → { unconvertible: ['wrapper.odd (unknown type: somethingNew)'] }
```

This is deliberate: the throw was fatal at any depth, so a single unrecognized leaf field destroyed
the whole schema and left consumers with nothing. Types requiring a guess about intent (`tags`,
`category`, `object`) are degraded rather than aliased — a degraded field is honest, a wrongly
aliased one is a lie the consumer will act on.

Pass `{ strictFieldTypes: true }` to restore fail-fast throwing.

## Error Handling

### SchemaConversionError

`SchemaConversionError` is thrown when schema conversion fails, and for unresolvable field types
only when `strictFieldTypes: true` is set. It carries a message and the `field` that caused the
error.

## Testing

To test the project:

```bash
npm test
```

## Building

To build the project:

```bash
npm run build        # Builds both ESM and CJS versions
```
