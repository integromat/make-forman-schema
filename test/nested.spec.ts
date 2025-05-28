import { describe, expect, it } from '@jest/globals';
import { toJSONSchema } from '../src/index.js';

describe('Forman Nested', () => {
    it('Forman Schema -> JSON Schema #1 (nested form in each option)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    help: 'Field description',
                    name: 'connection',
                    type: 'select',
                    label: 'Connection',
                    required: true,
                    options: [
                        {
                            value: 'apple',
                            label: 'Apple',
                            nested: [
                                {
                                    name: 'folder',
                                    type: 'text',
                                    label: 'Folder',
                                    required: true,
                                },
                            ],
                        },
                        {
                            value: 'google',
                            label: 'Google',
                            nested: [
                                {
                                    name: 'file',
                                    type: 'text',
                                    label: 'File',
                                    required: true,
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                connection: {
                    title: 'Connection',
                    description: 'Field description',
                    type: 'string',
                    oneOf: [
                        {
                            title: 'Apple',
                            const: 'apple',
                        },
                        {
                            title: 'Google',
                            const: 'google',
                        },
                    ],
                },
            },
            required: ['connection'],
            type: 'object',
            allOf: [
                {
                    if: {
                        properties: {
                            connection: { const: 'apple' },
                        },
                    },
                    then: {
                        properties: {
                            folder: {
                                title: 'Folder',
                                type: 'string',
                            },
                        },
                        required: ['folder'],
                        type: 'object',
                    },
                },
                {
                    if: {
                        properties: {
                            connection: { const: 'google' },
                        },
                    },
                    then: {
                        properties: {
                            file: {
                                title: 'File',
                                type: 'string',
                            },
                        },
                        required: ['file'],
                        type: 'object',
                    },
                },
            ],
        });
    });

    it('Forman Schema -> JSON Schema #2 (nested form in each option)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    help: 'Field description',
                    name: 'connection',
                    type: 'select',
                    label: 'Connection',
                    required: true,
                    options: [
                        {
                            value: 'apple',
                            label: 'Apple',
                            nested: {
                                store: [
                                    {
                                        name: 'folder',
                                        type: 'text',
                                        label: 'Folder',
                                        required: true,
                                    },
                                ],
                            },
                        },
                    ],
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                connection: {
                    title: 'Connection',
                    description: 'Field description',
                    type: 'string',
                    oneOf: [
                        {
                            title: 'Apple',
                            const: 'apple',
                        },
                    ],
                },
            },
            required: ['connection'],
            type: 'object',
            allOf: [
                {
                    if: {
                        properties: {
                            connection: { const: 'apple' },
                        },
                    },
                    then: {
                        properties: {
                            folder: {
                                title: 'Folder',
                                type: 'string',
                            },
                        },
                        required: ['folder'],
                        type: 'object',
                    },
                },
            ],
        });
    });

    it('Forman Schema -> JSON Schema #3 (nested form in select with dynamic options)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    help: 'Field description',
                    name: 'connection',
                    type: 'select',
                    label: 'Connection',
                    required: true,
                    options: {
                        store: 'rpc://function',
                        nested: [
                            {
                                name: 'folder',
                                type: 'text',
                                label: 'Folder',
                                required: true,
                            },
                        ],
                    },
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                connection: {
                    title: 'Connection',
                    description: 'Field description',
                    type: 'string',
                    'x-fetch': 'rpc://function',
                    'x-nested': {
                        properties: {
                            folder: {
                                title: 'Folder',
                                type: 'string',
                            },
                        },
                        required: ['folder'],
                        type: 'object',
                    },
                },
            },
            required: ['connection'],
            type: 'object',
        });
    });

    it('Forman Schema -> JSON Schema #4 (nested form in select with dynamic options)', async () => {
        const formanSchema = {
            type: 'collection',
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
                            store: [
                                {
                                    name: 'folder',
                                    type: 'text',
                                    label: 'Folder',
                                    required: true,
                                },
                            ],
                        },
                    },
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                connection: {
                    title: 'Connection',
                    description: 'Field description',
                    type: 'string',
                    'x-fetch': 'rpc://function',
                    'x-nested': {
                        properties: {
                            folder: {
                                title: 'Folder',
                                type: 'string',
                            },
                        },
                        required: ['folder'],
                        type: 'object',
                    },
                },
            },
            required: ['connection'],
            type: 'object',
        });
    });

    it('Forman Schema -> JSON Schema #5 (dynamic nested form in each option)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    help: 'Field description',
                    name: 'connection',
                    type: 'select',
                    label: 'Connection',
                    required: true,
                    options: [
                        {
                            value: 'apple',
                            label: 'Apple',
                            nested: 'rpc://function1',
                        },
                        {
                            value: 'google',
                            label: 'Google',
                            nested: 'rpc://function2?param=value',
                        },
                    ],
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                connection: {
                    title: 'Connection',
                    description: 'Field description',
                    type: 'string',
                    oneOf: [
                        {
                            title: 'Apple',
                            const: 'apple',
                        },
                        {
                            title: 'Google',
                            const: 'google',
                        },
                    ],
                },
            },
            required: ['connection'],
            type: 'object',
            allOf: [
                {
                    if: {
                        properties: {
                            connection: { const: 'apple' },
                        },
                    },
                    then: {
                        $ref: 'rpc://function1?connection={{connection}}',
                    },
                },
                {
                    if: {
                        properties: {
                            connection: { const: 'google' },
                        },
                    },
                    then: {
                        $ref: 'rpc://function2?param=value&connection={{connection}}',
                    },
                },
            ],
        });
    });

    it('Forman Schema -> JSON Schema #6 (dynamic nested form in select)', async () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    help: 'Field description',
                    name: 'connection',
                    type: 'select',
                    label: 'Connection',
                    required: true,
                    options: {
                        store: 'rpc://function1?param=value',
                        nested: 'rpc://function2',
                    },
                },
            ],
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                connection: {
                    title: 'Connection',
                    description: 'Field description',
                    type: 'string',
                    'x-fetch': 'rpc://function1?param=value',
                    'x-nested': {
                        $ref: 'rpc://function2?connection={{connection}}',
                    },
                },
            },
            required: ['connection'],
            type: 'object',
        });
    });

    it('Forman Schema -> JSON Schema #7 (nested form with dynamic select in select with dynamic options)', async () => {
        const formanSchema = {
            type: 'collection',
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
        };

        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                connection: {
                    title: 'Connection',
                    description: 'Field description',
                    type: 'string',
                    'x-fetch': 'rpc://function',
                    'x-nested': {
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
            },
            required: ['connection'],
            type: 'object',
        });
    });
});
