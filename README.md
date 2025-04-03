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

- text → string
- number → number
- boolean → boolean
- date → string
- json → string
- select → string with enum
- collection → object
- array → array

### JSON Schema Types

- string → text
- number → number
- boolean → boolean
- object → collection
- array → array

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
