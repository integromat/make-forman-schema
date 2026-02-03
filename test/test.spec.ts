import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { type FormanSchemaField, toFormanSchema, toJSONSchema } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('Forman Schema', () => {
    const formanMock = JSON.parse(readFileSync('./test/mocks/forman.json').toString());

    let formanSchema: FormanSchemaField;
    let jsonSchema: JSONSchema7;

    it('Forman Schema -> JSON Schema', async () => {
        formanSchema = {
            name: 'wrapper',
            type: 'collection',
            spec: formanMock,
        };
        jsonSchema = toJSONSchema(formanSchema);

        expect(jsonSchema).toEqual({
            properties: {
                array_of_arrays: {
                    description: 'description',
                    items: {
                        items: {
                            type: 'string',
                        },
                        type: 'array',
                    },
                    type: 'array',
                },
                array_of_collections: {
                    description: 'description',
                    properties: {
                        number: {
                            type: 'number',
                        },
                    },
                    required: [],
                    type: 'object',
                },
                boolean: {
                    type: 'boolean',
                },
                collection: {
                    description: 'description',
                    properties: {
                        text: {
                            type: 'string',
                        },
                    },
                    required: [],
                    type: 'object',
                },
                date: {
                    description: 'description',
                    type: 'string',
                },
                dynamicCollection: {
                    properties: {},
                    required: [],
                    title: 'Dynamic Collection',
                    type: 'object',
                },
                json: {
                    description: 'description',
                    type: 'string',
                },
                number: {
                    default: 15,
                    description: 'required + default',
                    type: 'number',
                },
                text: {
                    type: 'string',
                },
                editor: {
                    type: 'string',
                },
                primitive_array: {
                    description: 'description',
                    items: {
                        type: 'string',
                    },
                    type: 'array',
                },
                select: {
                    title: 'Select',
                    enum: ['option 1', 'option 2'],
                    type: 'string',
                },
                any: {
                    title: 'Any',
                    description: 'description',
                },
                filter: {
                    items: {
                        items: {
                            oneOf: [
                                {
                                    properties: {
                                        a: {
                                            type: ['null', 'boolean', 'number', 'string'],
                                        },
                                        o: {
                                            enum: ['exist', 'notexist'],
                                        },
                                    },
                                    required: ['a', 'o'],
                                    type: 'object',
                                },
                                {
                                    properties: {
                                        a: {
                                            type: ['null', 'boolean', 'number', 'string'],
                                        },
                                        b: {
                                            type: ['null', 'boolean', 'number', 'string'],
                                        },
                                        o: {
                                            enum: [
                                                'text:equal',
                                                'text:equal:ci',
                                                'text:notequal',
                                                'text:notequal:ci',
                                                'text:contain',
                                                'text:contain:ci',
                                                'text:notcontain',
                                                'text:notcontain:ci',
                                                'text:startwith',
                                                'text:startwith:ci',
                                                'text:notstartwith',
                                                'text:notstartwith:ci',
                                                'text:endwith',
                                                'text:endwith:ci',
                                                'text:notendwith',
                                                'text:notendwith:ci',
                                                'text:pattern',
                                                'text:pattern:ci',
                                                'text:notpattern',
                                                'text:notpattern:ci',
                                                'number:equal',
                                                'number:notequal',
                                                'number:greater',
                                                'number:less',
                                                'number:greaterorequal',
                                                'number:lessorequal',
                                                'date:equal',
                                                'date:notequal',
                                                'date:greater',
                                                'date:less',
                                                'date:greaterorequal',
                                                'date:lessorequal',
                                                'time:equal',
                                                'time:notequal',
                                                'time:greater',
                                                'time:less',
                                                'time:greaterorequal',
                                                'time:lessorequal',
                                                'semver:equal',
                                                'semver:notequal',
                                                'semver:greater',
                                                'semver:less',
                                                'semver:greaterorequal',
                                                'semver:lessorequal',
                                                'array:contain',
                                                'array:contain:ci',
                                                'array:notcontain',
                                                'array:notcontain:ci',
                                                'array:equal',
                                                'array:notequal',
                                                'array:greater',
                                                'array:less',
                                                'array:greaterorequal',
                                                'array:lessorequal',
                                                'boolean:equal',
                                                'boolean:notequal',
                                            ],
                                        },
                                    },
                                    required: ['a', 'b', 'o'],
                                    type: 'object',
                                },
                            ],
                        },
                        type: 'array',
                    },
                    title: 'Filter',
                    type: 'array',
                    'x-filter': 'default',
                },
                flatFilter: {
                    items: {
                        oneOf: [
                            {
                                properties: {
                                    a: {
                                        type: ['null', 'boolean', 'number', 'string'],
                                    },
                                    o: {
                                        enum: ['exist', 'notexist'],
                                    },
                                },
                                required: ['a', 'o'],
                                type: 'object',
                            },
                            {
                                properties: {
                                    a: {
                                        type: ['null', 'boolean', 'number', 'string'],
                                    },
                                    b: {
                                        type: ['null', 'boolean', 'number', 'string'],
                                    },
                                    o: {
                                        enum: [
                                            'text:equal',
                                            'text:equal:ci',
                                            'text:notequal',
                                            'text:notequal:ci',
                                            'text:contain',
                                            'text:contain:ci',
                                            'text:notcontain',
                                            'text:notcontain:ci',
                                            'text:startwith',
                                            'text:startwith:ci',
                                            'text:notstartwith',
                                            'text:notstartwith:ci',
                                            'text:endwith',
                                            'text:endwith:ci',
                                            'text:notendwith',
                                            'text:notendwith:ci',
                                            'text:pattern',
                                            'text:pattern:ci',
                                            'text:notpattern',
                                            'text:notpattern:ci',
                                            'number:equal',
                                            'number:notequal',
                                            'number:greater',
                                            'number:less',
                                            'number:greaterorequal',
                                            'number:lessorequal',
                                            'date:equal',
                                            'date:notequal',
                                            'date:greater',
                                            'date:less',
                                            'date:greaterorequal',
                                            'date:lessorequal',
                                            'time:equal',
                                            'time:notequal',
                                            'time:greater',
                                            'time:less',
                                            'time:greaterorequal',
                                            'time:lessorequal',
                                            'semver:equal',
                                            'semver:notequal',
                                            'semver:greater',
                                            'semver:less',
                                            'semver:greaterorequal',
                                            'semver:lessorequal',
                                            'array:contain',
                                            'array:contain:ci',
                                            'array:notcontain',
                                            'array:notcontain:ci',
                                            'array:equal',
                                            'array:notequal',
                                            'array:greater',
                                            'array:less',
                                            'array:greaterorequal',
                                            'array:lessorequal',
                                            'boolean:equal',
                                            'boolean:notequal',
                                        ],
                                    },
                                },
                                required: ['a', 'b', 'o'],
                                type: 'object',
                            },
                        ],
                    },
                    title: 'Flat Filter',
                    type: 'array',
                    'x-filter': 'and',
                },
                reversedFilter: {
                    items: {
                        items: {
                            oneOf: [
                                {
                                    properties: {
                                        a: {
                                            type: ['null', 'boolean', 'number', 'string'],
                                        },
                                        o: {
                                            enum: ['exist', 'notexist'],
                                        },
                                    },
                                    required: ['a', 'o'],
                                    type: 'object',
                                },
                                {
                                    properties: {
                                        a: {
                                            type: ['null', 'boolean', 'number', 'string'],
                                        },
                                        b: {
                                            type: ['null', 'boolean', 'number', 'string'],
                                        },
                                        o: {
                                            enum: [
                                                'text:equal',
                                                'text:equal:ci',
                                                'text:notequal',
                                                'text:notequal:ci',
                                                'text:contain',
                                                'text:contain:ci',
                                                'text:notcontain',
                                                'text:notcontain:ci',
                                                'text:startwith',
                                                'text:startwith:ci',
                                                'text:notstartwith',
                                                'text:notstartwith:ci',
                                                'text:endwith',
                                                'text:endwith:ci',
                                                'text:notendwith',
                                                'text:notendwith:ci',
                                                'text:pattern',
                                                'text:pattern:ci',
                                                'text:notpattern',
                                                'text:notpattern:ci',
                                                'number:equal',
                                                'number:notequal',
                                                'number:greater',
                                                'number:less',
                                                'number:greaterorequal',
                                                'number:lessorequal',
                                                'date:equal',
                                                'date:notequal',
                                                'date:greater',
                                                'date:less',
                                                'date:greaterorequal',
                                                'date:lessorequal',
                                                'time:equal',
                                                'time:notequal',
                                                'time:greater',
                                                'time:less',
                                                'time:greaterorequal',
                                                'time:lessorequal',
                                                'semver:equal',
                                                'semver:notequal',
                                                'semver:greater',
                                                'semver:less',
                                                'semver:greaterorequal',
                                                'semver:lessorequal',
                                                'array:contain',
                                                'array:contain:ci',
                                                'array:notcontain',
                                                'array:notcontain:ci',
                                                'array:equal',
                                                'array:notequal',
                                                'array:greater',
                                                'array:less',
                                                'array:greaterorequal',
                                                'array:lessorequal',
                                                'boolean:equal',
                                                'boolean:notequal',
                                            ],
                                        },
                                    },
                                    required: ['a', 'b', 'o'],
                                    type: 'object',
                                },
                            ],
                        },
                        type: 'array',
                    },
                    title: 'Reversed Filter',
                    type: 'array',
                    'x-filter': 'reverse',
                },
                file: {
                    title: 'File',
                    type: 'string',
                    'x-fetch': 'rpc://get-files',
                    'x-path-selector': 'file',
                    'x-path-show-root': true,
                    'x-path-single-level': false,
                },
                folder: {
                    title: 'Folder',
                    type: 'string',
                    'x-fetch': 'rpc://get-folders',
                    'x-path-selector': 'folder',
                    'x-path-show-root': false,
                    'x-path-single-level': true,
                },
            },
            required: ['number'],
            type: 'object',
        });
    });

    it('JSON Schema -> Forman Schema', async () => {
        expect(toFormanSchema(jsonSchema)).toEqual({
            type: 'collection',
            spec: [
                {
                    type: 'array',
                    help: 'description',
                    spec: {
                        type: 'text',
                    },
                    name: 'primitive_array',
                    required: false,
                },
                {
                    type: 'array',
                    help: 'description',
                    spec: {
                        type: 'array',
                        spec: {
                            type: 'text',
                        },
                    },
                    name: 'array_of_arrays',
                    required: false,
                },
                {
                    type: 'collection',
                    help: 'description',
                    spec: [
                        {
                            type: 'number',
                            name: 'number',
                            required: false,
                        },
                    ],
                    name: 'array_of_collections',
                    required: false,
                },
                {
                    type: 'collection',
                    help: 'description',
                    spec: [
                        {
                            type: 'text',
                            name: 'text',
                            required: false,
                        },
                    ],
                    name: 'collection',
                    required: false,
                },
                {
                    type: 'text',
                    help: 'description',
                    name: 'date',
                    required: false,
                },
                {
                    type: 'number',
                    help: 'required + default',
                    default: 15,
                    name: 'number',
                    required: true,
                },
                {
                    type: 'text',
                    name: 'text',
                    required: false,
                },
                {
                    type: 'text',
                    name: 'editor',
                    required: false,
                },
                {
                    type: 'boolean',
                    name: 'boolean',
                    required: false,
                },
                {
                    label: 'Select',
                    type: 'select',
                    options: [
                        {
                            value: 'option 1',
                        },
                        {
                            value: 'option 2',
                        },
                    ],
                    name: 'select',
                    required: false,
                },
                {
                    type: 'text',
                    help: 'description',
                    name: 'json',
                    required: false,
                },
                {
                    help: 'description',
                    name: 'any',
                    type: 'any',
                    label: 'Any',
                    required: false,
                },
                {
                    label: 'Dynamic Collection',
                    name: 'dynamicCollection',
                    required: false,
                    type: 'dynamicCollection',
                },
                {
                    label: 'Filter',
                    name: 'filter',
                    required: false,
                    type: 'filter',
                },
                {
                    label: 'Flat Filter',
                    logic: 'and',
                    name: 'flatFilter',
                    required: false,
                    type: 'filter',
                },
                {
                    label: 'Reversed Filter',
                    logic: 'reverse',
                    name: 'reversedFilter',
                    required: false,
                    type: 'filter',
                },
                {
                    label: 'Folder',
                    name: 'folder',
                    options: {
                        showRoot: false,
                        singleLevel: true,
                        store: 'rpc://get-folders',
                    },
                    required: false,
                    type: 'folder',
                },
                {
                    label: 'File',
                    name: 'file',
                    options: {
                        showRoot: true,
                        singleLevel: false,
                        store: 'rpc://get-files',
                    },
                    required: false,
                    type: 'file',
                },
            ],
        });
    });
});
