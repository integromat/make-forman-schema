import { describe, expect, it } from '@jest/globals';
import { toJSONSchema, validateForman } from '../src/index.js';

describe('Placeholder Nested', () => {
    const selectWithPlaceholderNested = {
        name: 'aggregator',
        type: 'select',
        label: 'Aggregator',
        options: {
            store: [
                { value: 'sum', label: 'Sum' },
                { value: 'avg', label: 'Average' },
            ],
            placeholder: {
                label: 'Select an aggregator...',
                nested: [
                    {
                        name: 'defaultField',
                        type: 'text',
                        label: 'Default Field',
                        required: true,
                    },
                ],
            },
        },
    };

    describe('Schema Generation', () => {
        it('should produce allOf with if/then for empty string value when field is not required', () => {
            const formanSchema = {
                type: 'collection',
                spec: [selectWithPlaceholderNested],
            };

            const jsonSchema = toJSONSchema(formanSchema);
            expect(jsonSchema).toMatchObject({
                type: 'object',
                properties: {
                    aggregator: {
                        type: 'string',
                        title: 'Aggregator',
                        default: '',
                        oneOf: expect.arrayContaining([
                            { title: 'Sum', const: 'sum' },
                            { title: 'Average', const: 'avg' },
                            { title: 'Select an aggregator...', const: '' },
                        ]),
                    },
                },
                required: [],
                allOf: [
                    {
                        if: {
                            properties: {
                                aggregator: { const: '' },
                            },
                        },
                        then: expect.objectContaining({
                            type: 'object',
                            properties: {
                                defaultField: expect.objectContaining({
                                    type: 'string',
                                    title: 'Default Field',
                                }),
                            },
                            required: ['defaultField'],
                        }),
                    },
                ],
            });
        });

        it('should NOT produce placeholder nested when field is required', () => {
            const formanSchema = {
                type: 'collection',
                spec: [
                    {
                        ...selectWithPlaceholderNested,
                        required: true,
                    },
                ],
            };

            const jsonSchema = toJSONSchema(formanSchema);
            // When required, placeholder is NOT injected as an option
            expect(jsonSchema).toMatchObject({
                type: 'object',
                properties: {
                    aggregator: {
                        type: 'string',
                        oneOf: [
                            { title: 'Sum', const: 'sum' },
                            { title: 'Average', const: 'avg' },
                        ],
                    },
                },
                required: ['aggregator'],
            });
            // No allOf with null conditional
            expect(jsonSchema.allOf).toBeUndefined();
        });
    });

    describe('Validation', () => {
        const formanSchema = [selectWithPlaceholderNested];

        it('should accept empty string value and validate placeholder nested fields', async () => {
            const result = await validateForman(
                { aggregator: '', defaultField: 'hello' },
                formanSchema,
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should accept null value and validate placeholder nested fields', async () => {
            const result = await validateForman(
                { aggregator: null, defaultField: 'hello' },
                formanSchema,
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject empty string value when placeholder nested required field is missing', async () => {
            const result = await validateForman(
                { aggregator: '' },
                formanSchema,
            );
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                {
                    domain: 'default',
                    path: 'defaultField',
                    message: 'Field is mandatory.',
                },
            ]);
        });

        it('should validate non-null value against options normally', async () => {
            const result = await validateForman(
                { aggregator: 'sum' },
                formanSchema,
            );
            expect(result.valid).toBe(true);
        });

        it('should reject invalid non-null value', async () => {
            const result = await validateForman(
                { aggregator: 'invalid' },
                formanSchema,
            );
            expect(result.valid).toBe(false);
            expect(result.errors[0]!.message).toContain('not found in options');
        });

        it('should add field state with placeholder label when value is empty string', async () => {
            const result = await validateForman(
                { aggregator: '', defaultField: 'test' },
                formanSchema,
                { states: true },
            );
            expect(result.valid).toBe(true);
            expect(result.states).toEqual(
                expect.objectContaining({
                    default: expect.objectContaining({
                        aggregator: expect.objectContaining({
                            mode: 'chose',
                            label: 'Select an aggregator...',
                        }),
                    }),
                }),
            );
        });
    });
});
