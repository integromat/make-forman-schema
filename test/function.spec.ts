import { describe, expect, it } from '@jest/globals';
import Ajv from 'ajv';
import { activeFieldEdges, toJSONSchemaAdvanced, validateForman, validateFormanWithDomains } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('Function resources (AX-63)', () => {
    const field: FormanSchemaField = {
        name: 'functionId',
        type: 'function',
        required: true,
        mappable: false,
        options: { nested: 'rpc://FunctionInputFieldsRPC?teamId={{teamId}}&functionId={{functionId}}' },
    };

    it('converts the native resource source and dependent input RPC', () => {
        const result = toJSONSchemaAdvanced({ type: 'collection', spec: [field] }, { strictFieldTypes: true });
        const property = result.schema.properties!.functionId as JSONSchema7;
        expect(JSON.parse(JSON.stringify(property))).toMatchObject({
            type: 'string',
            pattern: expect.any(String),
            maxLength: 14,
            'x-fetch': 'api://functions/v2',
            'x-nested': { $ref: 'rpc://FunctionInputFieldsRPC?teamId={{teamId}}&functionId={{functionId}}' },
        });
        expect(result.schema.required).toEqual(['functionId']);
        expect(result.skippedPaths?.unconvertible).toBeUndefined();
    });

    it.each(['FN2_1', 'FN2_123', 'FN2_2147483647'])(
        'preserves %s and validates its generated inputs',
        async functionId => {
            const values = { functionId, count: 7 };
            const calls: string[] = [];
            const result = await validateForman(values, [field], {
                strict: true,
                states: true,
                schemas: true,
                resolveRemote: async (path, context) => {
                    calls.push(path);
                    if (path === 'api://functions/v2')
                        return [{ value: functionId, label: 'Invoice (123)', name: 'Invoice', active: false }];
                    expect(context.functionId).toBe(functionId);
                    return [{ name: 'count', type: 'integer', required: true }];
                },
            });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(calls).toEqual([
                'api://functions/v2',
                'rpc://FunctionInputFieldsRPC?teamId={{teamId}}&functionId={{functionId}}',
            ]);
            expect(values).toEqual({ functionId, count: 7 });
            expect(result.states ?? {}).not.toMatchObject({ default: { functionId: { mode: 'edit' } } });
            expect(result.schemas!.default).toEqual(
                expect.arrayContaining([expect.objectContaining({ name: 'count' })]),
            );
        },
    );

    it.each([undefined, null, ''])('rejects missing required reference %p', async functionId => {
        const result = await validateForman({ functionId }, [field]);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            expect.objectContaining({ path: 'functionId', message: 'Field is mandatory.' }),
        ]);
    });

    it.each([
        123,
        '123',
        'FN2_0',
        'FN2_01',
        'FN2_-1',
        'FN2_1.5',
        'FN2_2147483648',
        'FN2_1\n',
        'SCN_123',
        '{{1.id}}',
        { id: 123 },
        [123],
        true,
        false,
    ])('rejects invalid reference %p even when mapping is allowed by the caller', async functionId => {
        let calls = 0;
        const result = await validateForman({ functionId }, [{ ...field, mappable: true }], {
            allowDynamicValues: true,
            resolveRemote: async () => {
                calls++;
                return [];
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            expect.objectContaining({
                path: 'functionId',
                message: 'Expected a Function reference FN2_<positive integer> within the API ID range.',
            }),
        ]);
        expect(calls).toBe(0);
    });

    it.each([false, true])(
        'reports unavailable references with allowDynamicValues=%p without mapping restore',
        async allowDynamicValues => {
            const calls: string[] = [];
            const result = await validateForman({ functionId: 'FN2_999' }, [{ ...field, options: undefined }], {
                allowDynamicValues,
                states: true,
                resolveRemote: async path => {
                    calls.push(path);
                    return [{ value: 'FN2_123', label: 'Invoice' }];
                },
            });
            expect(calls).toEqual(['api://functions/v2']);
            expect(result.valid).toBe(allowDynamicValues);
            expect(allowDynamicValues ? result.warnings : result.errors).toEqual([
                expect.objectContaining({ path: 'functionId', message: "Value 'FN2_999' not found in options." }),
            ]);
            expect(result.states ?? {}).not.toMatchObject({ default: { functionId: { mode: 'edit' } } });
        },
    );

    it.each(['picker', 'inputs'])('propagates %s failures', async failedRequest => {
        const result = await validateForman({ functionId: 'FN2_123' }, [field], {
            resolveRemote: async path => {
                if (failedRequest === 'picker' || path.startsWith('rpc://')) throw new Error('Unavailable');
                return [{ value: 'FN2_123' }];
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('Unavailable') })]),
        );
    });

    it('rejects missing required generated inputs', async () => {
        const result = await validateForman({ functionId: 'FN2_123' }, [field], {
            resolveRemote: async path =>
                path.startsWith('api://')
                    ? [{ value: 'FN2_123' }]
                    : [{ name: 'count', type: 'integer', required: true }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([expect.objectContaining({ path: 'count', message: 'Field is mandatory.' })]);
    });

    it('routes static parameters to mapped inputs in the expect domain', async () => {
        const result = await validateFormanWithDomains(
            {
                parameters: {
                    values: { functionId: 'FN2_123' },
                    schema: [
                        { ...field, options: { nested: { domain: 'expect', store: 'rpc://FunctionInputFieldsRPC' } } },
                    ],
                },
                expect: { values: { data: '{{1.payload}}' }, schema: [], allowDynamicValues: true },
            },
            {
                strict: true,
                states: true,
                resolveRemote: async path =>
                    path.startsWith('api://')
                        ? [{ value: 'FN2_123', label: 'Invoice', active: false }]
                        : [
                              {
                                  name: 'data',
                                  type: 'collection',
                                  required: true,
                                  spec: [{ name: 'text', type: 'text', required: true }],
                              },
                          ],
            },
        );
        expect(result.valid).toBe(true);
        expect(result.states).toMatchObject({ parameters: { functionId: { label: 'Invoice' } } });
        expect(result.states ?? {}).not.toMatchObject({ parameters: { functionId: { mode: 'edit' } } });
    });

    it('retains custom option keys', async () => {
        const custom: FormanSchemaField = {
            ...field,
            options: { store: 'api://functions/v2', value: 'reference', label: 'name' },
        };
        const converted = toJSONSchemaAdvanced(custom).schema;
        expect(JSON.parse(JSON.stringify(converted))['x-fetch-options']).toMatchObject({
            value: 'reference',
            label: 'name',
        });
        const result = await validateForman({ functionId: 'FN2_123' }, [custom], {
            resolveRemote: async () => [{ reference: 'FN2_123', name: 'Invoice', active: true }],
        });
        expect(result.valid).toBe(true);
    });

    it('switches option-dependent input forms and their traversal edges', async () => {
        const schema: FormanSchemaField[] = [
            {
                ...field,
                options: [
                    { value: 'FN2_123', nested: [{ name: 'count', type: 'integer', required: true }] },
                    { value: 'FN2_456', nested: [{ name: 'text', type: 'text', required: true }] },
                ],
            },
        ];
        const first = await validateForman({ functionId: 'FN2_123', count: 7 }, schema, { strict: true });
        const second = await validateForman({ functionId: 'FN2_456', text: 'Invoice' }, schema, { strict: true });
        const missing = await validateForman({ functionId: 'FN2_456' }, schema);
        expect(first.valid).toBe(true);
        expect(second.valid).toBe(true);
        expect(missing.errors).toEqual([expect.objectContaining({ path: 'text', message: 'Field is mandatory.' })]);
        expect(activeFieldEdges(schema[0]!, 'FN2_456')).toEqual([
            expect.objectContaining({ children: [{ name: 'text', type: 'text', required: true }] }),
        ]);
        const converted = toJSONSchemaAdvanced({ type: 'collection', spec: schema }).schema;
        expect((converted.properties!.functionId as JSONSchema7).type).toBe('string');
    });
    it.each([false, true])(
        'validates optional/required empty references with Ajv defaults (required=%p)',
        async required => {
            const schema = toJSONSchemaAdvanced({ type: 'collection', spec: [{ ...field, required }] }).schema;
            const check = new Ajv({ strict: false, useDefaults: true }).compile(schema);
            for (const values of [{}, { functionId: '' }]) {
                expect(check(values)).toBe(!required);
                expect((await validateForman(values, [{ ...field, required }])).valid).toBe(!required);
            }
        },
    );

    it.each([
        ['FN2_1', true],
        ['FN2_999999999', true],
        ['FN2_1000000000', true],
        ['FN2_1999999999', true],
        ['FN2_2000000000', true],
        ['FN2_2099999999', true],
        ['FN2_2100000000', true],
        ['FN2_2139999999', true],
        ['FN2_2140000000', true],
        ['FN2_2146999999', true],
        ['FN2_2147000000', true],
        ['FN2_2147399999', true],
        ['FN2_2147400000', true],
        ['FN2_2147479999', true],
        ['FN2_2147480000', true],
        ['FN2_2147482999', true],
        ['FN2_2147483000', true],
        ['FN2_2147483599', true],
        ['FN2_2147483600', true],
        ['FN2_2147483639', true],
        ['FN2_2147483640', true],
        ['FN2_2147483647', true],
        ['FN2_2147483648', false],
        ['FN2_2147483650', false],
        ['FN2_2147483700', false],
        ['FN2_2147484000', false],
        ['FN2_2147490000', false],
        ['FN2_2147500000', false],
        ['FN2_2148000000', false],
        ['FN2_2150000000', false],
        ['FN2_2200000000', false],
        ['FN2_3000000000', false],
        ['FN2_9999999999', false],
        ['FN2_10000000000', false],
        ['FN2_0', false],
        ['FN2_01', false],
        ['FN2_-1', false],
        ['FN2_1.5', false],
        ['FN2_1\n', false],
        ['FN2_1\r', false],
        ['FN2_1\u2028', false],
        ['FN2_1 ', false],
        ['123', false],
        ['SCN_123', false],
        ['{{1.id}}', false],
        [123, false],
        [true, false],
        [{ id: 123 }, false],
        [[123], false],
    ])('keeps generated and runtime validation consistent for %p', async (functionId, valid) => {
        const schema = toJSONSchemaAdvanced({ type: 'collection', spec: [field] }).schema;
        const check = new Ajv({ strict: false, useDefaults: true }).compile(schema);
        expect(check({ functionId })).toBe(valid);
        const result = await validateForman({ functionId }, [field], {
            resolveRemote: async path => (path.startsWith('api://') ? [{ value: functionId }] : []),
        });
        expect(result.valid).toBe(valid);
    });
});
