# Forman Schema

A utility for converting between Forman Schema and JSON Schema.

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
