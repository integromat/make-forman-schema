import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import { SchemaConversionError, toFormanSchema, toJSONSchema, toJSONSchemaAdvanced } from '../src/index.js';

describe('unconvertible field tracking', () => {
    describe('default behavior (tolerant)', () => {
        it('does not abort the whole conversion when one sub-field has an unknown type', () => {
            const schema = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'text' },
                    { name: 'b', type: 'tags' },
                    { name: 'c', type: 'number' },
                ],
            });

            // The whole point: the good fields survive alongside the bad one.
            expect(schema.properties).toHaveProperty('a');
            expect(schema.properties).toHaveProperty('b');
            expect(schema.properties).toHaveProperty('c');
            expect(schema.properties!['a']).toEqual({ type: 'string' });
            expect(schema.properties!['c']).toEqual({ type: 'number' });
        });

        it('degrades an unknown type to a permissive typeless schema', () => {
            const schema = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'b', type: 'tags' }],
            });

            expect(schema.properties!['b']).toEqual({});
        });

        it('preserves label and help on a degraded field', () => {
            const schema = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'b', type: 'tags', label: 'Tags', help: 'Some help' }],
            });

            expect(schema.properties!['b']).toEqual({ title: 'Tags', description: 'Some help' });
        });

        it('reports the unconvertible path and reason via toJSONSchemaAdvanced', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'b', type: 'tags' }],
            });

            expect(result.skippedPaths).toEqual({ unconvertible: ['w.b (unknown type: tags)'] });
        });

        it('returns no skippedPaths when every type resolved', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'a', type: 'text' }],
            });

            expect(result.skippedPaths).toBeUndefined();
        });

        it('degrades and reports a field with no type at all', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'a', type: 'text' }, { name: 'b' } as never],
            });

            expect(result.schema.properties).toHaveProperty('a');
            expect(result.schema.properties!['b']).toEqual({});
            expect(result.skippedPaths).toEqual({ unconvertible: ['w.b (missing type)'] });
        });

        it('degrades a top-level field with an unknown type', () => {
            const result = toJSONSchemaAdvanced({ name: 'lonely', type: 'nopeNotAType' });

            expect(result.schema).toEqual({});
            expect(result.skippedPaths).toEqual({ unconvertible: ['lonely (unknown type: nopeNotAType)'] });
        });

        it('reports the path of an unknown type inside array items', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [
                    {
                        name: 'arr',
                        type: 'array',
                        spec: [{ name: 'inner', type: 'tags' }],
                    },
                ],
            });

            expect(result.skippedPaths).toEqual({ unconvertible: ['w.arr[].inner (unknown type: tags)'] });
        });

        it('reports the path of an unknown type inside a nested collection', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [
                    {
                        name: 'sub',
                        type: 'collection',
                        spec: [{ name: 'deep', type: 'tags' }],
                    },
                ],
            });

            expect(result.skippedPaths).toEqual({ unconvertible: ['w.sub.deep (unknown type: tags)'] });
        });

        it('reports the path of an unknown type inside a dynamicCollection', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [
                    {
                        name: 'dyn',
                        type: 'dynamicCollection',
                        spec: [{ name: 'deep', type: 'tags' }],
                    },
                ],
            });

            expect(result.skippedPaths).toEqual({ unconvertible: ['w.dyn.deep (unknown type: tags)'] });
        });

        it('collects several unconvertible fields in one pass', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [
                    { name: 'a', type: 'tags' },
                    { name: 'b', type: 'category' },
                ],
            });

            expect(result.skippedPaths).toEqual({
                unconvertible: ['w.a (unknown type: tags)', 'w.b (unknown type: category)'],
            });
        });

        it('reports advanced and unconvertible skips side by side', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        { name: 'adv', type: 'text', advanced: true },
                        { name: 'bad', type: 'tags' },
                    ],
                },
                { excludeAdvancedFields: true },
            );

            expect(result.skippedPaths).toEqual({
                advanced: ['w.adv'],
                unconvertible: ['w.bad (unknown type: tags)'],
            });
        });

        it('round-trips a degraded field back to Forman as `any`', () => {
            const schema = toJSONSchema({
                name: 'w',
                type: 'collection',
                spec: [{ name: 'b', type: 'tags' }],
            });

            expect(toFormanSchema(schema)).toEqual({
                type: 'collection',
                spec: [{ type: 'any', name: 'b', required: false }],
            });
        });
    });

    describe('opt-out via { strictFieldTypes: true }', () => {
        it('throws SchemaConversionError for an unknown type', () => {
            expect(() => toJSONSchema({ name: 'b', type: 'tags' }, { strictFieldTypes: true })).toThrow(
                'Unknown field type: tags',
            );
        });

        it('throws SchemaConversionError for a missing type', () => {
            expect(() => toJSONSchema({ name: 'b' } as never, { strictFieldTypes: true })).toThrow(
                'Field type is required',
            );
        });

        it('throws from a nested field, not just the top level', () => {
            expect(() =>
                toJSONSchema(
                    { name: 'w', type: 'collection', spec: [{ name: 'b', type: 'tags' }] },
                    { strictFieldTypes: true },
                ),
            ).toThrow('Unknown field type: tags');
        });

        it('exposes the offending field on the error', () => {
            expect.assertions(3);

            try {
                toJSONSchema({ name: 'b', type: 'tags', label: 'Bad' }, { strictFieldTypes: true });
            } catch (err) {
                expect(err).toBeInstanceOf(SchemaConversionError);
                expect((err as SchemaConversionError).name).toBe('SchemaConversionError');
                expect((err as SchemaConversionError).field).toEqual({ name: 'b', type: 'tags', label: 'Bad' });
            }
        });

        it('still converts resolvable types normally', () => {
            const schema = toJSONSchema(
                { name: 'w', type: 'collection', spec: [{ name: 'a', type: 'fileName' }] },
                { strictFieldTypes: true },
            );

            expect((schema.properties!['a'] as JSONSchema7).type).toBe('string');
        });
    });
});
