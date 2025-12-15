import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';

describe('Forman Schema Comprehensive Coverage', () => {
    describe('Additional Primitive Types Coverage', () => {
        it('should validate all supported primitive types', async () => {
            const formanValue = {
                date: '2023-12-01',
                json: '{"key": "value"}',
                buffer: 'SGVsbG8gV29ybGQ=',
                cert: '-----BEGIN CERTIFICATE-----',
                color: '#FF0000',
                email: 'test@example.com',
                filename: 'document.pdf',
                hidden: 'hidden-value',
                integer: 42,
                uinteger: 100,
                password: 'secret123',
                path: '/path/to/file',
                pkey: '-----BEGIN PRIVATE KEY-----',
                port: 8080,
                time: '14:30:00',
                timestamp: '2023-12-01T14:30:00Z',
                timezone: 'America/New_York',
                url: 'https://example.com',
                uuid: '123e4567-e89b-12d3-a456-426614174000',
                any: 'any-value',
            };

            const formanSchema = [
                { name: 'date', type: 'date' },
                { name: 'json', type: 'json' },
                { name: 'buffer', type: 'buffer' },
                { name: 'cert', type: 'cert' },
                { name: 'color', type: 'color' },
                { name: 'email', type: 'email' },
                { name: 'filename', type: 'filename' },
                { name: 'hidden', type: 'hidden' },
                { name: 'integer', type: 'integer' },
                { name: 'uinteger', type: 'uinteger' },
                { name: 'password', type: 'password' },
                { name: 'path', type: 'path' },
                { name: 'pkey', type: 'pkey' },
                { name: 'port', type: 'port' },
                { name: 'time', type: 'time' },
                { name: 'timestamp', type: 'timestamp' },
                { name: 'timezone', type: 'timezone' },
                { name: 'url', type: 'url' },
                { name: 'uuid', type: 'uuid' },
                { name: 'any', type: 'any' },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });

        it('should handle type validation errors for primitive types', async () => {
            const formanValue = {
                integer: 'not-a-number',
                port: 'not-a-port',
                date: 123, // Should be string
                email: 456, // Should be string
            };

            const formanSchema = [
                { name: 'integer', type: 'integer' },
                { name: 'port', type: 'port' },
                { name: 'date', type: 'date' },
                { name: 'email', type: 'email' },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'integer',
                        message: "Expected type 'number', got type 'string'.",
                    },
                    {
                        domain: 'default',
                        path: 'port',
                        message: "Expected type 'number', got type 'string'.",
                    },
                    {
                        domain: 'default',
                        path: 'date',
                        message: "Expected type 'string', got type 'number'.",
                    },
                    {
                        domain: 'default',
                        path: 'email',
                        message: "Expected type 'string', got type 'number'.",
                    },
                ],
            });
        });

        it('should handle upload type (array)', async () => {
            const formanValue = {
                files: [
                    { name: 'file1.pdf', content: 'base64content1' },
                    { name: 'file2.jpg', content: 'base64content2' },
                ],
                invalidFiles: 'not-an-array',
            };

            const formanSchema = [
                { name: 'files', type: 'upload' },
                { name: 'invalidFiles', type: 'upload' },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'invalidFiles',
                        message: "Expected type 'array', got type 'string'.",
                    },
                ],
            });
        });
    });

    describe('Complex Nested Scenarios', () => {
        it('should handle deeply nested collections', async () => {
            const formanValue = {
                level1: {
                    level2: {
                        level3: {
                            value: 'deep-value',
                        },
                    },
                },
            };

            const formanSchema = [
                {
                    name: 'level1',
                    type: 'collection',
                    spec: [
                        {
                            name: 'level2',
                            type: 'collection',
                            spec: [
                                {
                                    name: 'level3',
                                    type: 'collection',
                                    spec: [
                                        {
                                            name: 'value',
                                            type: 'text',
                                            required: true,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });

        it('should handle arrays of arrays', async () => {
            const formanValue = {
                matrix: [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 'invalid'], // Invalid number in inner array
                ],
            };

            const formanSchema = [
                {
                    name: 'matrix',
                    type: 'array',
                    spec: {
                        type: 'array',
                        spec: {
                            type: 'number',
                        },
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'matrix.2.2',
                        message: "Expected type 'number', got type 'string'.",
                    },
                ],
            });
        });

        it('should handle complex select with extended options and nested fields', async () => {
            const formanValue = {
                connection: 'google',
                credential: 'cred1',
                spreadsheet: 'sheet1',
            };

            const formanSchema = [
                {
                    name: 'connection',
                    type: 'select',
                    options: {
                        store: [
                            {
                                value: 'google',
                                label: 'Google',
                                nested: [
                                    {
                                        name: 'credential',
                                        type: 'select',
                                        options: 'rpc://credentials',
                                        nested: [
                                            {
                                                name: 'spreadsheet',
                                                type: 'select',
                                                options: 'rpc://spreadsheets',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                },
            ];

            expect(
                await validateForman(formanValue, formanSchema, {
                    async resolveRemote(path, data) {
                        if (path === 'rpc://credentials') {
                            expect(data).toEqual({ connection: 'google' });
                            return [{ value: 'cred1', label: 'Credential 1' }];
                        }
                        if (path === 'rpc://spreadsheets') {
                            expect(data).toEqual({ connection: 'google', credential: 'cred1' });
                            return [{ value: 'sheet1', label: 'Spreadsheet 1' }];
                        }
                        throw new Error(`Unknown path: ${path}`);
                    },
                }),
            ).toEqual({
                valid: true,
                errors: [],
            });
        });
    });

    describe('Validation Context and Error Handling', () => {
        it('should maintain proper validation context across nested structures', async () => {
            const formanValue = {
                collection: {
                    array: [
                        { item: 'valid' },
                        { item: 123 }, // Invalid: should be string
                    ],
                },
                anotherField: 'valid',
            };

            const formanSchema = [
                {
                    name: 'collection',
                    type: 'collection',
                    spec: [
                        {
                            name: 'array',
                            type: 'array',
                            spec: [
                                {
                                    name: 'item',
                                    type: 'text',
                                },
                            ],
                        },
                    ],
                },
                {
                    name: 'anotherField',
                    type: 'text',
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'default',
                        path: 'collection.array.1.item',
                        message: "Expected type 'string', got type 'number'.",
                    },
                ],
            });
        });

        it('should handle collection validation with anonymous root field', async () => {
            const formanValue = {
                field1: 'value1',
                field2: 'value2',
            };

            const formanSchema = [
                {
                    name: 'data',
                    type: 'collection',
                    spec: [
                        { name: 'field1', type: 'text' },
                        { name: 'field2', type: 'text' },
                    ],
                },
            ];

            const wrappedValue = { data: formanValue };

            expect(await validateForman(wrappedValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });
    });

    describe('Multi-Domain Complex Scenarios', () => {
        it('should handle cross-domain validation with remote resources', async () => {
            const domains = {
                default: {
                    values: {
                        service: 'sheets',
                    },
                    schema: [
                        {
                            name: 'service',
                            type: 'select',
                            options: {
                                store: 'rpc://services',
                                nested: {
                                    domain: 'config',
                                    store: 'rpc://service-config',
                                },
                            },
                        },
                    ],
                },
                config: {
                    values: {
                        apiKey: 'test-key',
                        endpoint: 'https://api.service.com',
                    },
                    schema: [],
                },
            };

            let serviceConfigCalled = false;

            expect(
                await validateFormanWithDomains(domains, {
                    states: true,
                    async resolveRemote(path, data) {
                        if (path === 'rpc://services') {
                            expect(data).toEqual({});
                            return [{ value: 'sheets', label: 'Google Sheets' }];
                        }
                        if (path === 'rpc://service-config') {
                            serviceConfigCalled = true;
                            expect(data).toEqual({ service: 'sheets' });
                            return [
                                { name: 'apiKey', type: 'text', required: true },
                                { name: 'endpoint', type: 'url', required: true },
                            ];
                        }
                        throw new Error(`Unknown path: ${path}`);
                    },
                }),
            ).toEqual({
                valid: true,
                errors: [],
                states: {
                    default: {
                        service: {
                            label: 'Google Sheets',
                            mode: 'chose',
                        },
                    },
                },
            });

            expect(serviceConfigCalled).toBe(true);
        });

        it('should handle multiple domains with validation errors', async () => {
            const domains = {
                input: {
                    values: {
                        requiredField: '',
                        numberField: 'not-a-number',
                    },
                    schema: [
                        { name: 'requiredField', type: 'text', required: true },
                        { name: 'numberField', type: 'number' },
                    ],
                },
                output: {
                    values: {
                        outputField: null,
                    },
                    schema: [{ name: 'outputField', type: 'text', required: true }],
                },
                config: {
                    values: {
                        setting1: 'valid',
                        setting2: 123,
                    },
                    schema: [
                        { name: 'setting1', type: 'text' },
                        { name: 'setting2', type: 'boolean' },
                    ],
                },
            };

            expect(await validateFormanWithDomains(domains)).toEqual({
                valid: false,
                errors: [
                    {
                        domain: 'input',
                        path: 'requiredField',
                        message: 'Field is mandatory.',
                    },
                    {
                        domain: 'input',
                        path: 'numberField',
                        message: "Expected type 'number', got type 'string'.",
                    },
                    {
                        domain: 'output',
                        path: 'outputField',
                        message: 'Field is mandatory.',
                    },
                    {
                        domain: 'config',
                        path: 'setting2',
                        message: "Expected type 'boolean', got type 'number'.",
                    },
                ],
            });
        });
    });

    describe('Edge Cases for Extended Options', () => {
        it('should handle select with extended options but no nested', async () => {
            const formanValue = {
                simpleSelect: 'option1',
            };

            const formanSchema = [
                {
                    name: 'simpleSelect',
                    type: 'select',
                    options: {
                        store: [
                            { value: 'option1', label: 'Option 1' },
                            { value: 'option2', label: 'Option 2' },
                        ],
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });

        it('should handle select with extended options and global nested', async () => {
            const formanValue = {
                service: 'sheets',
                token: 'abc123',
            };

            const formanSchema = [
                {
                    name: 'service',
                    type: 'select',
                    options: {
                        store: [
                            { value: 'sheets', label: 'Google Sheets' },
                            { value: 'docs', label: 'Google Docs' },
                        ],
                        nested: [
                            {
                                name: 'token',
                                type: 'text',
                                required: true,
                            },
                        ],
                    },
                },
            ];

            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });

        it('should handle validation where nested field overrides global nested', async () => {
            const formanValue = {
                service: 'sheets',
                sheetId: 'sheet123',
            };

            const formanSchema = [
                {
                    name: 'service',
                    type: 'select',
                    options: {
                        store: [
                            {
                                value: 'sheets',
                                label: 'Google Sheets',
                                nested: [
                                    {
                                        name: 'sheetId',
                                        type: 'text',
                                        required: true,
                                    },
                                ],
                            },
                            { value: 'docs', label: 'Google Docs' },
                        ],
                        nested: [
                            {
                                name: 'generalToken',
                                type: 'text',
                                required: true,
                            },
                        ],
                    },
                },
            ];

            // The specific option's nested should override global nested
            expect(await validateForman(formanValue, formanSchema)).toEqual({
                valid: true,
                errors: [],
            });
        });
    });
});
