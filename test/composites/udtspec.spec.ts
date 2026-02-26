import { describe, expect, it } from '@jest/globals';
import { type FormanSchemaField, toFormanSchema, toJSONSchema, validateForman } from '../../src';
import { JSONSchema7 } from 'json-schema';

describe('udtspec composite', () => {
    describe('Forman -> JSON Schema', () => {
        it('should convert udtspec to array with x-composite marker', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'spec',
                        type: 'udtspec',
                        label: 'Specification',
                    },
                ],
            };

            const result = toJSONSchema(field);

            const specField = result.properties!['spec'] as JSONSchema7;
            expect(specField.type).toBe('array');
            expect(Object.getOwnPropertyDescriptor(specField, 'x-composite')?.value).toBe('udtspec');
            expect(specField.title).toBe('Specification');

            // Items should be a $ref now (inner fragment is in $defs)
            const items = specField.items as JSONSchema7;
            expect(items.$ref).toBe('#/$defs/udtspec');

            // The inner fragment should be in $defs without title/description
            const udtspecDef = result['$defs']!['udtspec'] as JSONSchema7;
            expect(udtspecDef.type).toBe('object');
            expect(udtspecDef.title).toBeUndefined();
            expect(udtspecDef.properties).toBeDefined();
            expect(udtspecDef.properties!['name']).toBeDefined();
            expect(udtspecDef.properties!['label']).toBeDefined();
            expect(udtspecDef.properties!['help']).toBeDefined();
            expect(udtspecDef.properties!['type']).toBeDefined();

            // The 'type' property inside $defs.udtspec should use allOf wrapper with $ref
            const typeField = udtspecDef.properties!['type'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(typeField, 'x-composite')?.value).toBe('udttype');
            expect(typeField.allOf).toBeDefined();
            expect((typeField.allOf![0] as JSONSchema7).$ref).toBe('#/$defs/udttype');

            // udttype $defs should have no title/description (inner fragment only)
            const udttypeDef = result['$defs']!['udttype'] as JSONSchema7;
            expect(udttypeDef.type).toBe('string');
            expect(udttypeDef.title).toBeUndefined();
            expect(udttypeDef.description).toBeUndefined();
            expect(Object.getOwnPropertyDescriptor(udttypeDef, 'x-composite')?.value).toBe('udttype');

        });

        it('should convert top-level udtspec field directly', () => {
            const result = toJSONSchema({ name: 'x', type: 'udtspec' });

            expect(result.type).toBe('array');
            expect(result['$defs']).toBeDefined();
            expect(result['$defs']!['udtspec']).toBeDefined();
            expect(result['$defs']!['udttype']).toBeDefined();
        });

        it('should produce $defs with both udtspec and udttype', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'spec',
                        type: 'udtspec',
                        label: 'Specification',
                    },
                ],
            };

            const result = toJSONSchema(field);

            expect(result['$defs']).toBeDefined();
            expect(result['$defs']!['udtspec']).toBeDefined();
            expect(result['$defs']!['udttype']).toBeDefined();
        });
    });

    describe('JSON Schema -> Forman', () => {
        it('should collapse x-composite udtspec back to udtspec field', () => {
            const jsonSchema: JSONSchema7 = {
                type: 'array',
                title: 'Specification',
                description: 'UDT spec',
                'x-composite': 'udtspec',
            } as any;

            const result = toFormanSchema(jsonSchema);

            expect(result.type).toBe('udtspec');
            expect(result.label).toBe('Specification');
            expect(result.help).toBe('UDT spec');
        });
    });

    describe('Round-trip', () => {
        it('should round-trip udtspec through toJSONSchema and toFormanSchema', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'spec',
                        type: 'udtspec',
                        label: 'My Spec',
                        help: 'Helpful text',
                    },
                ],
            };

            const jsonSchema = toJSONSchema(field);
            const specField = jsonSchema.properties!['spec'] as JSONSchema7;
            const formanField = toFormanSchema(specField);

            expect(formanField.type).toBe('udtspec');
            expect(formanField.label).toBe('My Spec');
            expect(formanField.help).toBe('Helpful text');
        });
    });

    describe('Validation', () => {
        it('should pass for valid udtspec value #1', async () => {
            const result = await validateForman(
                {
                    spec: [{ name: 'field1', type: 'text', required: false, multiline: false }],
                },
                [
                    {
                        name: 'spec',
                        type: 'udtspec',
                        label: 'Specification',
                    },
                ],
            );

            expect(result.errors).toHaveLength(0);
            expect(result.valid).toBe(true);
        });
        it('should pass for valid udtspec value #2 with nested collection', async () => {
            const result = await validateForman(
                {
                    spec: [
                        {
                            name: 'testNumber',
                            help: 'Test Field',
                            type: 'number',
                            required: false,
                        },
                        {
                            name: 'testArray',
                            type: 'array',
                            spec: {
                                type: 'collection',
                                spec: [
                                    {
                                        name: 'name',
                                        type: 'text',
                                        required: false,
                                        multiline: false,
                                    },
                                    {
                                        name: 'age',
                                        type: 'number',
                                        required: false,
                                    },
                                ],
                                required: false,
                            },
                            required: false,
                        },
                        {
                            name: 'flags',
                            type: 'collection',
                            spec: [
                                {
                                    name: 'test1',
                                    type: 'boolean',
                                    required: false,
                                },
                                {
                                    name: 'test2',
                                    help: 'AAAA',
                                    type: 'text',
                                    required: false,
                                    multiline: false,
                                },
                            ],
                            required: false,
                        },
                    ],
                },
                [
                    {
                        name: 'spec',
                        type: 'udtspec',
                        label: 'Specification',
                    },
                ],
            );

            expect(result.errors).toHaveLength(0);
            expect(result.valid).toBe(true);
        });

        it('should fail when required fields are missing in udtspec item', async () => {
            const result = await validateForman(
                {
                    spec: [{ label: 'Missing Name' }],
                },
                [
                    {
                        name: 'spec',
                        type: 'udtspec',
                        label: 'Specification',
                    },
                ],
            );

            expect(result.valid).toBe(false);
        });

        it('should convert schema with multiple udtspec fields', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'spec1',
                        type: 'udtspec',
                        label: 'Specification',
                    },
                    {
                        name: 'spec2',
                        type: 'udtspec',
                        label: 'Something Else that is also a spec',
                    },
                ],
            };

            const result = toJSONSchema(field);

            // Both fields should be wrappers with their own titles
            const spec1 = result.properties!['spec1'] as JSONSchema7;
            const spec2 = result.properties!['spec2'] as JSONSchema7;

            expect(spec1.type).toBe('array');
            expect(spec1.title).toBe('Specification');
            expect((spec1.items as JSONSchema7).$ref).toBe('#/$defs/udtspec');

            expect(spec2.type).toBe('array');
            expect(spec2.title).toBe('Something Else that is also a spec');
            expect((spec2.items as JSONSchema7).$ref).toBe('#/$defs/udtspec');

            // $defs.udtspec should have no title (inner fragment only)
            const udtspecDef = result['$defs']!['udtspec'] as JSONSchema7;
            expect(udtspecDef.title).toBeUndefined();
            expect(udtspecDef.type).toBe('object');

            expect(result).toMatchSnapshot();
        });
    });
});
