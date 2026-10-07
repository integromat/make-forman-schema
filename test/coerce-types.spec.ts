import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';

const TYPE_ERROR = (expected: string) => `Expected type '${expected}', got type 'string'.`;

describe('coerceTypes', () => {
    const numeric: FormanSchemaField[] = [
        { name: 'timeout', type: 'number' },
        { name: 'limit', type: 'integer' },
        { name: 'nMetafields', type: 'uinteger' },
        { name: 'port', type: 'port' },
        { name: 'account', type: 'account' },
    ];

    it('is off by default: a numeric string still fails the type check', async () => {
        const result = await validateForman({ timeout: '300' }, numeric);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([{ domain: 'default', path: 'timeout', message: TYPE_ERROR('number') }]);
        expect(result.appliedCoercions).toEqual([]);
    });

    it('rewrites decimal-literal strings to numbers on every number-mapped type and reports them', async () => {
        const values = { timeout: '300', limit: ' 10 ', nMetafields: '0', port: '8080', account: '127565' };
        const result = await validateForman(values, numeric, {
            strict: true,
            coerceTypes: true,
            // `account` resolves its options remotely; the coerced id must be what the lookup compares.
            resolveRemote: async () => [{ label: 'Work mailbox', value: 127565 }],
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.normalizedValues).toEqual({
            default: { timeout: 300, limit: 10, nMetafields: 0, port: 8080, account: 127565 },
        });
        expect(result.appliedCoercions).toEqual([
            { domain: 'default', path: 'timeout', value: 300 },
            { domain: 'default', path: 'limit', value: 10 },
            { domain: 'default', path: 'nMetafields', value: 0 },
            { domain: 'default', path: 'port', value: 8080 },
            { domain: 'default', path: 'account', value: 127565 },
        ]);
        // The caller's object is never mutated.
        expect(values.timeout).toBe('300');
    });

    it('accepts negative and fractional literals and leaves already-typed values untouched', async () => {
        const result = await validateForman({ timeout: '-1.5', limit: 7 }, numeric, { coerceTypes: true });
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({ default: { timeout: -1.5, limit: 7 } });
        expect(result.appliedCoercions).toEqual([{ domain: 'default', path: 'timeout', value: -1.5 }]);
    });

    it.each(['', ' ', '1e3', '0x10', '3,5', '1_000', 'Infinity', 'NaN', 'abc', '12abc'])(
        'leaves %j alone and lets the ordinary type check judge it',
        async raw => {
            const result = await validateForman({ timeout: raw }, numeric, { coerceTypes: true });
            expect(result.appliedCoercions).toEqual([]);
            if (raw === '') {
                // '' is an omission, not a value — same as without coercion. ' ' is a value.
                expect(result.valid).toBe(true);
            } else {
                expect(result.valid).toBe(false);
                expect(result.errors).toEqual([{ domain: 'default', path: 'timeout', message: TYPE_ERROR('number') }]);
            }
        },
    );

    it('never rewrites a string carrying an IML expression', async () => {
        const result = await validateForman({ timeout: '{{1.timeout}}', limit: 'x{{1.n}}' }, numeric, {
            coerceTypes: true,
            allowDynamicValues: true,
        });
        expect(result.appliedCoercions).toEqual([]);
        // A whole-string pill passes the type check as before; a mixed string is rejected as before.
        expect(result.errors).toEqual([{ domain: 'default', path: 'limit', message: TYPE_ERROR('number') }]);
    });

    it('the coerced number is what validate.min/max see', async () => {
        const schema: FormanSchemaField[] = [{ name: 'limit', type: 'integer', validate: { min: 1, max: 100 } }];
        const ok = await validateForman({ limit: '50' }, schema, { coerceTypes: true });
        expect(ok.valid).toBe(true);
        const tooBig = await validateForman({ limit: '500' }, schema, { coerceTypes: true });
        expect(tooBig.valid).toBe(false);
        expect(tooBig.errors[0]?.message).not.toBe(TYPE_ERROR('number'));
        expect(tooBig.normalizedValues).toEqual({ default: { limit: 500 } });
    });

    describe('booleans', () => {
        const toggle: FormanSchemaField[] = [
            {
                name: 'enabled',
                type: 'boolean',
                nested: [{ name: 'target', type: 'text', required: true }],
            },
            { name: 'flag', type: 'checkbox' },
        ];

        it("rewrites 'true'/'false' (any case, trimmed) on boolean and checkbox fields", async () => {
            const result = await validateForman({ enabled: 'FALSE', flag: ' true ' }, toggle, { coerceTypes: true });
            expect(result.valid).toBe(true);
            expect(result.normalizedValues).toEqual({ default: { enabled: false, flag: true } });
            expect(result.appliedCoercions).toEqual([
                { domain: 'default', path: 'enabled', value: false },
                { domain: 'default', path: 'flag', value: true },
            ]);
        });

        it('a coerced true arms the nested branch, so its required field is enforced', async () => {
            const result = await validateForman({ enabled: 'true' }, toggle, { coerceTypes: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([{ domain: 'default', path: 'target', message: 'Field is mandatory.' }]);
        });

        it.each(['yes', '1', '0', 'on', ''])('leaves %j alone', async raw => {
            const result = await validateForman({ flag: raw }, toggle, { coerceTypes: true });
            expect(result.appliedCoercions).toEqual([]);
            expect(result.valid).toBe(raw === '');
        });
    });

    it('applies inside nested collections and arrays, reporting dot-joined paths', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'modelConfig',
                type: 'collection',
                spec: [
                    { name: 'recursionLimit', type: 'uinteger' },
                    { name: 'iterationsFromHistoryCount', type: 'uinteger' },
                ],
            },
            { name: 'ids', type: 'array', spec: { type: 'integer' } },
        ];
        const result = await validateForman(
            { modelConfig: { recursionLimit: '25', iterationsFromHistoryCount: '5' }, ids: ['1', 2, '3'] },
            schema,
            { coerceTypes: true },
        );
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({
            default: { modelConfig: { recursionLimit: 25, iterationsFromHistoryCount: 5 }, ids: [1, 2, 3] },
        });
        expect(result.appliedCoercions.map(c => c.path)).toEqual([
            'modelConfig.recursionLimit',
            'modelConfig.iterationsFromHistoryCount',
            'ids.0',
            'ids.2',
        ]);
    });

    it('works per domain and composes with fillDefaults on normalizedValues', async () => {
        const result = await validateFormanWithDomains(
            {
                default: {
                    values: { timeout: '40' },
                    schema: [
                        { name: 'timeout', type: 'uinteger' },
                        { name: 'retries', type: 'uinteger', required: true, default: 3 },
                    ],
                },
                expect: {
                    values: { max_tokens: '1024' },
                    schema: [{ name: 'max_tokens', type: 'integer' }],
                    allowDynamicValues: true,
                },
            },
            { coerceTypes: true, fillDefaults: 'requiredOnly' },
        );
        expect(result.valid).toBe(true);
        expect(result.normalizedValues).toEqual({
            default: { timeout: 40, retries: 3 },
            expect: { max_tokens: 1024 },
        });
        expect(result.appliedDefaults).toEqual([{ domain: 'default', path: 'retries', value: 3 }]);
        expect(result.appliedCoercions).toEqual([
            { domain: 'default', path: 'timeout', value: 40 },
            { domain: 'expect', path: 'max_tokens', value: 1024 },
        ]);
    });

    it('does not touch select, text or json fields even when their value looks numeric', async () => {
        const schema: FormanSchemaField[] = [
            { name: 'mode', type: 'select', options: [{ label: 'One', value: '1' }] },
            { name: 'note', type: 'text' },
            { name: 'blob', type: 'json' },
        ];
        const result = await validateForman({ mode: '1', note: '42', blob: '7' }, schema, { coerceTypes: true });
        expect(result.valid).toBe(true);
        expect(result.appliedCoercions).toEqual([]);
        expect(result.normalizedValues).toEqual({ default: { mode: '1', note: '42', blob: '7' } });
    });
});
