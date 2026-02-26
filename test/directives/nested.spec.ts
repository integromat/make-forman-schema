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

    describe('extended nested format on primitives', () => {
        describe('same-domain extended nested', () => {
            const formanSchema: FormanSchemaField[] = [
                {
                    name: 'textWithExtendedNested',
                    type: 'text',
                    label: 'Text Field',
                    nested: {
                        store: [
                            { name: 'nestedField', type: 'number', label: 'Nested Field' },
                        ],
                    },
                },
            ];

            it('should unwrap store property and process nested fields inline', () => {
                const jsonSchema = toJSONSchema({
                    type: 'collection',
                    spec: formanSchema,
                });

                const textField = jsonSchema.properties?.textWithExtendedNested as Record<string, unknown>;
                expect(textField).toBeDefined();
                expect(textField['x-nested']).toEqual({
                    description: undefined,
                    properties: {
                        nestedField: {
                            description: undefined,
                            title: 'Nested Field',
                            type: 'number',
                        },
                    },
                    required: [],
                    title: undefined,
                    type: 'object',
                });
            });
        });

        describe('cross-domain extended nested', () => {
            const formanSchema: FormanSchemaField[] = [
                {
                    name: 'parameters',
                    type: 'collection',
                    spec: [
                        {
                            name: 'textWithCrossDomainNested',
                            type: 'text',
                            label: 'Text Field',
                            nested: {
                                store: [
                                    { name: 'expectField1', type: 'text', label: 'Expect Field 1' },
                                    { name: 'expectField2', type: 'number', label: 'Expect Field 2' },
                                ],
                                domain: 'expect',
                            },
                        },
                    ],
                },
                {
                    name: 'mapper',
                    type: 'collection',
                    spec: [],
                    'x-domain-root': 'expect',
                },
            ];

            it('should route nested fields to correct domain root', () => {
                const jsonSchema = toJSONSchema({ type: 'collection', spec: formanSchema });

                // Verify textWithCrossDomainNested has no local x-nested
                const parametersField = jsonSchema.properties?.parameters as Record<string, unknown>;
                const textField = (parametersField?.properties as Record<string, unknown>)
                    ?.textWithCrossDomainNested as Record<string, unknown>;
                expect(textField['x-nested']).toBeUndefined();

                // Verify mapper (domain root) contains the nested fields
                const mapperField = jsonSchema.properties?.mapper as Record<string, unknown>;
                const mapperProperties = mapperField?.properties as Record<string, unknown>;
                expect(mapperProperties?.expectField1).toEqual({
                    title: 'Expect Field 1',
                    type: 'string',
                });
                expect(mapperProperties?.expectField2).toEqual({
                    title: 'Expect Field 2',
                    type: 'number',
                });
            });
        });
    });

    describe('RPC returning a single object instead of array', () => {
        it('should handle RPC returning a single object in nested fields', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'myField',
                    type: 'text',
                    label: 'My Field',
                    nested: 'rpc://RpcHintMessage',
                },
            ];
            const resolveRemote = (): Promise<unknown> =>
                Promise.resolve({ type: 'text', name: 'hint', label: 'Hint', required: true });

            const valid = await validateForman({ myField: 'hello', hint: 'value' }, schema, { resolveRemote });
            expect(valid.valid).toBe(true);

            const invalid = await validateForman({ myField: 'hello' }, schema, { resolveRemote });
            expect(invalid.valid).toBe(false);
        });
    });
});
