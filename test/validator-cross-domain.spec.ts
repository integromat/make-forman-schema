import { describe, expect, it } from '@jest/globals';
import { validateFormanWithDomains } from '../src/index.js';

describe('Cross-domain validation', () => {
    it('should resolve domain alias in nested.domain', async () => {
        // Schema says domain:"parameters" but caller uses key "default"
        const result = await validateFormanWithDomains(
            {
                source: {
                    values: { host: 'localhost' },
                    schema: [
                        {
                            name: 'host',
                            type: 'text',
                            nested: {
                                store: [{ name: 'port', type: 'number' }],
                                domain: 'parameters',
                            },
                        },
                    ],
                },
                default: {
                    values: { port: 8080 },
                    schema: [],
                },
            },
            { strict: true, domainAliases: { parameters: 'default' } },
        );

        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
    });

    it('should not flag cross-domain fields as unknown in strict mode', async () => {
        const result = await validateFormanWithDomains(
            {
                expect: {
                    values: { trigger: 'a' },
                    schema: [
                        {
                            name: 'trigger',
                            type: 'select',
                            options: {
                                store: [
                                    { value: 'a', label: 'A' },
                                ],
                                nested: {
                                    store: [{ name: 'crossField', type: 'text' }],
                                    domain: 'default',
                                },
                            },
                        },
                    ],
                },
                default: {
                    values: { crossField: 'hello' },
                    schema: [],
                },
            },
            { strict: true },
        );

        expect(result.errors).toEqual([]);
    });

    it('should merge fields from multiple cross-domain jumps into same domain', async () => {
        const result = await validateFormanWithDomains(
            {
                domainA: {
                    values: { selectA: 'x' },
                    schema: [
                        {
                            name: 'selectA',
                            type: 'select',
                            options: {
                                store: [{ value: 'x', label: 'X' }],
                                nested: {
                                    store: [{ name: 'fieldFromA', type: 'text' }],
                                    domain: 'target',
                                },
                            },
                        },
                    ],
                },
                domainB: {
                    values: { selectB: 'y' },
                    schema: [
                        {
                            name: 'selectB',
                            type: 'select',
                            options: {
                                store: [{ value: 'y', label: 'Y' }],
                                nested: {
                                    store: [{ name: 'fieldFromB', type: 'number' }],
                                    domain: 'target',
                                },
                            },
                        },
                    ],
                },
                target: {
                    values: { fieldFromA: 'val', fieldFromB: 42 },
                    schema: [],
                },
            },
            { strict: true },
        );

        expect(result.errors).toEqual([]);
    });

    it('should allow static schema fields alongside cross-domain fields', async () => {
        const result = await validateFormanWithDomains(
            {
                source: {
                    values: { picker: 'v' },
                    schema: [
                        {
                            name: 'picker',
                            type: 'select',
                            options: {
                                store: [{ value: 'v', label: 'V' }],
                                nested: {
                                    store: [{ name: 'extra', type: 'text' }],
                                    domain: 'target',
                                },
                            },
                        },
                    ],
                },
                target: {
                    values: { own: 'mine', extra: 'from-source' },
                    schema: [{ name: 'own', type: 'text' }],
                },
            },
            { strict: true },
        );

        expect(result.errors).toEqual([]);
    });

    it('should still error when domain does not exist and no alias matches', async () => {
        const result = await validateFormanWithDomains(
            {
                default: {
                    values: { host: 'localhost' },
                    schema: [
                        {
                            name: 'host',
                            type: 'text',
                            nested: {
                                store: [{ name: 'port', type: 'number' }],
                                domain: 'nonexistent',
                            },
                        },
                    ],
                },
            },
            { strict: true, domainAliases: { other: 'default' } },
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: expect.stringContaining("Domain 'nonexistent' not found"),
                }),
            ]),
        );
    });

    it('should handle the user scenario: parameters alias + cross-domain strict', async () => {
        // Reproduces the exact bug: schema says domain:"parameters" but caller uses key "default"
        const result = await validateFormanWithDomains(
            {
                expect: {
                    values: { trigger: 'webhook' },
                    schema: [
                        {
                            name: 'trigger',
                            type: 'select',
                            options: {
                                store: [
                                    { value: 'webhook', label: 'Webhook' },
                                ],
                                nested: {
                                    store: [
                                        { name: 'url', type: 'text' },
                                        { name: 'method', type: 'text' },
                                    ],
                                    domain: 'parameters',
                                },
                            },
                        },
                    ],
                },
                default: {
                    values: { url: 'https://example.com', method: 'POST' },
                    schema: [],
                },
            },
            { strict: true, domainAliases: { parameters: 'default' } },
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('should handle bidirectional cross-domain jumps (exact IO spec reproduction)', async () => {
        const result = await validateFormanWithDomains(
            {
                expect: {
                    values: { crossDomainParametersToExpect: 'xxx', expectOnly: 'bravo' },
                    schema: [
                        {
                            name: 'expectOnly',
                            type: 'select',
                            label: 'Expect Only',
                            options: {
                                store: [
                                    { label: 'Alpha', value: 'alpha' },
                                    { label: 'Bravo', value: 'bravo' },
                                ],
                                nested: {
                                    store: [
                                        {
                                            name: 'crossDomainExpectToParameters',
                                            type: 'text',
                                            label: 'Cross Domain Expect to Parameters',
                                        },
                                    ],
                                    domain: 'parameters',
                                },
                            },
                        },
                    ],
                },
                parameters: {
                    values: { parametersOnly: 'alpha', crossDomainExpectToParameters: 'yyy' },
                    schema: [
                        {
                            name: 'parametersOnly',
                            type: 'select',
                            label: 'Parameters Only',
                            options: {
                                store: [
                                    { label: 'Alpha', value: 'alpha' },
                                    { label: 'Bravo', value: 'bravo' },
                                ],
                                nested: {
                                    store: [
                                        {
                                            name: 'crossDomainParametersToExpect',
                                            type: 'text',
                                            label: 'Cross Domain Parameters to Expect',
                                        },
                                    ],
                                    domain: 'expect',
                                },
                            },
                        },
                    ],
                },
            },
            { strict: true },
        );

        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
    });
});
