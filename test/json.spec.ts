import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import {
    toJSONSchema,
    toFormanSchema,
    validateForman,
    type FormanSchemaField,
    type FormanExternalValidationResult,
} from '../src/index.js';

describe('json type', () => {
    const personSchema: JSONSchema7 = {
        type: 'object',
        properties: {
            name: { type: 'string' },
            age: { type: 'number' },
        },
        required: ['name'],
    };

    describe('toJSONSchema', () => {
        it('echoes the schema of a solo json field verbatim', () => {
            const field: FormanSchemaField = {
                name: 'input',
                type: 'json',
                schema: personSchema,
            };

            const jsonSchema = toJSONSchema(field);

            expect(jsonSchema).toEqual({ ...personSchema, 'x-json': true });
            // The caller's schema object must not be mutated.
            expect(jsonSchema).not.toBe(personSchema);
            expect(personSchema).not.toHaveProperty('x-json');
        });

        it('mixes a json field with primitive forman fields in a collection', () => {
            const field: FormanSchemaField = {
                type: 'collection',
                spec: [
                    { name: 'title', type: 'text', help: 'A plain text field' },
                    { name: 'enabled', type: 'boolean' },
                    { name: 'input', type: 'json', schema: personSchema },
                ],
            };

            const jsonSchema = toJSONSchema(field);

            expect(jsonSchema).toEqual({
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'A plain text field' },
                    enabled: { type: 'boolean' },
                    input: { ...personSchema, 'x-json': true },
                },
                required: [],
            });
        });

        it('fills title/description from label/help only when the schema omits them', () => {
            const filled = toJSONSchema({
                name: 'input',
                type: 'json',
                label: 'Payload',
                help: 'The request payload',
                schema: { type: 'object' },
            });
            expect(filled).toEqual({
                type: 'object',
                title: 'Payload',
                description: 'The request payload',
                'x-json': true,
            });

            // An explicit schema.title wins over the forman label (pure echo).
            const explicit = toJSONSchema({
                name: 'input',
                type: 'json',
                label: 'Payload',
                schema: { type: 'object', title: 'Keep me' },
            });
            expect(explicit.title).toBe('Keep me');
        });

        it('does not inject a type into a typeless schema (oneOf/$ref/enum)', () => {
            const typeless: JSONSchema7 = { oneOf: [{ const: 'a' }, { const: 'b' }] };
            const jsonSchema = toJSONSchema({ name: 'input', type: 'json', label: 'Choice', schema: typeless });

            expect(jsonSchema).toEqual({ oneOf: [{ const: 'a' }, { const: 'b' }], title: 'Choice', 'x-json': true });
            expect(jsonSchema).not.toHaveProperty('type');
        });

        it('renders a plain object schema for a json field without a schema', () => {
            const jsonSchema = toJSONSchema({ name: 'input', type: 'json', help: 'description' });
            expect(jsonSchema).toEqual({ type: 'object', description: 'description' });
        });
    });

    describe('round-trip', () => {
        it('recovers the json type and schema through toFormanSchema', () => {
            const original: FormanSchemaField = { name: 'input', type: 'json', schema: personSchema };
            const jsonSchema = toJSONSchema(original);
            const roundtripped = toFormanSchema(jsonSchema);

            expect(roundtripped).toEqual({ type: 'json', schema: personSchema });
        });

        it('survives JSON serialization (enumerable marker)', () => {
            const original: FormanSchemaField = { name: 'input', type: 'json', schema: personSchema };
            const serialized = JSON.parse(JSON.stringify(toJSONSchema(original))) as JSONSchema7;
            const roundtripped = toFormanSchema(serialized);

            expect(roundtripped).toEqual({ type: 'json', schema: personSchema });
        });

        it('recovers the advanced flag on the field', () => {
            const jsonSchema = toJSONSchema({
                type: 'collection',
                spec: [{ name: 'input', type: 'json', advanced: true, schema: personSchema }],
            });
            const inputSchema = (jsonSchema.properties as Record<string, JSONSchema7>).input!;
            const roundtripped = toFormanSchema(inputSchema);

            expect(roundtripped).toEqual({
                type: 'json',
                advanced: true,
                schema: { ...personSchema, 'x-advanced': true },
            });
        });
    });

    describe('validateForman', () => {
        const schema: FormanSchemaField[] = [{ name: 'input', type: 'json', schema: personSchema }];

        it('passes when the callback returns valid', async () => {
            const validateJson = async (
                received: JSONSchema7,
                value: unknown,
            ): Promise<FormanExternalValidationResult> => {
                expect(received).toEqual(personSchema);
                expect(value).toEqual({ name: 'Alice', age: 30 });
                return { valid: true };
            };

            const result = await validateForman({ input: { name: 'Alice', age: 30 } }, schema, { validateJson });

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('splices callback errors into the result with domain and path', async () => {
            const validateJson = (): FormanExternalValidationResult => ({
                valid: false,
                errors: ['name is required', 'age must be a number'],
            });

            const result = await validateForman({ input: { age: 'oops' } }, schema, { validateJson });

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                { domain: 'default', path: 'input', message: 'name is required' },
                { domain: 'default', path: 'input', message: 'age must be a number' },
            ]);
        });

        it('collects callback warnings without affecting validity', async () => {
            const validateJson = (): FormanExternalValidationResult => ({
                valid: true,
                warnings: ['age is deprecated'],
            });

            const result = await validateForman({ input: { name: 'Bob' } }, schema, { validateJson });

            expect(result.valid).toBe(true);
            expect(result.warnings).toEqual([{ domain: 'default', path: 'input', message: 'age is deprecated' }]);
        });

        it('synthesizes an error when the callback reports invalid without messages', async () => {
            const validateJson = (): FormanExternalValidationResult => ({ valid: false });

            const result = await validateForman({ input: {} }, schema, { validateJson });

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                { domain: 'default', path: 'input', message: 'JSON value failed schema validation.' },
            ]);
        });

        it('converts a throwing callback into a validation error', async () => {
            const validateJson = (): never => {
                throw new Error('validator crashed');
            };

            const result = await validateForman({ input: { name: 'Alice' } }, schema, { validateJson });

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                { domain: 'default', path: 'input', message: 'validator crashed' },
            ]);
        });

        it('passes without a callback (schema cannot be enforced)', async () => {
            const result = await validateForman({ input: { anything: true } }, schema);
            expect(result.valid).toBe(true);
        });

        it('accepts any JSON value (object/array/string) — json is not constrained to string', async () => {
            // A json field with no schema and no callback must not reject non-string values -- the type is freeform JSON then.
            const freeform: FormanSchemaField[] = [{ name: 'input', type: 'json' }];

            for (const value of [{ a: 1 }, [1, 2, 3], 'plain string', 42, true]) {
                const result = await validateForman({ input: value }, freeform);
                expect(result.valid).toBe(true);
            }
        });

        it('errors on a missing required json field before invoking the callback', async () => {
            let called = false;
            const validateJson = (): FormanExternalValidationResult => {
                called = true;
                return { valid: true };
            };
            const requiredSchema: FormanSchemaField[] = [
                { name: 'input', type: 'json', required: true, schema: personSchema },
            ];

            const result = await validateForman({}, requiredSchema, { validateJson });

            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([{ domain: 'default', path: 'input', message: 'Field is mandatory.' }]);
            expect(called).toBe(false);
        });
    });
});
