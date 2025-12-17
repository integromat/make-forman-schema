import { describe, expect, it } from '@jest/globals';
import {
    noEmpty,
    isObject,
    isOptionGroup,
    containsIMLExpression,
    isPrimitiveIMLExpression,
    normalizeFormanFieldType,
    buildRestoreStructure,
    API_ENDPOINTS,
    FORMAN_VISUAL_TYPES,
} from '../src/utils.js';

describe('Utils Functions', () => {
    describe('noEmpty', () => {
        it('should return undefined for empty or whitespace strings', () => {
            expect(noEmpty('')).toBeUndefined();
            expect(noEmpty('   ')).toBeUndefined();
            expect(noEmpty('\n\t  ')).toBeUndefined();
            expect(noEmpty(undefined)).toBeUndefined();
        });

        it('should return trimmed string for valid input', () => {
            expect(noEmpty('hello')).toBe('hello');
            expect(noEmpty('  hello  ')).toBe('hello');
            expect(noEmpty('\n\thello\t\n')).toBe('hello');
        });
    });

    describe('isObject', () => {
        it('should return true for plain objects', () => {
            expect(isObject({})).toBe(true);
            expect(isObject({ key: 'value' })).toBe(true);
            expect(isObject(new Object())).toBe(true);
        });

        it('should return false for non-objects', () => {
            expect(isObject(null)).toBe(false);
            expect(isObject(undefined)).toBe(false);
            expect(isObject([])).toBe(false);
            expect(isObject('string')).toBe(false);
            expect(isObject(123)).toBe(false);
            expect(isObject(true)).toBe(false);
            expect(isObject(new Date())).toBe(true); // Date is an object
            expect(isObject(/regex/)).toBe(true); // RegExp is an object
        });
    });

    describe('isOptionGroup', () => {
        it('should return true for option groups', () => {
            const optionGroup = {
                label: 'Group 1',
                options: [
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                ],
            };
            expect(isOptionGroup(optionGroup)).toBe(true);
        });

        it('should return false for regular options', () => {
            const option = { value: 'option1', label: 'Option 1' };
            expect(isOptionGroup(option)).toBe(false);

            const optionWithoutOptions = { label: 'Not a group' };
            expect(isOptionGroup(optionWithoutOptions as any)).toBe(false);

            const optionWithNonArrayOptions = {
                label: 'Group',
                options: 'not-array',
            };
            expect(isOptionGroup(optionWithNonArrayOptions as any)).toBe(false);
        });
    });

    describe('containsIMLExpression', () => {
        it('should return true for strings with IML expressions', () => {
            expect(containsIMLExpression('{{variable}}')).toBe(true);
            expect(containsIMLExpression('Hello {{name}}, welcome!')).toBe(true);
            expect(containsIMLExpression('{{user.email}} is valid')).toBe(true);
            expect(containsIMLExpression('Start {{middle}} end')).toBe(true);
        });

        it('should return false for strings without IML expressions', () => {
            expect(containsIMLExpression('regular string')).toBe(false);
            expect(containsIMLExpression('{ single brace }')).toBe(false);
            expect(containsIMLExpression('{{ incomplete')).toBe(false);
            expect(containsIMLExpression('incomplete }}')).toBe(false);
            expect(containsIMLExpression('')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(containsIMLExpression(123)).toBe(false);
            expect(containsIMLExpression(null)).toBe(false);
            expect(containsIMLExpression(undefined)).toBe(false);
            expect(containsIMLExpression(true)).toBe(false);
            expect(containsIMLExpression({})).toBe(false);
            expect(containsIMLExpression([])).toBe(false);
        });
    });

    describe('isPrimitiveIMLExpression', () => {
        it('should return true for primitive IML expressions', () => {
            expect(isPrimitiveIMLExpression('{{variable}}')).toBe(true);
            expect(isPrimitiveIMLExpression('{{user.email}}')).toBe(true);
            expect(isPrimitiveIMLExpression('{{data.items[0].name}}')).toBe(true);
        });

        it('should return false for strings with IML expressions but not primitive', () => {
            expect(isPrimitiveIMLExpression('Hello {{name}}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{name}} welcome')).toBe(false);
            expect(isPrimitiveIMLExpression('Start {{middle}} end')).toBe(false);
            expect(isPrimitiveIMLExpression('prefix{{variable}}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{variable}}suffix')).toBe(false);
        });

        it('should return false for strings with multiple IML expressions', () => {
            expect(isPrimitiveIMLExpression('{{first}}{{second}}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{first}} {{second}}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{a}}{{b}}{{c}}')).toBe(false);
        });

        it('should return false for strings without IML expressions', () => {
            expect(isPrimitiveIMLExpression('regular string')).toBe(false);
            expect(isPrimitiveIMLExpression('{ single brace }')).toBe(false);
            expect(isPrimitiveIMLExpression('{{ incomplete')).toBe(false);
            expect(isPrimitiveIMLExpression('incomplete }}')).toBe(false);
            expect(isPrimitiveIMLExpression('')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(isPrimitiveIMLExpression(123)).toBe(false);
            expect(isPrimitiveIMLExpression(null)).toBe(false);
            expect(isPrimitiveIMLExpression(undefined)).toBe(false);
            expect(isPrimitiveIMLExpression(true)).toBe(false);
            expect(isPrimitiveIMLExpression({})).toBe(false);
            expect(isPrimitiveIMLExpression([])).toBe(false);
        });

        it('should return false for malformed IML expressions', () => {
            expect(isPrimitiveIMLExpression('{variable}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{variable}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{{variable}}}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{varia{{ble}}')).toBe(false);
            expect(isPrimitiveIMLExpression('{{varia}}ble}}')).toBe(false);
        });
    });

    describe('normalizeFormanFieldType', () => {
        it('should normalize account: prefixed types', () => {
            const field = {
                name: 'connection',
                type: 'account:google',
            };

            const normalized = normalizeFormanFieldType(field);
            expect(normalized.type).toBe('account');
            expect(normalized.options).toEqual({
                store: 'api://connections/google',
            });
        });

        it('should normalize hook: prefixed types', () => {
            const field = {
                name: 'webhook',
                type: 'hook:github',
            };

            const normalized = normalizeFormanFieldType(field);
            expect(normalized.type).toBe('hook');
            expect(normalized.options).toEqual({
                store: 'api://hooks/github',
            });
        });

        it('should normalize keychain: prefixed types', () => {
            const field = {
                name: 'apiKey',
                type: 'keychain:openai',
                required: true,
            };

            const normalized = normalizeFormanFieldType(field);
            expect(normalized.type).toBe('keychain');
            expect(normalized.options).toEqual({
                store: 'api://keys/openai',
            });
        });

        it('should return field unchanged for non-prefixed types', () => {
            const field = {
                name: 'text',
                type: 'text',
                required: true,
            };

            const normalized = normalizeFormanFieldType(field);
            expect(normalized).toBe(field);
        });

        it('should handle fields without existing options', () => {
            const field = {
                name: 'connection',
                type: 'account:slack',
            };

            const normalized = normalizeFormanFieldType(field);
            expect(normalized.type).toBe('account');
            expect(normalized.options).toEqual({
                store: 'api://connections/slack',
            });
        });

        it('should preserve existing field properties', () => {
            const field = {
                name: 'webhook',
                type: 'hook:stripe',
                required: true,
                help: 'Select a webhook',
                label: 'Webhook',
                advanced: true,
            };

            const normalized = normalizeFormanFieldType(field);
            expect(normalized).toEqual({
                name: 'webhook',
                type: 'hook',
                required: true,
                help: 'Select a webhook',
                label: 'Webhook',
                advanced: true,
                options: {
                    store: 'api://hooks/stripe',
                },
            });
        });
    });

    describe('API_ENDPOINTS', () => {
        it('should have correct endpoint values', () => {
            expect(API_ENDPOINTS.account).toBe('api://connections/{{kind}}');
            expect(API_ENDPOINTS.hook).toBe('api://hooks/{{kind}}');
            expect(API_ENDPOINTS.keychain).toBe('api://keys/{{kind}}');
            expect(API_ENDPOINTS.aiagent).toBe('api://ai-agents/v1/agents');
            expect(API_ENDPOINTS.datastore).toBe('api://data-stores');
            expect(API_ENDPOINTS.udt).toBe('api://data-structures');
        });

        it('should be an object with defined endpoint values', () => {
            expect(typeof API_ENDPOINTS).toBe('object');
            expect(API_ENDPOINTS).toBeDefined();
            expect(Object.keys(API_ENDPOINTS)).toEqual([
                'account',
                'aiagent',
                'datastore',
                'hook',
                'device',
                'keychain',
                'udt',
                'scenario',
            ]);
        });
    });

    describe('FORMAN_VISUAL_TYPES', () => {
        it('should contain expected visual types and nothing else', () => {
            expect(Array.isArray(FORMAN_VISUAL_TYPES)).toBe(true);
            expect(FORMAN_VISUAL_TYPES).toEqual(['banner', 'markdown', 'html', 'separator']);
        });
    });

    describe('buildRestoreStructure', () => {
        it('should handle single-level paths', () => {
            const input = [{ domain: 'expect', path: ['field'], state: { label: 'asdf' } }];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({
                expect: {
                    field: { label: 'asdf' },
                },
            });
        });

        it('should handle multi-level paths with nested structure', () => {
            const input = [
                { domain: 'parameters', path: ['field'], state: { label: 'xxx' } },
                { domain: 'parameters', path: ['field', 'subfield'], state: { label: 'yyy' } },
                { domain: 'parameters', path: ['field', 'array', 0, 'field'], state: { label: 'zzz' } },
                { domain: 'parameters', path: ['field', 'array2', 0, 0, 'field'], state: { label: 'foo' } },
                { domain: 'parameters', path: ['field', 'array2', 0, 1, 'field'], state: { label: 'bar' } },
            ];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({
                parameters: {
                    field: {
                        label: 'xxx',
                        nested: {
                            subfield: { label: 'yyy' },
                            array: {
                                mode: 'chose',
                                items: [
                                    {
                                        field: { label: 'zzz' },
                                    },
                                ],
                            },
                            array2: {
                                mode: 'chose',
                                items: [
                                    {
                                        value: {
                                            mode: 'chose',
                                            items: [
                                                {
                                                    field: { label: 'foo' },
                                                },
                                                {
                                                    field: { label: 'bar' },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            });
        });

        it('should handle multiple domains', () => {
            const input = [
                { domain: 'expect', path: ['field'], state: { label: 'asdf' } },
                { domain: 'parameters', path: ['field'], state: { label: 'xxx' } },
                { domain: 'parameters', path: ['field', 'subfield'], state: { label: 'yyy' } },
            ];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({
                expect: {
                    field: { label: 'asdf' },
                },
                parameters: {
                    field: {
                        label: 'xxx',
                        nested: {
                            subfield: { label: 'yyy' },
                        },
                    },
                },
            });
        });

        it('should handle deeply nested paths', () => {
            const input = [{ domain: 'test', path: ['a', 'b', 'c'], state: { label: 'deep' } }];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({
                test: {
                    a: {
                        nested: {
                            b: {
                                nested: {
                                    c: { label: 'deep' },
                                },
                            },
                        },
                    },
                },
            });
        });

        it('should merge states for the same path', () => {
            const input = [
                { domain: 'test', path: ['field'], state: { label: 'first' } },
                { domain: 'test', path: ['field'], state: { data: { value: 'second' } } },
            ];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({
                test: {
                    field: {
                        label: 'first',
                        data: {
                            value: 'second',
                        },
                    },
                },
            });
        });

        it('should handle empty input array', () => {
            const input: Array<{ domain: string; path: string[]; state: any }> = [];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({});
        });

        it('should handle multiple fields in the same domain', () => {
            const input = [
                { domain: 'config', path: ['field1'], state: { label: 'first' } },
                { domain: 'config', path: ['field2'], state: { label: 'second' } },
            ];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({
                config: {
                    field1: { label: 'first' },
                    field2: { label: 'second' },
                },
            });
        });

        it('should handle complex nested structures with multiple branches', () => {
            const input = [
                { domain: 'form', path: ['user'], state: { label: 'User' } },
                { domain: 'form', path: ['user', 'address'], state: { label: 'Address' } },
                { domain: 'form', path: ['user', 'address', 'zip'], state: { label: 'Zip' } },
                { domain: 'form', path: ['user', 'contact'], state: { label: 'Contact' } },
            ];

            const result = buildRestoreStructure(input);

            expect(result).toEqual({
                form: {
                    user: {
                        label: 'User',
                        nested: {
                            address: {
                                label: 'Address',
                                nested: {
                                    zip: { label: 'Zip' },
                                },
                            },
                            contact: { label: 'Contact' },
                        },
                    },
                },
            });
        });
    });
});
