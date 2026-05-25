import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import { type FormanSchemaField, toJSONSchema, toJSONSchemaAdvanced } from '../src/index.js';

describe('advanced field tracking', () => {
    describe('default behavior (excludeAdvancedFields: false)', () => {
        it('includes advanced fields and stamps x-advanced: true', () => {
            const schema = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text' },
                    { name: 'b', type: 'text', advanced: true },
                ],
            });

            expect(schema.properties).toHaveProperty('a');
            expect(schema.properties).toHaveProperty('b');

            const bField = schema.properties!['b'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(bField, 'x-advanced')?.value).toBe(true);

            const aField = schema.properties!['a'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(aField, 'x-advanced')).toBeUndefined();
        });

        it('returns no skippedPaths from toJSONSchemaAdvanced when nothing was excluded', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text' },
                    { name: 'b', type: 'text', advanced: true },
                ],
            });

            expect(result.schema.properties).toHaveProperty('b');
            expect(result.skippedPaths).toBeUndefined();
        });
    });

    describe('opt-out via { excludeAdvancedFields: true }', () => {
        it('omits advanced fields from the schema', () => {
            const schema = toJSONSchema(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        { name: 'a', type: 'text' },
                        { name: 'b', type: 'text', advanced: true },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(schema.properties).toHaveProperty('a');
            expect(schema.properties).not.toHaveProperty('b');
        });

        it('reports skipped paths via toJSONSchemaAdvanced', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        { name: 'a', type: 'text' },
                        { name: 'b', type: 'text', advanced: true },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.schema.properties).not.toHaveProperty('b');
            expect(result.skippedPaths).toEqual({ advanced: ['w.b'] });
        });
    });

    describe('toJSONSchema vs toJSONSchemaAdvanced', () => {
        it('produces the same schema for the same input', () => {
            const field: FormanSchemaField = {
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text' },
                    { name: 'b', type: 'text', advanced: true },
                ],
            };

            const schema = toJSONSchema(field);
            const { schema: advancedSchema } = toJSONSchemaAdvanced(field);
            expect(advancedSchema).toEqual(schema);
        });
    });

    describe('path tracking when excluded', () => {
        it('records correct path for advanced field inside an array of collections', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        {
                            name: 'arr',
                            type: 'array',
                            spec: [
                                { name: 'inner', type: 'text', advanced: true },
                                { name: 'visible', type: 'text' },
                            ],
                        },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.skippedPaths).toEqual({ advanced: ['w.arr[].inner'] });
        });

        it('records correct path through nested collections inside arrays', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        {
                            name: 'arr',
                            type: 'array',
                            spec: [
                                {
                                    name: 'subColl',
                                    type: 'collection',
                                    spec: [{ name: 'deepAdvanced', type: 'text', advanced: true }],
                                },
                            ],
                        },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.skippedPaths).toEqual({ advanced: ['w.arr[].subColl.deepAdvanced'] });
        });

        it('records correct path for nested-by-option fields (same JSON level as gating select)', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        {
                            name: 'color',
                            type: 'select',
                            options: [
                                {
                                    value: 'red',
                                    label: 'Red',
                                    nested: [{ name: 'shade', type: 'text', advanced: true }],
                                },
                            ],
                        },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.skippedPaths).toEqual({ advanced: ['w.shade'] });
        });
    });

    describe('composites', () => {
        it('includes the udtspec internal label field by default with x-advanced stamp', () => {
            const schema = toJSONSchema({
                name: 'wrapper',
                type: 'collection',
                spec: [{ name: 'spec', type: 'udtspec', label: 'Specification' }],
            });

            const udtspecDef = schema['definitions']!['udtspec'] as JSONSchema7;
            expect(udtspecDef.properties).toHaveProperty('label');
            const labelField = udtspecDef.properties!['label'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(labelField, 'x-advanced')?.value).toBe(true);
        });

        it('hides udtspec internal label field when excluded', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'wrapper',
                    type: 'collection',
                    spec: [{ name: 'spec', type: 'udtspec', label: 'Specification' }],
                },
                { excludeAdvancedFields: true },
            );

            const udtspecDef = result.schema['definitions']!['udtspec'] as JSONSchema7;
            expect(udtspecDef.properties).not.toHaveProperty('label');
            expect(udtspecDef.properties).toHaveProperty('name');
            expect(result.skippedPaths?.advanced).toHaveLength(1);
            expect(result.skippedPaths!.advanced![0]).toContain('label');
        });

        it('records the udtspec label skip only once even when used in multiple fields', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'wrapper',
                    type: 'collection',
                    spec: [
                        { name: 'spec1', type: 'udtspec', label: 'Spec One' },
                        { name: 'spec2', type: 'udtspec', label: 'Spec Two' },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.skippedPaths?.advanced).toHaveLength(1);
        });
    });

    describe('cross-domain', () => {
        it('filters advanced fields inside cross-domain nested blocks (records both inline and buffered paths)', () => {
            const formanSchema: FormanSchemaField = {
                name: 'wrapper',
                type: 'collection',
                spec: [
                    {
                        name: 'select',
                        type: 'select',
                        options: {
                            store: [{ value: 'opt1', label: 'Option 1' }],
                            nested: {
                                store: [
                                    { name: 'normal', type: 'text' },
                                    { name: 'advancedNested', type: 'text', advanced: true },
                                ],
                                domain: 'additional',
                            },
                        },
                    },
                    {
                        name: 'additionalRoot',
                        type: 'collection',
                        'x-domain-root': 'additional',
                        spec: [],
                    } as FormanSchemaField,
                ],
            };

            const result = toJSONSchemaAdvanced(formanSchema, { excludeAdvancedFields: true });
            // Field-level options.nested with a domain is processed BOTH inline (via addConditionalFields)
            // and buffered into the target domain root — so the advanced field is skipped twice, at two
            // distinct paths. This is preexisting cross-domain semantics, not duplication.
            expect(result.skippedPaths).toEqual({
                advanced: ['wrapper.advancedNested', 'wrapper.additionalRoot.advancedNested'],
            });
        });
    });

    describe('multiple advanced fields', () => {
        it('collects all skipped paths in order of encounter', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        { name: 'a', type: 'text', advanced: true },
                        { name: 'b', type: 'text' },
                        { name: 'c', type: 'text', advanced: true },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.skippedPaths?.advanced).toEqual(['w.a', 'w.c']);
        });
    });

    describe('required + advanced interaction', () => {
        it('includes a required+advanced field in properties and required[] by default', () => {
            const schema = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text', required: true },
                    { name: 'b', type: 'text', required: true, advanced: true },
                ],
            });

            expect(schema.properties).toHaveProperty('a');
            expect(schema.properties).toHaveProperty('b');
            expect(schema.required).toEqual(['a', 'b']);
        });

        it('omits a required+advanced field from required[] and properties when excluded', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        { name: 'a', type: 'text', required: true },
                        { name: 'b', type: 'text', required: true, advanced: true },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.schema.properties).toHaveProperty('a');
            expect(result.schema.properties).not.toHaveProperty('b');
            expect(result.schema.required).toEqual(['a']);
            expect(result.skippedPaths).toEqual({ advanced: ['w.b'] });
        });
    });

    describe('top-level field', () => {
        it('always converts a top-level advanced field (filter applies only to descendants)', () => {
            const schema = toJSONSchema({ name: 'x', type: 'text', advanced: true }, { excludeAdvancedFields: true });

            expect(schema.type).toBe('string');
            expect(Object.getOwnPropertyDescriptor(schema, 'x-advanced')).toBeUndefined();
        });
    });

    describe('array with non-array spec', () => {
        it('renders a single-spec primitive into items regardless of advanced flag (no addField guard)', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        {
                            name: 'arr',
                            type: 'array',
                            spec: { name: 'item', type: 'text', advanced: true } as FormanSchemaField,
                        },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.schema.properties).toHaveProperty('arr');
            const arrField = result.schema.properties!['arr'] as JSONSchema7;
            expect(arrField.items).toBeDefined();
            expect((arrField.items as JSONSchema7).type).toBe('string');
            expect(result.skippedPaths).toBeUndefined();
        });
    });
});
