import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import { type FormanSchemaField, toJSONSchema } from '../src/index.js';

describe('advanced field filtering', () => {
    describe('default behavior (includeAdvancedFields: false)', () => {
        it('omits advanced fields and records their paths', () => {
            const result = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text' },
                    { name: 'b', type: 'text', advanced: true },
                ],
            });

            expect(result.schema.properties).toHaveProperty('a');
            expect(result.schema.properties).not.toHaveProperty('b');
            expect(result.skippedPaths).toEqual({ advanced: ['w.b'] });
        });

        it('omits skippedPaths entirely when nothing was skipped', () => {
            const result = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'a', type: 'text' }],
            });

            expect(result.schema.properties).toHaveProperty('a');
            expect(result.skippedPaths).toBeUndefined();
        });

        it('does not stamp x-advanced on regular fields', () => {
            const result = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'a', type: 'text' }],
            });

            const aField = result.schema.properties!['a'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(aField, 'x-advanced')).toBeUndefined();
        });
    });

    describe('includeAdvancedFields: true', () => {
        it('includes advanced fields and stamps x-advanced: true', () => {
            const result = toJSONSchema(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        { name: 'a', type: 'text' },
                        { name: 'b', type: 'text', advanced: true },
                    ],
                },
                { includeAdvancedFields: true },
            );

            expect(result.schema.properties).toHaveProperty('a');
            expect(result.schema.properties).toHaveProperty('b');
            expect(result.skippedPaths).toBeUndefined();

            const bField = result.schema.properties!['b'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(bField, 'x-advanced')?.value).toBe(true);

            const aField = result.schema.properties!['a'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(aField, 'x-advanced')).toBeUndefined();
        });
    });

    describe('path notation', () => {
        it('records correct path for advanced field inside an array of collections', () => {
            const result = toJSONSchema({
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
            });

            expect(result.skippedPaths).toEqual({ advanced: ['w.arr[].inner'] });
        });

        it('records correct path through nested collections inside arrays', () => {
            const result = toJSONSchema({
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
            });

            expect(result.skippedPaths).toEqual({ advanced: ['w.arr[].subColl.deepAdvanced'] });
        });

        it('records correct path through nested-by-option fields (same JSON level as gating select)', () => {
            const result = toJSONSchema({
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
            });

            expect(result.skippedPaths).toEqual({ advanced: ['w.shade'] });
        });
    });

    describe('composites', () => {
        it('hides udtspec internal label field by default', () => {
            const result = toJSONSchema({
                name: 'wrapper',
                type: 'collection',
                spec: [{ name: 'spec', type: 'udtspec', label: 'Specification' }],
            });

            const udtspecDef = result.schema['definitions']!['udtspec'] as JSONSchema7;
            expect(udtspecDef.properties).not.toHaveProperty('label');
            expect(udtspecDef.properties).toHaveProperty('name');
            expect(udtspecDef.properties).toHaveProperty('help');
        });

        it('exposes udtspec internal label field with x-advanced when included', () => {
            const result = toJSONSchema(
                {
                    name: 'wrapper',
                    type: 'collection',
                    spec: [{ name: 'spec', type: 'udtspec', label: 'Specification' }],
                },
                { includeAdvancedFields: true },
            );

            const udtspecDef = result.schema['definitions']!['udtspec'] as JSONSchema7;
            expect(udtspecDef.properties).toHaveProperty('label');
            const labelField = udtspecDef.properties!['label'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(labelField, 'x-advanced')?.value).toBe(true);
        });
    });

    describe('cross-domain', () => {
        it('filters advanced fields inside cross-domain nested blocks', () => {
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

            const result = toJSONSchema(formanSchema);
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
            const result = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text', advanced: true },
                    { name: 'b', type: 'text' },
                    { name: 'c', type: 'text', advanced: true },
                ],
            });

            expect(result.skippedPaths?.advanced).toEqual(['w.a', 'w.c']);
        });
    });

    describe('required + advanced interaction', () => {
        it('omits required+advanced field from required[] and properties by default', () => {
            const result = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text', required: true },
                    { name: 'b', type: 'text', required: true, advanced: true },
                ],
            });

            expect(result.schema.properties).toHaveProperty('a');
            expect(result.schema.properties).not.toHaveProperty('b');
            expect(result.schema.required).toEqual(['a']);
            expect(result.skippedPaths).toEqual({ advanced: ['w.b'] });
        });

        it('includes required+advanced field in required[] and properties when included', () => {
            const result = toJSONSchema(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        { name: 'a', type: 'text', required: true },
                        { name: 'b', type: 'text', required: true, advanced: true },
                    ],
                },
                { includeAdvancedFields: true },
            );

            expect(result.schema.properties).toHaveProperty('a');
            expect(result.schema.properties).toHaveProperty('b');
            expect(result.schema.required).toEqual(['a', 'b']);
            expect(result.skippedPaths).toBeUndefined();
        });
    });

    describe('top-level field', () => {
        it('always converts a top-level advanced field (filtering applies to descendants only)', () => {
            const result = toJSONSchema({ name: 'x', type: 'text', advanced: true });

            expect(result.schema.type).toBe('string');
            expect(result.skippedPaths).toBeUndefined();
            expect(Object.getOwnPropertyDescriptor(result.schema, 'x-advanced')).toBeUndefined();
        });
    });

    describe('array with non-array spec', () => {
        it('renders a single-spec primitive into items regardless of advanced flag (no addField guard)', () => {
            const result = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [
                    {
                        name: 'arr',
                        type: 'array',
                        spec: { name: 'item', type: 'text', advanced: true } as FormanSchemaField,
                    },
                ],
            });

            expect(result.schema.properties).toHaveProperty('arr');
            const arrField = result.schema.properties!['arr'] as JSONSchema7;
            expect(arrField.items).toBeDefined();
            expect((arrField.items as JSONSchema7).type).toBe('string');
            expect(result.skippedPaths).toBeUndefined();
        });
    });

    describe('composite caching', () => {
        it('records the udtspec label skip only once even when used in multiple fields', () => {
            const result = toJSONSchema({
                name: 'wrapper',
                type: 'collection',
                spec: [
                    { name: 'spec1', type: 'udtspec', label: 'Spec One' },
                    { name: 'spec2', type: 'udtspec', label: 'Spec Two' },
                ],
            });

            expect(result.skippedPaths?.advanced).toHaveLength(1);
            expect(result.skippedPaths!.advanced![0]).toContain('label');
        });
    });
});
