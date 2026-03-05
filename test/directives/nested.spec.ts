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
                        store: [{ name: 'nestedField', type: 'number', label: 'Nested Field' }],
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

        it('should handle RPC returning null for nested fields', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'myField',
                    type: 'text',
                    label: 'My Field',
                    nested: 'rpc://RpcNull',
                },
            ];
            const resolveRemote = (): Promise<unknown> => Promise.resolve(null);
            const result = await validateForman({ myField: 'hello' }, schema, { resolveRemote });
            expect(result.valid).toBe(true);
        });

        it('should handle RPC returning a primitive for nested fields', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'myField',
                    type: 'text',
                    label: 'My Field',
                    nested: 'rpc://RpcPrimitive',
                },
            ];
            const resolveRemote = (): Promise<unknown> => Promise.resolve('some string');
            const result = await validateForman({ myField: 'hello' }, schema, { resolveRemote });
            expect(result.valid).toBe(true);
        });
    });

    describe('IML expression with nested fields', () => {
        const resolveRemote = (path: string): Promise<unknown> => {
            if (path === 'rpc://renderFields') {
                return Promise.resolve([
                    {
                        name: 'dynamicallyRenderedField',
                        type: 'text',
                        label: 'Dynamic Field',
                        required: true,
                    },
                ]);
            }
            return Promise.resolve([]);
        };

        it('should expand nested fields on text field with IML value', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'input',
                    type: 'text',
                    label: 'Input',
                    nested: 'rpc://renderFields',
                },
            ];

            const result = await validateForman(
                { input: '{{2.value}}', dynamicallyRenderedField: 'aaa' },
                schema,
                { resolveRemote },
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should report missing required nested field with IML value', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'input',
                    type: 'text',
                    label: 'Input',
                    nested: 'rpc://renderFields',
                },
            ];

            const result = await validateForman(
                { input: '{{2.value}}' },
                schema,
                { resolveRemote },
            );
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: 'Field is mandatory.' }),
            ]);
        });

        it('should expand nested fields on select field with IML value', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'mySelect',
                    type: 'select',
                    label: 'My Select',
                    options: {
                        store: [
                            { value: 'a', label: 'A' },
                            { value: 'b', label: 'B' },
                        ],
                        nested: 'rpc://renderFields',
                    },
                },
            ];

            const result = await validateForman(
                { mySelect: '{{2.value}}', dynamicallyRenderedField: 'aaa' },
                schema,
                { resolveRemote },
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should flag unknown field alongside IML + nested', async () => {
            const schema: FormanSchemaField[] = [
                {
                    name: 'input',
                    type: 'text',
                    label: 'Input',
                    nested: 'rpc://renderFields',
                },
            ];

            const result = await validateForman(
                { input: '{{2.value}}', dynamicallyRenderedField: 'aaa', unknownField: 'bad' },
                schema,
                { resolveRemote, strict: true },
            );
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: expect.stringContaining('Unknown field') }),
            ]);
        });
    });

    describe('select with boolean store and RPC nested', () => {
        const formanSchema: FormanSchemaField[] = [
            {
                name: 'booleanSelect',
                type: 'select',
                label: 'Boolean Select',
                options: {
                    store: [
                        { value: true, label: 'TRUE' },
                        { value: false, label: 'FALSE' },
                    ],
                    nested: 'rpc://renderFields',
                },
            },
            {
                name: 'mergedSelect',
                type: 'select',
                label: 'Merged Select',
                options: {
                    store: [
                        { value: true, label: 'TRUE' },
                        { value: false, label: 'FALSE' },
                    ],
                    nested: 'rpc://renderFields?mergedSelect=false',
                },
            },
        ];

        it('should convert to JSON schema', () => {
            const jsonSchema = toJSONSchema({
                type: 'collection',
                spec: formanSchema,
            });
            expect(jsonSchema).toEqual({
                type: 'object',
                properties: {
                    booleanSelect: {
                        title: 'Boolean Select',
                        type: 'string',
                        oneOf: [
                            { title: 'TRUE', const: true },
                            { title: 'FALSE', const: false },
                        ],
                        'x-nested': {
                            $ref: 'rpc://renderFields?booleanSelect={{booleanSelect}}',
                        },
                    },
                    mergedSelect: {
                        title: 'Merged Select',
                        type: 'string',
                        oneOf: [
                            { title: 'TRUE', const: true },
                            { title: 'FALSE', const: false },
                        ],
                        'x-nested': {
                            $ref: 'rpc://renderFields?mergedSelect=false',
                        },
                    },
                },
                required: [],
                allOf: [
                    {
                        if: { properties: { booleanSelect: { const: true } } },
                        then: { $ref: 'rpc://renderFields?booleanSelect={{booleanSelect}}' },
                    },
                    {
                        if: { properties: { booleanSelect: { const: false } } },
                        then: { $ref: 'rpc://renderFields?booleanSelect={{booleanSelect}}' },
                    },
                    {
                        if: { properties: { mergedSelect: { const: true } } },
                        then: { $ref: 'rpc://renderFields?mergedSelect=false' },
                    },
                    {
                        if: { properties: { mergedSelect: { const: false } } },
                        then: { $ref: 'rpc://renderFields?mergedSelect=false' },
                    },
                ],
            });
        });
    });
});
