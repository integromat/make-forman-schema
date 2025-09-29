import { describe, expect, it } from '@jest/globals';
import {
    noEmpty,
    isObject,
    isOptionGroup,
    containsIMLExpression,
    normalizeFormanFieldType,
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
            expect(Object.keys(API_ENDPOINTS)).toEqual(['account', 'aiagent', 'datastore', 'hook', 'keychain', 'udt']);
        });
    });

    describe('FORMAN_VISUAL_TYPES', () => {
        it('should contain expected visual types and nothing else', () => {
            expect(Array.isArray(FORMAN_VISUAL_TYPES)).toBe(true);
            expect(FORMAN_VISUAL_TYPES.sort()).toEqual(['banner', 'html', 'markdown', 'separator'].sort());
        });
    });
});
