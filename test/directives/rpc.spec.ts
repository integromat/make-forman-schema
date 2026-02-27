import { describe, expect, it } from '@jest/globals';
import { toFormanSchema, toJSONSchema, validateForman, FormanSchemaField } from '../../src';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

describe('RPC', () => {
    it('should embed RPC directive into the primitive type schema', () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    name: 'parent',
                    type: 'select',
                    label: 'Parent',
                    options: [
                        {
                            value: 'show',
                            label: 'Show',
                            nested: [
                                {
                                    type: 'select',
                                    options: {
                                        store: 'rpc://searchEntries',
                                    },
                                    label: 'Select',
                                    name: 'select',
                                    rpc: {
                                        parameters: [
                                            {
                                                name: 'color',
                                                label: 'Color',
                                                type: 'text',
                                            },
                                        ],
                                        url: 'rpc://searchEntries?more=true',
                                    },
                                },
                                {
                                    type: 'text',
                                    label: 'Text',
                                    name: 'text',
                                    rpc: {
                                        label: 'Search',
                                        parameters: [
                                            {
                                                name: 'color',
                                                label: 'Color',
                                                type: 'text',
                                            },
                                        ],
                                        url: 'rpc://searchEntries?more=true',
                                    },
                                },
                                {
                                    type: 'text',
                                    label: 'Text Dynamic',
                                    name: 'textDynamic',
                                    rpc: {
                                        label: 'Search',
                                        parameters: 'rpc://searchInput',
                                        url: 'rpc://searchEntries?more=true',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            allOf: [
                {
                    if: {
                        properties: {
                            parent: {
                                const: 'show',
                            },
                        },
                    },
                    then: {
                        properties: {
                            select: {
                                title: 'Select',
                                type: 'string',
                                'x-fetch': 'rpc://searchEntries?parent={{parent}}',
                                'x-search': {
                                    inputSchema: {
                                        properties: {
                                            color: {
                                                title: 'Color',
                                                type: 'string',
                                            },
                                        },
                                        required: [],
                                        type: 'object',
                                    },
                                    url: 'rpc://searchEntries?more=true&parent={{parent}}',
                                },
                            },
                            text: {
                                title: 'Text',
                                type: 'string',
                                'x-search': {
                                    inputSchema: {
                                        properties: {
                                            color: {
                                                title: 'Color',
                                                type: 'string',
                                            },
                                        },
                                        required: [],
                                        type: 'object',
                                    },
                                    label: 'Search',
                                    url: 'rpc://searchEntries?more=true&parent={{parent}}',
                                },
                            },
                            textDynamic: {
                                title: 'Text Dynamic',
                                type: 'string',
                                'x-search': {
                                    inputSchema: {
                                        $ref: 'rpc://searchInput',
                                    },
                                    label: 'Search',
                                    url: 'rpc://searchEntries?more=true&parent={{parent}}',
                                },
                            },
                        },
                        required: [],
                        type: 'object',
                    },
                },
            ],
            properties: {
                parent: {
                    oneOf: [
                        {
                            const: 'show',
                            title: 'Show',
                        },
                    ],
                    title: 'Parent',
                    type: 'string',
                },
            },
            required: [],
            type: 'object',
        });
    });
    it('should reverse convert RPC directive from JSON Schema to Forman Schema', () => {
        const jsonSchema = {
            properties: {
                select: {
                    title: 'Select',
                    type: 'string',
                    'x-fetch': 'rpc://searchEntries?parent={{parent}}',
                    'x-search': {
                        inputSchema: {
                            properties: {
                                color: {
                                    title: 'Color',
                                    type: 'string',
                                },
                            },
                            required: [],
                            type: 'object',
                        },
                        url: 'rpc://searchEntries?more=true&parent={{parent}}',
                    },
                },
                text: {
                    title: 'Text',
                    type: 'string',
                    'x-search': {
                        inputSchema: {
                            properties: {
                                color: {
                                    title: 'Color',
                                    type: 'string',
                                },
                            },
                            required: [],
                            type: 'object',
                        },
                        label: 'Search',
                        url: 'rpc://searchEntries?more=true&parent={{parent}}',
                    },
                },
                textDynamic: {
                    title: 'Text Dynamic',
                    type: 'string',
                    'x-search': {
                        inputSchema: {
                            $ref: 'rpc://searchInput',
                        },
                        label: 'Search',
                        url: 'rpc://searchEntries?more=true&parent={{parent}}',
                    },
                },
            },
            required: [],
            type: 'object',
        } as JSONSchema7;
        const formanSchema = toFormanSchema(jsonSchema);
        expect(formanSchema).toEqual({
            spec: [
                {
                    label: 'Select',
                    name: 'select',
                    required: false,
                    rpc: {
                        parameters: [
                            {
                                label: 'Color',
                                name: 'color',
                                required: false,
                                type: 'text',
                            },
                        ],
                        url: 'rpc://searchEntries?more=true&parent={{parent}}',
                    },
                    type: 'text',
                },
                {
                    label: 'Text',
                    name: 'text',
                    required: false,
                    rpc: {
                        parameters: [
                            {
                                label: 'Color',
                                name: 'color',
                                required: false,
                                type: 'text',
                            },
                        ],
                        label: 'Search',
                        url: 'rpc://searchEntries?more=true&parent={{parent}}',
                    },
                    type: 'text',
                },
                {
                    label: 'Text Dynamic',
                    name: 'textDynamic',
                    required: false,
                    rpc: {
                        parameters: 'rpc://searchInput',
                        label: 'Search',
                        url: 'rpc://searchEntries?more=true&parent={{parent}}',
                    },
                    type: 'text',
                },
            ],
            type: 'collection',
        });
    });

    it('should handle RPC returning a single object instead of array for select options', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'mySelect',
                type: 'select',
                label: 'My Select',
                options: 'rpc://RpcSingleOption',
            },
        ];
        const result = await validateForman({ mySelect: 'a' }, schema, {
            resolveRemote(): Promise<unknown> {
                return Promise.resolve({ value: 'a', label: 'Option A' });
            },
        });
        expect(result.valid).toBe(true);
    });

    it('should reject RPC returning null for select options', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'mySelect',
                type: 'select',
                label: 'My Select',
                options: 'rpc://RpcNull',
            },
        ];
        const result = await validateForman({ mySelect: 'a' }, schema, {
            resolveRemote(): Promise<unknown> {
                return Promise.resolve(null);
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.message).toContain('returned no data');
    });

    it('should reject RPC returning undefined for select options', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'mySelect',
                type: 'select',
                label: 'My Select',
                options: 'rpc://RpcUndefined',
            },
        ];
        const result = await validateForman({ mySelect: 'a' }, schema, {
            resolveRemote(): Promise<unknown> {
                return Promise.resolve(undefined);
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.message).toContain('returned no data');
    });

    it('should reject RPC returning a primitive string for select options', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'mySelect',
                type: 'select',
                label: 'My Select',
                options: 'rpc://RpcPrimitive',
            },
        ];
        const result = await validateForman({ mySelect: 'a' }, schema, {
            resolveRemote(): Promise<unknown> {
                return Promise.resolve('some string');
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.message).toContain('returned no data');
    });
});
