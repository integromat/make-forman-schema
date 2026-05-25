import { describe, expect, it } from '@jest/globals';
import { toJSONSchema, validateForman } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';

const radioSchema: FormanSchemaField[] = [
    {
        name: '__type',
        type: 'radio',
        required: true,
        options: [
            {
                label: 'Select the first email',
                value: 'select',
                nested: [
                    {
                        name: 'select',
                        label: '',
                        type: 'list',
                        required: true,
                        options: {
                            store: 'rpc://email/7.5.10/RpcTriggerNewEmailEpoch',
                            value: 'data',
                        },
                    },
                ],
            },
            {
                label: 'Emails from after a specific date',
                value: 'date',
                nested: [
                    {
                        name: 'date',
                        type: 'date',
                        time: true,
                        label: '',
                        required: true,
                    },
                ],
            },
            {
                label: 'All emails',
                value: 'all',
            },
            {
                label: 'From now on',
                value: 'now',
            },
        ],
    },
];

describe('Radio type', () => {
    describe('toJSONSchema', () => {
        it('should convert radio to JSON Schema with oneOf and allOf conditionals', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: radioSchema,
            });

            expect(result).toEqual(
                expect.objectContaining({
                    type: 'object',
                    required: ['__type'],
                }),
            );

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const __type = props.__type as Record<string, unknown>;
            expect(__type.type).toBe('string');
            expect(__type.oneOf).toEqual([
                { title: 'Select the first email', const: 'select' },
                { title: 'Emails from after a specific date', const: 'date' },
                { title: 'All emails', const: 'all' },
                { title: 'From now on', const: 'now' },
            ]);

            const allOf = (result as Record<string, unknown>).allOf as Record<string, unknown>[];
            expect(allOf).toHaveLength(2);
            expect(allOf[0]).toEqual(
                expect.objectContaining({
                    if: { properties: { __type: { const: 'select' } } },
                }),
            );
            expect(allOf[1]).toEqual(
                expect.objectContaining({
                    if: { properties: { __type: { const: 'date' } } },
                }),
            );
        });

        it('should emit x-fetch-options with type when radio options is a string shorthand', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'mode',
                        type: 'radio',
                        required: true,
                        options: 'rpc://modes/list',
                    },
                ],
            });

            const props = (result as Record<string, unknown> & { properties: Record<string, unknown> }).properties;
            const mode = props.mode as Record<string, unknown>;
            expect(mode['x-fetch']).toBe('rpc://modes/list');
            expect(mode['x-fetch-options']).toEqual({ type: 'radio' });
        });

        it('should convert non-required radio with empty default', () => {
            const { schema: result } = toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'choice',
                        type: 'radio',
                        options: [
                            { label: 'A', value: 'a' },
                            { label: 'B', value: 'b' },
                        ],
                    },
                ],
            });

            expect(result).toEqual({
                type: 'object',
                properties: {
                    choice: {
                        type: 'string',
                        default: '',
                        description: expect.any(String),
                        oneOf: [
                            { title: 'Empty', const: '' },
                            { title: 'A', const: 'a' },
                            { title: 'B', const: 'b' },
                        ],
                    },
                },
                required: [],
            });
        });
    });

    describe('validateForman', () => {
        const resolveRemote = (path: string) => {
            if (path === 'rpc://email/7.5.10/RpcTriggerNewEmailEpoch') {
                return Promise.resolve([
                    { data: { lastId: 1, epochType: 'select' }, label: 'Email 1' },
                    { data: { lastId: 2, epochType: 'select' }, label: 'Email 2' },
                ]);
            }
            return Promise.resolve([]);
        };

        it('should validate radio with valid value and nested fields', async () => {
            const result = await validateForman(
                { __type: 'select', select: { lastId: 1, epochType: 'select' } },
                radioSchema,
                { resolveRemote },
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should validate radio with value that has no nested', async () => {
            const result = await validateForman({ __type: 'all' }, radioSchema, { resolveRemote });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject invalid radio value', async () => {
            const result = await validateForman({ __type: 'invalid' }, radioSchema, { resolveRemote });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: "Value 'invalid' not found in options." }),
            ]);
        });

        it('should reject missing required nested field', async () => {
            const result = await validateForman({ __type: 'date' }, radioSchema, { resolveRemote });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([expect.objectContaining({ message: 'Field is mandatory.' })]);
        });
    });
});
