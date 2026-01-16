import { describe, expect, it } from '@jest/globals';
import { toJSONSchema } from '../src/index.js';

describe('Forman Domains', () => {
    it('Forman Schema -> JSON Schema #1 (static nested form in select)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    name: 'parameters',
                    type: 'collection',
                    required: true,
                    spec: [
                        {
                            help: 'Field description',
                            name: 'connection',
                            type: 'select',
                            label: 'Connection',
                            required: true,
                            options: {
                                store: 'rpc://function',
                                nested: {
                                    domain: 'expect',
                                    store: [
                                        {
                                            name: 'folder',
                                            type: 'select',
                                            label: 'Folder',
                                            options: 'rpc://nestedFunction',
                                            required: true,
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
                {
                    name: 'mapper',
                    type: 'collection',
                    required: true,
                    'x-domain-root': 'expect',
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                parameters: {
                    properties: {
                        connection: {
                            title: 'Connection',
                            description: 'Field description',
                            type: 'string',
                            'x-fetch': 'rpc://function',
                        },
                    },
                    required: ['connection'],
                    type: 'object',
                },
                mapper: {
                    properties: {
                        folder: {
                            title: 'Folder',
                            type: 'string',
                            'x-fetch': 'rpc://nestedFunction?connection={{connection}}',
                        },
                    },
                    required: ['folder'],
                    type: 'object',
                },
            },
            required: ['parameters', 'mapper'],
            type: 'object',
        });
    });

    it('Forman Schema -> JSON Schema #2 (dynamic nested form in select)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    name: 'parameters',
                    type: 'collection',
                    required: true,
                    spec: [
                        {
                            help: 'Field description',
                            name: 'connection',
                            type: 'select',
                            label: 'Connection',
                            required: true,
                            options: {
                                store: 'rpc://function',
                                nested: {
                                    domain: 'expect',
                                    store: ['rpc://function2'],
                                },
                            },
                        },
                    ],
                },
                {
                    name: 'mapper',
                    type: 'collection',
                    required: true,
                    'x-domain-root': 'expect',
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                parameters: {
                    properties: {
                        connection: {
                            title: 'Connection',
                            description: 'Field description',
                            type: 'string',
                            'x-fetch': 'rpc://function',
                        },
                    },
                    required: ['connection'],
                    type: 'object',
                },
                mapper: {
                    properties: {},
                    required: [],
                    type: 'object',
                    allOf: [
                        {
                            $ref: 'rpc://function2?connection={{connection}}',
                        },
                    ],
                },
            },
            required: ['parameters', 'mapper'],
            type: 'object',
        });
    });

    it('Forman Schema -> JSON Schema #3 (multiple dynamic nested forms in select)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    name: 'parameters',
                    type: 'collection',
                    required: true,
                    spec: [
                        {
                            help: 'Field description',
                            name: 'connection',
                            type: 'select',
                            label: 'Connection',
                            required: true,
                            options: {
                                store: 'rpc://function',
                                nested: {
                                    domain: 'expect',
                                    store: [
                                        'rpc://function2',
                                        {
                                            name: 'folder',
                                            type: 'select',
                                            label: 'Folder',
                                            options: 'rpc://nestedFunction',
                                            required: true,
                                        },
                                        'rpc://function3',
                                    ],
                                },
                            },
                        },
                    ],
                },
                {
                    name: 'mapper',
                    type: 'collection',
                    required: true,
                    'x-domain-root': 'expect',
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                parameters: {
                    properties: {
                        connection: {
                            title: 'Connection',
                            description: 'Field description',
                            type: 'string',
                            'x-fetch': 'rpc://function',
                        },
                    },
                    required: ['connection'],
                    type: 'object',
                },
                mapper: {
                    properties: {
                        folder: {
                            title: 'Folder',
                            type: 'string',
                            'x-fetch': 'rpc://nestedFunction?connection={{connection}}',
                        },
                    },
                    required: ['folder'],
                    type: 'object',
                    allOf: [
                        {
                            $ref: 'rpc://function2?connection={{connection}}',
                        },
                        {
                            $ref: 'rpc://function3?connection={{connection}}',
                        },
                    ],
                },
            },
            required: ['parameters', 'mapper'],
            type: 'object',
        });
    });
});
