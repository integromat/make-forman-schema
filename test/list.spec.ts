import { describe, expect, it } from '@jest/globals';
import { toJSONSchema, validateForman } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';

const listSchema: FormanSchemaField[] = [
    {
        name: 'item',
        type: 'list',
        required: true,
        options: {
            store: 'rpc://items/list',
            value: 'data',
        },
    },
];

describe('List type', () => {
    describe('toJSONSchema', () => {
        it('should convert list with RPC options to JSON Schema with x-fetch and x-fetch-options', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: listSchema,
            });

            expect(result).toEqual(
                expect.objectContaining({
                    type: 'object',
                    required: ['item'],
                }),
            );

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const item = props.item as Record<string, unknown>;
            expect(item.type).toBe('string');
            expect(item['x-fetch']).toBe('rpc://items/list');
            expect(item['x-fetch-options']).toEqual({ value: 'data', type: 'list' });
        });

        it('should include label and value in x-fetch-options when both are specified', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'item',
                        type: 'list',
                        required: true,
                        options: {
                            store: 'rpc://items/list',
                            label: 'name',
                            value: 'data',
                        },
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const item = props.item as Record<string, unknown>;
            expect(item['x-fetch-options']).toEqual({ label: 'name', value: 'data', type: 'list' });
        });

        it('should include type in x-fetch-options for list even without label/value', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'item',
                        type: 'list',
                        required: true,
                        options: {
                            store: 'rpc://items/list',
                        },
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const item = props.item as Record<string, unknown>;
            expect(item['x-fetch-options']).toEqual({ type: 'list' });
        });

        it('should not include x-fetch-options for select type without label/value', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'choice',
                        type: 'select',
                        required: true,
                        options: {
                            store: 'rpc://items/list',
                        },
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const choice = props.choice as Record<string, unknown>;
            expect(choice['x-fetch-options']).toBeUndefined();
        });

        it('should emit x-fetch-options with type when list options is a string shorthand', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'item',
                        type: 'list',
                        required: true,
                        options: 'rpc://items/list',
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const item = props.item as Record<string, unknown>;
            expect(item['x-fetch']).toBe('rpc://items/list');
            expect(item['x-fetch-options']).toEqual({ type: 'list' });
        });

        it('should not emit x-fetch-options when select options is a string shorthand', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'choice',
                        type: 'select',
                        required: true,
                        options: 'rpc://items/list',
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const choice = props.choice as Record<string, unknown>;
            expect(choice['x-fetch']).toBe('rpc://items/list');
            expect(choice['x-fetch-options']).toBeUndefined();
        });

        it('should produce x-fetch-options on nested list inside a select option', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: '__type',
                        type: 'select',
                        required: true,
                        options: [
                            {
                                value: 'select',
                                label: 'Start from a specific item',
                                nested: [
                                    {
                                        name: 'select',
                                        label: 'Starting item',
                                        type: 'list',
                                        required: true,
                                        options: {
                                            store: 'rpc://test@1/epoch:test',
                                            value: 'data',
                                        },
                                    },
                                ],
                            },
                            {
                                value: 'all',
                                label: 'All items',
                            },
                        ],
                    },
                ],
            });

            const allOf = (result as Record<string, unknown>).allOf as Record<string, unknown>[];
            expect(allOf).toHaveLength(1);

            const then = allOf[0]!.then as Record<string, unknown>;
            const selectProp = (then.properties as Record<string, unknown>).select as Record<string, unknown>;
            expect(selectProp['x-fetch']).toBe('rpc://test@1/epoch:test?__type={{__type}}');
            expect(selectProp['x-fetch-options']).toEqual({ value: 'data', type: 'list' });
        });

        it('should convert list with inline options to oneOf', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'pick',
                        type: 'list',
                        required: true,
                        options: [
                            { label: 'First', value: 'first' },
                            { label: 'Second', value: 'second' },
                        ],
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const pick = props.pick as Record<string, unknown>;
            expect(pick.type).toBe('string');
            expect(pick.oneOf).toEqual([
                { title: 'First', const: 'first' },
                { title: 'Second', const: 'second' },
            ]);
        });

        it('should convert non-required list with empty default', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'pick',
                        type: 'list',
                        options: [
                            { label: 'A', value: 'a' },
                            { label: 'B', value: 'b' },
                        ],
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const pick = props.pick as Record<string, unknown>;
            expect(pick.default).toBe('');
            expect(pick.oneOf).toEqual([
                { title: 'Empty', const: '' },
                { title: 'A', const: 'a' },
                { title: 'B', const: 'b' },
            ]);
        });
    });

    describe('validateForman', () => {
        const resolveRemote = (path: string) => {
            if (path === 'rpc://items/list') {
                return Promise.resolve([
                    { data: { id: 1 }, label: 'Item 1' },
                    { data: { id: 2 }, label: 'Item 2' },
                ]);
            }
            return Promise.resolve([]);
        };

        it('should validate list with valid RPC value', async () => {
            const result = await validateForman({ item: { id: 1 } }, listSchema, { resolveRemote });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject invalid list value', async () => {
            const result = await validateForman({ item: 'invalid' }, listSchema, { resolveRemote });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: "Value 'invalid' not found in options." }),
            ]);
        });

        it('should validate list with inline options', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'pick',
                    type: 'list',
                    required: true,
                    options: [
                        { label: 'First', value: 'first' },
                        { label: 'Second', value: 'second' },
                    ],
                },
            ];
            const result = await validateForman({ pick: 'first' }, schema);
            expect(result.valid).toBe(true);
        });
    });
});
