import { describe, expect, it } from '@jest/globals';
import { toFormanSchema, toJSONSchema, validateForman } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('Empty string option for non-required selects', () => {
    describe('Schema Generation', () => {
        it('should prepend empty string to oneOf for non-required select', () => {
            const formanSchema: FormanSchemaField = {
                type: 'collection',
                spec: [
                    {
                        name: 'color',
                        type: 'select',
                        label: 'Color',
                        options: [
                            { value: 'red', label: 'Red' },
                            { value: 'blue', label: 'Blue' },
                        ],
                    },
                ],
            };

            const jsonSchema = toJSONSchema(formanSchema);
            const colorField = jsonSchema.properties!['color'] as JSONSchema7;

            expect(colorField.oneOf).toEqual([
                { title: 'Empty', const: '' },
                { title: 'Red', const: 'red' },
                { title: 'Blue', const: 'blue' },
            ]);
            expect(colorField.default).toBe('');
            expect(colorField.description).toBe('Optional field, can be left empty.');
        });

        it('should prepend empty string to enum for non-required select without labels', () => {
            const formanSchema: FormanSchemaField = {
                type: 'collection',
                spec: [
                    {
                        name: 'size',
                        type: 'select',
                        options: [{ value: 'small' }, { value: 'large' }],
                    },
                ],
            };

            const jsonSchema = toJSONSchema(formanSchema);
            const sizeField = jsonSchema.properties!['size'] as JSONSchema7;

            expect(sizeField.enum).toEqual(['', 'small', 'large']);
            expect(sizeField.default).toBe('');
        });

        it('should NOT add empty option for required select', () => {
            const formanSchema: FormanSchemaField = {
                type: 'collection',
                spec: [
                    {
                        name: 'color',
                        type: 'select',
                        label: 'Color',
                        required: true,
                        options: [
                            { value: 'red', label: 'Red' },
                            { value: 'blue', label: 'Blue' },
                        ],
                    },
                ],
            };

            const jsonSchema = toJSONSchema(formanSchema);
            const colorField = jsonSchema.properties!['color'] as JSONSchema7;

            expect(colorField.oneOf).toEqual([
                { title: 'Red', const: 'red' },
                { title: 'Blue', const: 'blue' },
            ]);
            expect(colorField.default).toBeUndefined();
            expect(colorField.description).toBeUndefined();
        });

        it('should not preserve existing description when present', () => {
            const formanSchema: FormanSchemaField = {
                type: 'collection',
                spec: [
                    {
                        name: 'color',
                        type: 'select',
                        label: 'Color',
                        help: 'Pick a color',
                        options: [
                            { value: 'red', label: 'Red' },
                            { value: 'blue', label: 'Blue' },
                        ],
                    },
                ],
            };

            const jsonSchema = toJSONSchema(formanSchema);
            const colorField = jsonSchema.properties!['color'] as JSONSchema7;

            expect(colorField.description).toBe('Pick a color');
        });

        it('should set default and description for RPC-only non-required selects', () => {
            const formanSchema: FormanSchemaField = {
                type: 'collection',
                spec: [
                    {
                        name: 'item',
                        type: 'select',
                        label: 'Item',
                        options: 'rpc://getItems',
                    },
                ],
            };

            const jsonSchema = toJSONSchema(formanSchema);
            const itemField = jsonSchema.properties!['item'] as JSONSchema7;

            expect(itemField.default).toBe('');
            expect(itemField.description).toBe('Optional field, can be left empty.');
            // RPC-only: no enum or oneOf to prepend to
            expect(itemField.enum).toBeUndefined();
            expect(itemField.oneOf).toBeUndefined();
        });
    });

    describe('Validation', () => {
        it('should accept empty string for non-required select', async () => {
            const result = await validateForman(
                { color: '' },
                [
                    {
                        name: 'color',
                        type: 'select',
                        options: [{ value: 'red' }, { value: 'blue' }],
                    },
                ],
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject empty string for required select', async () => {
            const result = await validateForman(
                { color: '' },
                [
                    {
                        name: 'color',
                        type: 'select',
                        required: true,
                        options: [{ value: 'red' }, { value: 'blue' }],
                    },
                ],
            );
            expect(result.valid).toBe(false);
            expect(result.errors[0]!.message).toBe('Field is mandatory.');
        });
    });

    describe('Roundtrip', () => {
        it('should not leak artificial empty option back to Forman schema', () => {
            const originalForman: FormanSchemaField = {
                type: 'collection',
                spec: [
                    {
                        name: 'color',
                        type: 'select',
                        label: 'Color',
                        options: [
                            { value: 'red', label: 'Red' },
                            { value: 'blue', label: 'Blue' },
                        ],
                    },
                ],
            };

            const jsonSchema = toJSONSchema(originalForman);
            const roundtripped = toFormanSchema(jsonSchema);

            expect(roundtripped.spec).toEqual([
                {
                    name: 'color',
                    type: 'select',
                    label: 'Color',
                    required: false,
                    options: [
                        { value: 'red' },
                        { value: 'blue' },
                    ],
                },
            ]);
        });

        it('should not leak artificial empty option from enum-based select', () => {
            const originalForman: FormanSchemaField = {
                type: 'collection',
                spec: [
                    {
                        name: 'size',
                        type: 'select',
                        options: [{ value: 'small' }, { value: 'large' }],
                    },
                ],
            };

            const jsonSchema = toJSONSchema(originalForman);
            const roundtripped = toFormanSchema(jsonSchema);

            expect(roundtripped.spec).toEqual([
                {
                    name: 'size',
                    type: 'select',
                    required: false,
                    options: [
                        { value: 'small' },
                        { value: 'large' },
                    ],
                },
            ]);
        });
    });
});
