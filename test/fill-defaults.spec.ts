import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';

describe('fillDefaults: requiredOnly', () => {
    // A required toggle with a declared default and a required field revealed only when it is on.
    const fallbackToggle: FormanSchemaField[] = [
        {
            name: 'fallbackEnabled',
            type: 'boolean',
            required: true,
            default: false,
            nested: [{ name: 'fallbackConnectionId', type: 'text', required: true }],
        },
    ];

    it('fills an omitted required field from its declared default and reports it', async () => {
        const result = await validateForman({}, fallbackToggle, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.normalizedValues).toEqual({ default: { fallbackEnabled: false } });
        expect(result.appliedDefaults).toEqual([{ domain: 'default', path: 'fallbackEnabled', value: false }]);
    });

    it('fills defaults revealed by a default it just filled, in the same pass', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'toggle',
                type: 'boolean',
                required: true,
                default: true,
                nested: [{ name: 'label', type: 'text', required: true, default: 'fallback label' }],
            },
        ];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: { toggle: true, label: 'fallback label' } });
        expect(result.appliedDefaults).toEqual([
            { domain: 'default', path: 'toggle', value: true },
            { domain: 'default', path: 'label', value: 'fallback label' },
        ]);
    });

    it('reports requirements armed by a filled default alongside the fill', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'compactionEnabled',
                type: 'boolean',
                required: true,
                default: true,
                nested: [{ name: 'compactionThreshold', type: 'number', required: true }],
            },
        ];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            { domain: 'default', path: 'compactionThreshold', message: 'Field is mandatory.' },
        ]);
        expect(result.normalizedValues).toEqual({ default: { compactionEnabled: true } });
        expect(result.appliedDefaults).toEqual([{ domain: 'default', path: 'compactionEnabled', value: true }]);
    });

    it('never overwrites a provided value, falsy included', async () => {
        const schema: FormanSchemaField[] = [
            { name: 'retries', type: 'number', required: true, default: 3 },
            { name: 'verbose', type: 'boolean', required: true, default: true },
        ];
        const result = await validateForman({ retries: 0, verbose: false }, schema, {
            strict: true,
            fillDefaults: 'requiredOnly',
        });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: { retries: 0, verbose: false } });
        expect(result.appliedDefaults).toEqual([]);
    });

    it('still fails a value the caller explicitly cleared', async () => {
        const schema: FormanSchemaField[] = [{ name: 'mode', type: 'text', required: true, default: 'select' }];
        for (const cleared of [null, '']) {
            const result = await validateForman({ mode: cleared }, schema, {
                strict: true,
                fillDefaults: 'requiredOnly',
            });
            expect(result.errors).toEqual([{ domain: 'default', path: 'mode', message: 'Field is mandatory.' }]);
            expect(result.appliedDefaults).toEqual([]);
        }
    });

    it('treats null and empty-string defaults as no default', async () => {
        const schema: FormanSchemaField[] = [
            { name: 'source', type: 'text', required: true, default: null },
            { name: 'label', type: 'text', required: true, default: '' },
        ];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.errors).toEqual([
            { domain: 'default', path: 'source', message: 'Field is mandatory.' },
            { domain: 'default', path: 'label', message: 'Field is mandatory.' },
        ]);
        expect(result.appliedDefaults).toEqual([]);
    });

    it('fills falsy defaults rather than treating them as absent', async () => {
        const schema: FormanSchemaField[] = [
            { name: 'retries', type: 'number', required: true, default: 0 },
            { name: 'verbose', type: 'boolean', required: true, default: false },
        ];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: { retries: 0, verbose: false } });
    });

    it('never fills optional fields', async () => {
        const schema: FormanSchemaField[] = [{ name: 'reasoningEffort', type: 'text', default: 'low' }];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: {} });
        expect(result.appliedDefaults).toEqual([]);
    });

    it('fills defaults on fields injected by a remote-resolved spec', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'model',
                type: 'select',
                required: true,
                options: [{ value: 'gpt', nested: 'rpc://modelParams' }],
            },
        ];
        const result = await validateForman({ model: 'gpt' }, schema, {
            strict: true,
            fillDefaults: 'requiredOnly',
            resolveRemote: async path =>
                path === 'rpc://modelParams'
                    ? [{ name: 'fallbackEnabled', type: 'boolean', required: true, default: false }]
                    : [],
        });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: { model: 'gpt', fallbackEnabled: false } });
        expect(result.appliedDefaults).toEqual([{ domain: 'default', path: 'fallbackEnabled', value: false }]);
    });

    it('does not fill under a branch its own filled default left inactive', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'advanced',
                type: 'boolean',
                required: true,
                default: false,
                nested: [{ name: 'level', type: 'text', required: true, default: 'high' }],
            },
        ];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: { advanced: false } });
        expect(result.appliedDefaults).toEqual([{ domain: 'default', path: 'advanced', value: false }]);
    });

    it('routes a filled two-branch boolean to the matching branch', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'enabled',
                type: 'boolean',
                required: true,
                default: false,
                nested: {
                    true: [{ name: 'target', type: 'text', required: true }],
                    false: [{ name: 'reason', type: 'text', required: true, default: 'disabled by default' }],
                },
            },
        ];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: { enabled: false, reason: 'disabled by default' } });
        expect(result.appliedDefaults).toEqual([
            { domain: 'default', path: 'enabled', value: false },
            { domain: 'default', path: 'reason', value: 'disabled by default' },
        ]);
    });

    it('fills inside collections and array items at the right path', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'rows',
                type: 'array',
                spec: [
                    { name: 'title', type: 'text', required: true },
                    { name: 'mode', type: 'text', required: true, default: 'select' },
                ],
            },
        ];
        const result = await validateForman({ rows: [{ title: 'first' }, { title: 'second' }] }, schema, {
            strict: true,
            fillDefaults: 'requiredOnly',
        });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({
            default: {
                rows: [
                    { title: 'first', mode: 'select' },
                    { title: 'second', mode: 'select' },
                ],
            },
        });
        expect(result.appliedDefaults).toEqual([
            { domain: 'default', path: 'rows.0.mode', value: 'select' },
            { domain: 'default', path: 'rows.1.mode', value: 'select' },
        ]);
    });

    it('fills each domain independently and never mutates the input values', async () => {
        const parameterValues = {};
        const expectValues = { message: 'hi' };
        const result = await validateFormanWithDomains(
            {
                parameters: {
                    values: parameterValues,
                    schema: [{ name: 'kind', type: 'text', required: true, default: 'basic' }],
                },
                expect: {
                    values: expectValues,
                    schema: [
                        { name: 'message', type: 'text', required: true },
                        { name: 'aiCompactionEnabled', type: 'boolean', required: true, default: true },
                    ],
                },
            },
            { strict: true, fillDefaults: 'requiredOnly' },
        );
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({
            parameters: { kind: 'basic' },
            expect: { message: 'hi', aiCompactionEnabled: true },
        });
        expect(result.appliedDefaults).toEqual([
            { domain: 'parameters', path: 'kind', value: 'basic' },
            { domain: 'expect', path: 'aiCompactionEnabled', value: true },
        ]);
        expect(parameterValues).toEqual({});
        expect(expectValues).toEqual({ message: 'hi' });
    });

    it('records a cross-domain fill under the domain that owns the field', async () => {
        const result = await validateFormanWithDomains(
            {
                source: {
                    values: { host: 'localhost' },
                    schema: [
                        {
                            name: 'host',
                            type: 'text',
                            nested: {
                                store: [{ name: 'port', type: 'number', required: true, default: 8080 }],
                                domain: 'default',
                            },
                        },
                    ],
                },
                default: { values: {}, schema: [] },
            },
            { strict: true, fillDefaults: 'requiredOnly' },
        );
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ source: { host: 'localhost' }, default: { port: 8080 } });
        expect(result.appliedDefaults).toEqual([{ domain: 'default', path: 'port', value: 8080 }]);
    });

    it('reports a filled default that fails its own validation, with the value it tried', async () => {
        const schema: FormanSchemaField[] = [
            { name: 'level', type: 'text', required: true, default: 'extreme', validate: { enum: ['low', 'high'] } },
        ];
        const result = await validateForman({}, schema, { strict: true, fillDefaults: 'requiredOnly' });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            { domain: 'default', path: 'level', message: 'Value must be one of the following: low, high' },
        ]);
        expect(result.normalizedValues).toEqual({ default: { level: 'extreme' } });
        expect(result.appliedDefaults).toEqual([{ domain: 'default', path: 'level', value: 'extreme' }]);
    });

    it('changes nothing when the option is off', async () => {
        const result = await validateForman({}, fallbackToggle, { strict: true });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([{ domain: 'default', path: 'fallbackEnabled', message: 'Field is mandatory.' }]);
        expect(result.normalizedValues).toBeUndefined();
        expect(result.appliedDefaults).toBeUndefined();
    });
});
