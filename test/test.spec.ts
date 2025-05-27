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
            ],
        });
    });
});
