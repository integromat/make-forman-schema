import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';

describe('Forman Schema Extended Validation', () => {
    describe('Validation Rules', () => {
        it('should validate string pattern validation', async () => {
            const formanValue = {
                email: 'invalid-email',
                validEmail: 'test@example.com',
            };

            const formanSchema = [
                {
                    name: 'email',
                    type: 'email',
                    validate: {
                        pattern: '^[^@]+@[^@]+\\.[^@]+$',
                    },
                },
                {
                    name: 'validEmail',
                    type: 'email',
                    validate: {
                        pattern: '^[^@]+@[^@]+\\.[^@]+$',
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'email',
                        message: "Value doesn't match the pattern: ^[^@]+@[^@]+\\.[^@]+$",
                    },
                ],
            });
        });

        it('should validate string pattern with object format', async () => {
            const formanValue = {
                code: 'abc123',
            };

            const formanSchema = [
                {
                    name: 'code',
                    type: 'text',
                    validate: {
                        pattern: {
                            regexp: '^[A-Z]{3}[0-9]{3}$',
                        },
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'code',
                        message: "Value doesn't match the pattern: ^[A-Z]{3}[0-9]{3}$",
                    },
                ],
            });
        });

        it('should validate string length constraints', async () => {
            const formanValue = {
                short: 'ab',
                long: 'this is a very long text that exceeds the maximum length limit',
                valid: 'perfect',
            };

            const formanSchema = [
                {
                    name: 'short',
                    type: 'text',
                    validate: {
                        min: 5,
                    },
                },
                {
                    name: 'long',
                    type: 'text',
                    validate: {
                        max: 20,
                    },
                },
                {
                    name: 'valid',
                    type: 'text',
                    validate: {
                        min: 5,
                        max: 20,
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'short',
                        message: 'Value must be at least 5 characters long.',
                    },
                    {
                        domain: 'default',
                        path: 'long',
                        message: 'Value exceeded maximum length of 20 characters.',
                    },
                ],
            });
        });

        it('should validate enum constraints', async () => {
            const formanValue = {
                status: 'invalid',
                validStatus: 'active',
            };

            const formanSchema = [
                {
                    name: 'status',
                    type: 'text',
                    validate: {
                        enum: ['active', 'inactive', 'pending'],
                    },
                },
                {
                    name: 'validStatus',
                    type: 'text',
                    validate: {
                        enum: ['active', 'inactive', 'pending'],
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'status',
                        message: 'Value must be one of the following: active, inactive, pending',
                    },
                ],
            });
        });

        it('should validate number constraints', async () => {
            const formanValue = {
                tooSmall: 5,
                tooBig: 150,
                valid: 50,
            };

            const formanSchema = [
                {
                    name: 'tooSmall',
                    type: 'number',
                    validate: {
                        min: 10,
                    },
                },
                {
                    name: 'tooBig',
                    type: 'number',
                    validate: {
                        max: 100,
                    },
                },
                {
                    name: 'valid',
                    type: 'number',
                    validate: {
                        min: 10,
                        max: 100,
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'tooSmall',
                        message: 'Value is too small. Minimum value is 10.',
                    },
                    {
                        domain: 'default',
                        path: 'tooBig',
                        message: 'Value is too big. Maximum value is 100.',
                    },
                ],
            });
        });

        it('should validate array items constraints', async () => {
            const formanValue = {
                tooFewItems: ['a'],
                tooManyItems: ['a', 'b', 'c', 'd', 'e', 'f'],
                validArray: ['a', 'b', 'c'],
            };

            const formanSchema = [
                {
                    name: 'tooFewItems',
                    type: 'array',
                    spec: { type: 'text' },
                    validate: {
                        minItems: 2,
                    },
                },
                {
                    name: 'tooManyItems',
                    type: 'array',
                    spec: { type: 'text' },
                    validate: {
                        maxItems: 5,
                    },
                },
                {
                    name: 'validArray',
                    type: 'array',
                    spec: { type: 'text' },
                    validate: {
                        minItems: 2,
                        maxItems: 5,
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'tooFewItems',
                        message: 'Array has less than 2 items.',
                    },
                    {
                        domain: 'default',
                        path: 'tooManyItems',
                        message: 'Array has more than 5 items.',
                    },
                ],
            });
        });

        it('should validate select multiple items constraints', async () => {
            const formanValue = {
                tooFewSelected: ['option1'],
                tooManySelected: ['option1', 'option2', 'option3', 'option4'],
                validSelection: ['option1', 'option2'],
            };

            const formanSchema = [
                {
                    name: 'tooFewSelected',
                    type: 'select',
                    multiple: true,
                    options: [{ value: 'option1' }, { value: 'option2' }, { value: 'option3' }, { value: 'option4' }],
                    validate: {
                        minItems: 2,
                    },
                },
                {
                    name: 'tooManySelected',
                    type: 'select',
                    multiple: true,
                    options: [{ value: 'option1' }, { value: 'option2' }, { value: 'option3' }, { value: 'option4' }],
                    validate: {
                        maxItems: 3,
                    },
                },
                {
                    name: 'validSelection',
                    type: 'select',
                    multiple: true,
                    options: [{ value: 'option1' }, { value: 'option2' }, { value: 'option3' }, { value: 'option4' }],
                    validate: {
                        minItems: 2,
                        maxItems: 3,
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'tooFewSelected',
                        message: 'Selected less than 2 items.',
                    },
                    {
                        domain: 'default',
                        path: 'tooManySelected',
                        message: 'Selected more than 3 items.',
                    },
                ],
            });
        });
    });

    describe('IML Expression Handling', () => {
        it('should skip validation for fields containing IML expressions', async () => {
            const formanValue = {
                normalField: 'invalid-email',
                imlField: '{{user.email}}',
                mixedField: 'Hello {{user.name}}, welcome!',
            };

            const formanSchema = [
                {
                    name: 'normalField',
                    type: 'email',
                    validate: {
                        pattern: '^[^@]+@[^@]+\\.[^@]+$',
                    },
                },
                {
                    name: 'imlField',
                    type: 'email',
                    validate: {
                        pattern: '^[^@]+@[^@]+\\.[^@]+$',
                    },
                },
                {
                    name: 'mixedField',
                    type: 'text',
                    validate: {
                        min: 50,
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'normalField',
                        message: "Value doesn't match the pattern: ^[^@]+@[^@]+\\.[^@]+$",
                    },
                ],
            });
        });
    });

    describe('Visual Types Handling', () => {
        it('should ignore validation for visual types at root and nested', async () => {
            const formanValue = {
                text: 'ok',
            };

            const formanSchema = [
                { name: 'text', type: 'text' },
                { type: 'banner', label: 'Banner' },
                { name: 'separator', type: 'separator' },
                {
                    name: 'group',
                    type: 'collection',
                    spec: [
                        { type: 'markdown', label: 'Info' },
                        { name: 'inner', type: 'text' },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({ valid: true, errors: [] });
        });

        it('should not attempt to validate or coerce values for visual types', async () => {
            const formanValue = {
                text: 'ok',
                // Values for visual fields should be ignored entirely
                banner: 123,
                separator: false,
                group: { inner: 'x', visual: 'ignored' },
            };

            const formanSchema = [
                { name: 'text', type: 'text' },
                { name: 'banner', type: 'banner' },
                { name: 'separator', type: 'separator' },
                {
                    name: 'group',
                    type: 'collection',
                    spec: [
                        { name: 'visual', type: 'html' },
                        { name: 'inner', type: 'text' },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({ valid: true, errors: [] });
        });
    });

    describe('Grouped Select Options', () => {
        it('should validate grouped select options', async () => {
            const formanValue = {
                category: 'option1',
                invalidCategory: 'invalid',
            };

            const formanSchema = [
                {
                    name: 'category',
                    type: 'select',
                    grouped: true,
                    options: [
                        {
                            label: 'Group A',
                            options: [
                                { value: 'option1', label: 'Option 1' },
                                { value: 'option2', label: 'Option 2' },
                            ],
                        },
                        {
                            label: 'Group B',
                            options: [
                                { value: 'option3', label: 'Option 3' },
                                { value: 'option4', label: 'Option 4' },
                            ],
                        },
                    ],
                },
                {
                    name: 'invalidCategory',
                    type: 'select',
                    grouped: true,
                    options: [
                        {
                            label: 'Group A',
                            options: [
                                { value: 'option1', label: 'Option 1' },
                                { value: 'option2', label: 'Option 2' },
                            ],
                        },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'invalidCategory',
                        message: "Value 'invalid' not found in options.",
                    },
                ],
            });
        });

        it('should validate grouped multiple select options', async () => {
            const formanValue = {
                categories: ['option1', 'option3'],
                invalidCategories: ['option1', 'invalid'],
            };

            const formanSchema = [
                {
                    name: 'categories',
                    type: 'select',
                    multiple: true,
                    grouped: true,
                    options: [
                        {
                            label: 'Group A',
                            options: [
                                { value: 'option1', label: 'Option 1' },
                                { value: 'option2', label: 'Option 2' },
                            ],
                        },
                        {
                            label: 'Group B',
                            options: [
                                { value: 'option3', label: 'Option 3' },
                                { value: 'option4', label: 'Option 4' },
                            ],
                        },
                    ],
                },
                {
                    name: 'invalidCategories',
                    type: 'select',
                    multiple: true,
                    grouped: true,
                    options: [
                        {
                            label: 'Group A',
                            options: [
                                { value: 'option1', label: 'Option 1' },
                                { value: 'option2', label: 'Option 2' },
                            ],
                        },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'invalidCategories',
                        message: "Value 'invalid' not found in options.",
                    },
                ],
            });
        });
    });

    describe('Remote Resource Resolution Errors', () => {
        it('should handle remote resource resolution failures for select options', async () => {
            const formanValue = {
                remoteSelect: 'value1',
            };

            const formanSchema = [
                {
                    name: 'remoteSelect',
                    type: 'select',
                    options: 'rpc://failing-endpoint',
                },
            ];

            expect(
                await validateForman(formanValue, formanSchema, {
                    async resolveRemote() {
                        throw new Error('Network error');
                    },
                }),
            ).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'remoteSelect',
                        message: 'Failed to resolve remote resource rpc://failing-endpoint: Error: Network error',
                    },
                ],
            });
        });

        it('should handle remote resource resolution failures for nested fields', async () => {
            const formanValue = {
                connection: 'conn1',
            };

            const formanSchema = [
                {
                    name: 'connection',
                    type: 'select',
                    options: [
                        {
                            value: 'conn1',
                            nested: 'rpc://failing-nested-endpoint',
                        },
                    ],
                },
            ];

            expect(
                await validateForman(formanValue, formanSchema, {
                    async resolveRemote() {
                        throw new Error('Nested resource error');
                    },
                }),
            ).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'connection',
                        message:
                            'Failed to resolve remote resource rpc://failing-nested-endpoint: Error: Nested resource error',
                    },
                ],
            });
        });

        it('should handle missing remote resolver', async () => {
            const formanValue = {
                remoteSelect: 'value1',
            };

            const formanSchema = [
                {
                    name: 'remoteSelect',
                    type: 'select',
                    options: 'rpc://endpoint',
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'remoteSelect',
                        message:
                            'Failed to resolve remote resource rpc://endpoint: Error: Remote resource not supported when resolver is not provided.',
                    },
                ],
            });
        });
    });

    describe('Special Field Types', () => {
        it('should validate account, hook, keychain, datastore, aiagent types', async () => {
            const formanValue = {
                account: 1,
                hook: 2,
                keychain: 3,
                datastore: 4,
                aiagent: 'agent-uuid',
                invalidAccount: 'not-number',
                invalidAiagent: 123,
            };

            const formanSchema = [
                {
                    name: 'account',
                    type: 'account',
                    options: [{ value: 1, label: 'Account 1' }],
                },
                {
                    name: 'hook',
                    type: 'hook',
                    options: [{ value: 2, label: 'Hook 2' }],
                },
                {
                    name: 'keychain',
                    type: 'keychain',
                    options: [{ value: 3, label: 'Keychain 3' }],
                },
                {
                    name: 'datastore',
                    type: 'datastore',
                    options: [{ value: 4, label: 'Datastore 4' }],
                },
                {
                    name: 'aiagent',
                    type: 'aiagent',
                    options: [{ value: 'agent-uuid', label: 'Agent' }],
                },
                {
                    name: 'invalidAccount',
                    type: 'account',
                    options: [{ value: 1, label: 'Account 1' }],
                },
                {
                    name: 'invalidAiagent',
                    type: 'aiagent',
                    options: [{ value: 'agent-uuid', label: 'Agent' }],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'invalidAccount',
                        message: "Expected type 'number', got type 'string'.",
                    },
                    {
                        domain: 'default',
                        path: 'invalidAiagent',
                        message: "Expected type 'string', got type 'number'.",
                    },
                ],
            });
        });

        it('should validate file and folder types', async () => {
            const formanValue = {
                file: 'document.pdf',
                folder: '/path/to/folder',
                invalidFile: 123,
            };

            const formanSchema = [
                {
                    name: 'file',
                    type: 'file',
                    options: [{ value: 'document.pdf' }],
                },
                {
                    name: 'folder',
                    type: 'folder',
                    options: [{ value: '/path/to/folder' }],
                },
                {
                    name: 'invalidFile',
                    type: 'file',
                    options: [{ value: 'document.pdf' }],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'invalidFile',
                        message: "Expected type 'string', got type 'number'.",
                    },
                ],
            });
        });
    });

    describe('Array Type Edge Cases', () => {
        it('should validate array with collection spec', async () => {
            const formanValue = {
                arrayOfObjects: [
                    { name: 'item1', value: 10 },
                    { name: 'item2', value: 'invalid' },
                ],
            };

            const formanSchema = [
                {
                    name: 'arrayOfObjects',
                    type: 'array',
                    spec: [
                        { name: 'name', type: 'text', required: true },
                        { name: 'value', type: 'number', required: true },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'arrayOfObjects.1.value',
                        message: "Expected type 'number', got type 'string'.",
                    },
                ],
            });
        });

        it('should handle array without spec', async () => {
            const formanValue = {
                simpleArray: [1, 2, 3],
            };

            const formanSchema = [
                {
                    name: 'simpleArray',
                    type: 'array',
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });
    });

    describe('Select Type Edge Cases', () => {
        it('should handle multiple select with non-array value', async () => {
            const formanValue = {
                multipleSelect: 'single-value',
            };

            const formanSchema = [
                {
                    name: 'multipleSelect',
                    type: 'select',
                    multiple: true,
                    options: [{ value: 'single-value' }],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'multipleSelect',
                        message: 'Value is not an array.',
                    },
                ],
            });
        });
    });

    describe('Collection Type Edge Cases', () => {
        it('should handle collection with field without name', async () => {
            const formanValue = {
                collection: { field1: 'value1' },
            };

            const formanSchema = [
                {
                    name: 'collection',
                    type: 'collection',
                    spec: [{ type: 'text' }], // Field without name
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'collection',
                        message: 'Object contains field with unknown name.',
                    },
                ],
            });
        });

        it('should handle collection without spec', async () => {
            const formanValue = {
                collection: { field1: 'value1' },
            };

            const formanSchema = [
                {
                    name: 'collection',
                    type: 'collection',
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });
    });

    describe('Nested Fields with Primitive Types', () => {
        it('should validate nested fields on primitive types', async () => {
            const formanValue = {
                textField: 'some-value',
                nestedField1: 'field1-value',
                nestedField2: 'field2-value',
            };

            const formanSchema = [
                {
                    name: 'textField',
                    type: 'text',
                    nested: [
                        {
                            name: 'nestedField1',
                            type: 'text',
                            required: true,
                        },
                        {
                            name: 'nestedField2',
                            type: 'text',
                            required: true,
                        },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });

        it('should handle nested fields validation failure on primitive types', async () => {
            const formanValue = {
                textField: 'some-value',
                nestedField1: 'field1-value',
                // Missing nestedField2
            };

            const formanSchema = [
                {
                    name: 'textField',
                    type: 'text',
                    nested: [
                        {
                            name: 'nestedField1',
                            type: 'text',
                            required: true,
                        },
                        {
                            name: 'nestedField2',
                            type: 'text',
                            required: true,
                        },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'nestedField2',
                        message: 'Field is mandatory.',
                    },
                ],
            });
        });
    });

    describe('Prefixed Field Types', () => {
        it('should normalize and validate prefixed account types', async () => {
            const formanValue = {
                googleAccount: 1,
                slackAccount: 2,
            };

            const formanSchema = [
                {
                    name: 'googleAccount',
                    type: 'account:google',
                },
                {
                    name: 'slackAccount',
                    type: 'account:slack',
                },
            ];

            expect(
                await validateForman(formanValue, formanSchema, {
                    async resolveRemote(path, data) {
                        if (path === 'api://connections/google') {
                            return [{ value: 1, label: 'Google Account' }];
                        }
                        if (path === 'api://connections/slack') {
                            return [{ value: 2, label: 'Slack Account' }];
                        }
                        throw new Error(`Unknown resource: ${path}`);
                    },
                }),
            ).toEqual({
                valid: true,
                errors: [],
            });
        });

        it('should normalize and validate prefixed hook types', async () => {
            const formanValue = {
                webhookHook: 1,
            };

            const formanSchema = [
                {
                    name: 'webhookHook',
                    type: 'hook:webhook',
                },
            ];

            expect(
                await validateForman(formanValue, formanSchema, {
                    async resolveRemote(path, data) {
                        if (path === 'api://hooks/webhook') {
                            return [{ value: 1, label: 'Webhook Hook' }];
                        }
                        throw new Error(`Unknown resource: ${path}`);
                    },
                }),
            ).toEqual({
                valid: true,
                errors: [],
            });
        });

        it('should normalize and validate prefixed keychain types', async () => {
            const formanValue = {
                apiKey: 1,
            };

            const formanSchema = [
                {
                    name: 'apiKey',
                    type: 'keychain:api',
                },
            ];

            expect(
                await validateForman(formanValue, formanSchema, {
                    async resolveRemote(path, data) {
                        if (path === 'api://keys/api') {
                            return [{ value: 1, label: 'API Key' }];
                        }
                        throw new Error(`Unknown resource: ${path}`);
                    },
                }),
            ).toEqual({
                valid: true,
                errors: [],
            });
        });
    });

    describe('Domain Validation with Domains', () => {
        it('should handle nested field validation errors within domains', async () => {
            const domains = {
                default: {
                    values: {
                        connection: 'conn1',
                    },
                    schema: [
                        {
                            name: 'connection',
                            type: 'select',
                            options: [
                                {
                                    value: 'conn1',
                                    nested: {
                                        domain: 'expect',
                                        store: [
                                            {
                                                name: 'requiredField',
                                                type: 'text',
                                                required: true,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
                expect: {
                    values: {
                        // Missing requiredField
                    },
                    schema: [],
                },
            };

            expect(await validateFormanWithDomains(domains)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'expect',
                        path: 'requiredField',
                        message: 'Field is mandatory.',
                    },
                ],
            });
        });

        it('should handle empty domain values', async () => {
            const domains = {
                default: {
                    values: {},
                    schema: [
                        {
                            name: 'field1',
                            type: 'text',
                            required: true,
                        },
                    ],
                },
                expect: {
                    values: {},
                    schema: [],
                },
            };

            expect(await validateFormanWithDomains(domains)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'field1',
                        message: 'Field is mandatory.',
                    },
                ],
            });
        });

        it('should handle unspecified domain', async () => {
            const formanValue = {
                sheet: 'sheet 1',
            };

            const formanSchema = [
                {
                    name: 'sheet',
                    type: 'select',
                    options: {
                        store: [{ value: 'sheet 1' }, { value: 'sheet 2' }],
                        nested: {
                            domain: 'expect',
                            store: [
                                {
                                    name: 'column',
                                    type: 'select',
                                    options: [],
                                },
                            ],
                        },
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        message: "Unable to process nested fields: Domain 'expect' not found.",
                        path: 'sheet',
                    },
                ],
            });
        });
    });

    describe('Edge Cases and Error Conditions', () => {
        it('should handle null and undefined values correctly', async () => {
            const formanValue = {
                nullField: null,
                undefinedField: undefined,
                emptyString: '',
                requiredNull: null,
            };

            const formanSchema = [
                {
                    name: 'nullField',
                    type: 'text',
                },
                {
                    name: 'undefinedField',
                    type: 'text',
                },
                {
                    name: 'emptyString',
                    type: 'text',
                },
                {
                    name: 'requiredNull',
                    type: 'text',
                    required: true,
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'requiredNull',
                        message: 'Field is mandatory.',
                    },
                ],
            });
        });

        it('should handle required field with empty string', async () => {
            const formanValue = {
                emptyRequired: '',
            };

            const formanSchema = [
                {
                    name: 'emptyRequired',
                    type: 'text',
                    required: true,
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'emptyRequired',
                        message: 'Field is mandatory.',
                    },
                ],
            });
        });

        it('should handle fields without name in root level', async () => {
            const formanValue = {};

            const formanSchema = [
                {
                    type: 'text', // Field without name
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: '',
                        message: 'Object contains field with unknown name.',
                    },
                ],
            });
        });
    });
});
