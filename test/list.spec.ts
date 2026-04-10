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
        it('should convert list with RPC options to JSON Schema with x-fetch', () => {
            const result = toJSONSchema({
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
        });

        it('should convert list with inline options to oneOf', () => {
            const result = toJSONSchema({
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
            const result = toJSONSchema({
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
                    { value: 'item-1', label: 'Item 1' },
                    { value: 'item-2', label: 'Item 2' },
                ]);
            }
            return Promise.resolve([]);
        };

        it('should validate list with valid RPC value', async () => {
            const result = await validateForman({ item: 'item-1' }, listSchema, { resolveRemote });
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
