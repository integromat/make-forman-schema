import { describe, expect, it } from '@jest/globals';
import { FormanSchemaField, toJSONSchema, validateForman } from '../../src';

describe('Nested', () => {
    describe('nested fields under primitive types', () => {
        const formanSchema: FormanSchemaField[] = [
            {
                name: 'nestedText',
                type: 'text',
                required: true,
                label: 'Nested Text',
                nested: [
                    {
                        name: 'nestedNumber',
                        label: 'Nested Number',
                        type: 'number',
                        required: true,
                    },
                ],
            },
            {
                name: 'nestedBoolean',
                type: 'boolean',
                label: 'Nested Boolean',
                nested: 'rpc://renderFields',
            },
            {
                name: 'nestedSelect',
                type: 'select',
                label: 'Nested Select',
                options: {
                    store: 'rpc://dropdownExplorer',
                    nested: 'rpc://renderFields',
                },
            },
        ];

        it('should convert to JSON schema', () => {
            const jsonSchema = toJSONSchema({
                type: 'collection',
                spec: formanSchema,
            });
            expect(jsonSchema).toEqual({
                properties: {
                    nestedBoolean: {
                        title: 'Nested Boolean',
                        type: 'boolean',
                        'x-nested': {
                            $ref: 'rpc://renderFields?nestedBoolean={{nestedBoolean}}',
                        },
                    },
                    nestedSelect: {
                        title: 'Nested Select',
                        type: 'string',
                        'x-fetch': 'rpc://dropdownExplorer',
                        'x-nested': {
                            $ref: 'rpc://renderFields?nestedSelect={{nestedSelect}}',
                        },
                    },
                    nestedText: {
                        title: 'Nested Text',
                        type: 'string',
                        'x-nested': {
                            properties: {
                                nestedNumber: {
                                    title: 'Nested Number',
                                    type: 'number',
                                },
                            },
                            required: ['nestedNumber'],
                            type: 'object',
                        },
                    },
                },
                required: ['nestedText'],
                type: 'object',
            });
        });

        it('should validate values', async () => {
            const result = await validateForman(
                {
                    nestedText: 'Hello',
                    nestedNumber: 1,
                    nestedBoolean: true,
                    nestedBooleanField: 'I am here',
                    nestedSelect: 'option1',
                    nestedSelectField: 'I am here too',
                },
                formanSchema,
                {
                    resolveRemote(path: string, data: Record<string, unknown>): Promise<unknown> {
                        if (path === 'rpc://renderFields') {
                            if (data.nestedBoolean !== undefined) {
                                return Promise.resolve([
                                    {
                                        name: 'nestedBooleanField',
                                        type: 'text',
                                        label: 'Nested Boolean Field',
                                        required: true,
                                    },
                                ]);
                            }
                            if (data.nestedSelect !== undefined) {
                                return Promise.resolve([
                                    {
                                        name: 'nestedSelectField',
                                        type: 'text',
                                        label: 'Nested Select Field',
                                        required: true,
                                    },
                                ]);
                            }
                        }
                        if (path === 'rpc://dropdownExplorer') {
                            return Promise.resolve([
                                { value: 'option1', label: 'Option 1' },
                                { value: 'option2', label: 'Option 2' },
                            ]);
                        }
                        return Promise.resolve([]);
                    },
                },
            );
            expect(result).toEqual({
                valid: true,
                errors: [],
            });
        });
    });
});
