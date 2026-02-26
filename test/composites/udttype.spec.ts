import { describe, expect, it } from '@jest/globals';
import { type FormanSchemaField, toFormanSchema, toJSONSchema, validateForman } from '../../src';
import type { JSONSchema7 } from 'json-schema';

describe('udttype composite', () => {
    describe('Forman -> JSON Schema', () => {
        it('should convert udttype to select with x-composite marker', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                        default: 'text',
                    },
                ],
            };

            const result = toJSONSchema(field);

            // The type property should be an allOf wrapper with $ref (draft-07 compliant)
            expect(result.properties!['type']).toBeDefined();
            const typeField = result.properties!['type'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(typeField, 'x-composite')?.value).toBe('udttype');
            expect(typeField.title).toBe('Type');
            expect(typeField.default).toBe('text');

            // Should use allOf wrapper with $ref
            expect(typeField.allOf).toBeDefined();
            expect((typeField.allOf![0] as JSONSchema7).$ref).toBe('#/$defs/udttype');

            // The inner fragment in $defs should have type + oneOf but no title
            const udttypeDef = result['$defs']!['udttype'] as JSONSchema7;
            expect(udttypeDef.type).toBe('string');
            expect(udttypeDef.title).toBeUndefined();
            expect(udttypeDef.oneOf).toBeDefined();
            expect(udttypeDef.oneOf!.length).toBe(7);

            const optionValues = udttypeDef.oneOf!.map(o => (o as JSONSchema7).const);
            expect(optionValues).toEqual(['array', 'collection', 'date', 'text', 'number', 'boolean', 'buffer']);
        });

        it('should produce conditional nested fields via allOf on parent', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                    },
                ],
            };

            const result = toJSONSchema(field);

            // Parent collection should have allOf with conditional fields
            expect(result.allOf).toBeDefined();
            expect(result.allOf!.length).toBeGreaterThan(0);

            // Check that conditional fields have if/then structure
            const conditionals = result.allOf!.filter(item => (item as JSONSchema7).if);
            expect(conditionals.length).toBeGreaterThan(0);

            // Check text option has conditional nested fields
            const textConditional = conditionals.find(item => {
                const schema = item as JSONSchema7;
                return (
                    (schema.if as JSONSchema7)?.properties?.type &&
                    ((schema.if as JSONSchema7).properties!['type'] as JSONSchema7).const === 'text'
                );
            }) as JSONSchema7 | undefined;
            expect(textConditional).toBeDefined();
            expect(textConditional!.then).toBeDefined();
        });

        it('should produce $defs on the root when udttype is used', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                    },
                ],
            };

            const result = toJSONSchema(field);

            // $defs should contain the udttype definition
            expect(result['$defs']).toBeDefined();
            expect(result['$defs']!['udttype']).toBeDefined();
            expect(Object.getOwnPropertyDescriptor(result['$defs']!['udttype'], 'x-composite')?.value).toBe('udttype');
        });

        it('should use $ref for recursive udttype references', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                    },
                ],
            };

            const result = toJSONSchema(field);

            // The array option's nested spec should reference $ref for the recursive udttype
            const arrayConditional = result.allOf?.find(item => {
                const schema = item as JSONSchema7;
                return (
                    (schema.if as JSONSchema7)?.properties?.type &&
                    ((schema.if as JSONSchema7).properties!['type'] as JSONSchema7).const === 'array'
                );
            }) as JSONSchema7 | undefined;
            expect(arrayConditional).toBeDefined();

            // Somewhere in the nested structure there should be a $ref to udttype
            const json = JSON.stringify(arrayConditional);
            expect(json).toContain('$ref');
            expect(json).toContain('#/$defs/udttype');
        });

        it('should convert a single udttype field in a minimal collection', () => {
            const result = toJSONSchema({
                name: 'root',
                type: 'collection',
                spec: [{ name: 'x', type: 'udttype', label: 'Type' }],
            });

            const xField = result.properties!['x'] as JSONSchema7;
            expect(xField.allOf).toBeDefined();
            expect(xField.title).toBe('Type');
            expect(result['$defs']).toBeDefined();
            expect(result['$defs']!['udttype']).toBeDefined();
        });

        it('should not emit default when field has no default', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                    },
                ],
            };

            const result = toJSONSchema(field);
            const typeField = result.properties!['type'] as JSONSchema7;

            expect(typeField).not.toHaveProperty('default');
        });

        it('should convert schema with udttype field (snapshot)', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                        default: 'text',
                    },
                ],
            };

            const result = toJSONSchema(field);
            expect(result).toMatchSnapshot();
        });
    });

    describe('JSON Schema -> Forman', () => {
        it('should collapse x-composite udttype back to udttype field', () => {
            const jsonSchema: JSONSchema7 = {
                type: 'string',
                title: 'Type',
                description: 'Select the type',
                'x-composite': 'udttype',
            } as any;

            const result = toFormanSchema(jsonSchema);

            expect(result.type).toBe('udttype');
            expect(result.label).toBe('Type');
            expect(result.help).toBe('Select the type');
        });

        it('should preserve default value on collapse', () => {
            const jsonSchema: JSONSchema7 = {
                type: 'string',
                title: 'Type',
                default: 'text',
                'x-composite': 'udttype',
            } as any;

            const result = toFormanSchema(jsonSchema);

            expect(result.type).toBe('udttype');
            expect(result.default).toBe('text');
        });
    });

    describe('Validation', () => {
        it('should pass for valid udttype value', async () => {
            const result = await validateForman({ type: 'text', required: false, multiline: false }, [
                {
                    name: 'type',
                    type: 'udttype',
                    label: 'Type',
                },
            ]);

            expect(result.errors).toHaveLength(0);
            expect(result.valid).toBe(true);
        });

        it('should fail for invalid udttype value', async () => {
            const result = await validateForman({ type: 'invalid' }, [
                {
                    name: 'type',
                    type: 'udttype',
                    label: 'Type',
                },
            ]);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should validate required udttype field', async () => {
            const result = await validateForman({ type: null }, [
                {
                    name: 'type',
                    type: 'udttype',
                    label: 'Type',
                    required: true,
                },
            ]);

            expect(result.valid).toBe(false);
        });
    });

    describe('Round-trip', () => {
        it('should round-trip udttype through toJSONSchema and toFormanSchema', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                        help: 'Pick a type',
                        default: 'number',
                    },
                ],
            };

            const jsonSchema = toJSONSchema(field);
            const typeField = jsonSchema.properties!['type'] as JSONSchema7;
            const formanField = toFormanSchema({ type: 'object', properties: { type: typeField } });
            const firstField = (formanField.spec as FormanSchemaField[])[0]!;

            expect(firstField.name).toBe('type');
            expect(firstField.type).toBe('udttype');
            expect(firstField.label).toBe('Type');
            expect(firstField.help).toBe('Pick a type');
            expect(firstField.default).toBe('number');
        });
    });

    describe('Complex validation', () => {
        it('should validate udttype collection with nested spec, sequence, required', async () => {
            const result = await validateForman(
                {
                    type: 'collection',
                    spec: [{ name: 'field1', type: 'text', required: false, multiline: false }],
                    sequence: true,
                    required: true,
                },
                [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                    },
                ],
            );

            expect(result.errors).toHaveLength(0);
            expect(result.valid).toBe(true);
        });
    });

    describe('Recursion', () => {
        it('should not cause infinite expansion during conversion', () => {
            const field: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'type',
                        type: 'udttype',
                        label: 'Type',
                    },
                ],
            };

            // Should complete without hanging
            const result = toJSONSchema(field);
            expect(result).toBeDefined();
            expect(result['$defs']).toBeDefined();
        });
    });
});
