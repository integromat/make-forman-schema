import { describe, expect, it } from '@jest/globals';
import { toJSONSchema } from '../../src';

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
});
