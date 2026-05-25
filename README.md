# Forman Schema

Conversion and validation utilities for Forman Schema.

## Breaking changes

### Next major version

- `toJSONSchema(field, options?)` now returns `{ schema: JSONSchema7, skippedPaths?: { advanced?: string[] } }` instead of a bare `JSONSchema7`. Callers must destructure `{ schema }`.
- Fields with `advanced: true` are **skipped by default**. To restore previous behavior, pass `{ includeAdvancedFields: true }`. Skipped field paths are reported in `skippedPaths.advanced` (dot-notation, e.g. `wrapper.field`, `wrapper.arr[].nested`).
- Included advanced fields gain an `x-advanced: true` marker on the JSON Schema and round-trip through `toFormanSchema` (restoring `advanced: true` on the Forman field).

Migration:

```diff
- const jsonSchema = toJSONSchema(formanField);
+ const { schema: jsonSchema } = toJSONSchema(formanField, { includeAdvancedFields: true });
```

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

const { schema, skippedPaths } = toJSONSchema(formanField);
```

`toJSONSchema` returns `{ schema, skippedPaths? }`. **Sub-fields of a collection** (the common case — fields living inside a `collection` `spec`, including nested-by-option fields, array-of-collection items, composite expansions, and cross-domain buffered fields) marked `advanced: true` are skipped by default; their dot-notation paths are reported in `skippedPaths.advanced` so the caller can re-request them on demand. To include them inline, pass `{ includeAdvancedFields: true }` — included advanced fields are stamped with `x-advanced: true` on the JSON Schema and round-trip correctly through `toFormanSchema`.

The filter does **not** apply to: the top-level field passed to `toJSONSchema` (it's always converted), or the item type of an array whose `spec` is a single primitive field (there's no sibling context). To hide an entire array or any other top-level structure, mark the *parent* field as `advanced: true`.

```typescript
const { schema } = toJSONSchema(formanField, { includeAdvancedFields: true });
```

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

### Validation

Validate Forman values against a Forman Schema. Two entry points are available:

- `validateForman(values, schema, options?)` — validate without domains.
- `validateFormanWithDomains(domains, options?)` — validate multiple domains at once.

Both return `{ valid: boolean, errors: { path: string, message: string }[] }`.

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
- json → string
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

## Error Handling

### SchemaConversionError

`SchemaConversionError` is thrown when schema conversion fails. It includes a message and optionally the field that caused the error.

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
