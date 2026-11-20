import { describe, expect, it } from '@jest/globals';
import { activeFieldEdges, toJSONSchemaAdvanced, validateForman, validateFormanWithDomains } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('Function selector (AX-63)', () => {
    const field: FormanSchemaField = {
        name: 'functionId',
        type: 'function',
        required: true,
        mappable: true,
        options: {
            store: 'rpc://ListFunctionsRPC?teamId={{teamId}}',
            nested: 'rpc://FunctionInputFieldsRPC?teamId={{teamId}}&functionId={{functionId}}',
        },
    };

    it('converts the picker and input RPCs without losing metadata or scalar ID types', () => {
        const result = toJSONSchemaAdvanced({ type: 'collection', spec: [field] }, { strictFieldTypes: true });
        const property = result.schema.properties!.functionId as JSONSchema7;
        expect(property.type).toEqual(['number', 'string']);
        expect(JSON.parse(JSON.stringify(property))).toMatchObject({
            'x-fetch': 'rpc://ListFunctionsRPC?teamId={{teamId}}',
            'x-nested': { $ref: 'rpc://FunctionInputFieldsRPC?teamId={{teamId}}&functionId={{functionId}}' },
        });
        expect(result.schema.required).toEqual(['functionId']);
        expect(result.skippedPaths?.unconvertible).toBeUndefined();
    });

    it.each([123, '123'])('preserves ID %p and validates its current generated input form', async functionId => {
        const values = { functionId, count: 7 };
        const calls: string[] = [];
        const result = await validateForman(values, [field], {
            strict: true,
            states: true,
            schemas: true,
            resolveRemote: async (path, context) => {
                calls.push(path);
                if (path.startsWith('rpc://ListFunctionsRPC')) {
                    return [{ value: functionId, label: 'Invoice (123)', name: 'Invoice', active: false }];
                }
                expect(context.functionId).toBe(functionId);
                return [{ name: 'count', type: 'integer', required: true }];
            },
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(calls).toEqual([
            'rpc://ListFunctionsRPC?teamId={{teamId}}',
            'rpc://FunctionInputFieldsRPC?teamId={{teamId}}&functionId={{functionId}}',
        ]);
        expect(values).toEqual({ functionId, count: 7 });
        expect(result.schemas!.default).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'count' })]));
    });

    it.each([undefined, null, ''])('rejects missing required ID %p', async functionId => {
        const result = await validateForman({ functionId }, [field]);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            expect.objectContaining({ path: 'functionId', message: 'Field is mandatory.' }),
        ]);
    });

    it.each([{ id: 123 }, [123], true, false])('rejects non-scalar ID %p even in a mapped domain', async functionId => {
        let calls = 0;
        const result = await validateForman({ functionId }, [field], {
            allowDynamicValues: true,
            resolveRemote: async () => {
                calls++;
                return [];
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            expect.objectContaining({ path: 'functionId', message: 'Expected a number or string Function ID.' }),
        ]);
        expect(calls).toBe(0);
    });

    it.each([false, true])('reports unavailable IDs with allowDynamicValues=%p', async allowDynamicValues => {
        const calls: string[] = [];
        const result = await validateForman(
            { functionId: 999 },
            [{ ...field, mappable: false, options: 'rpc://ListFunctionsRPC' }],
            {
                allowDynamicValues,
                resolveRemote: async path => {
                    calls.push(path);
                    return [{ value: 123, label: 'Invoice' }];
                },
            },
        );
        expect(calls).toEqual(['rpc://ListFunctionsRPC']);
        expect(result.valid).toBe(allowDynamicValues);
        expect(allowDynamicValues ? result.warnings : result.errors).toEqual([
            expect.objectContaining({ path: 'functionId', message: "Value '999' not found in options." }),
        ]);
    });

    it.each(['picker', 'inputs'])('propagates %s RPC failures', async failedRpc => {
        const result = await validateForman({ functionId: 123 }, [field], {
            resolveRemote: async path => {
                if (failedRpc === 'picker' || path.startsWith('rpc://FunctionInputFieldsRPC'))
                    throw new Error('Unavailable');
                return [{ value: 123 }];
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('Unavailable') })]),
        );
    });

    it('rejects missing required generated inputs', async () => {
        const result = await validateForman({ functionId: 123 }, [field], {
            resolveRemote: async path =>
                path.startsWith('rpc://ListFunctionsRPC')
                    ? [{ value: 123 }]
                    : [{ name: 'count', type: 'integer', required: true }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([expect.objectContaining({ path: 'count', message: 'Field is mandatory.' })]);
    });

    it('preserves whole-input mapping and mapped Function IDs in the mapper domain', async () => {
        const values = { functionId: '{{1.functionId}}', input: '{{1.payload}}' };
        const calls: string[] = [];
        const result = await validateFormanWithDomains(
            { expect: { values, schema: [field], allowDynamicValues: true } },
            {
                strict: true,
                resolveRemote: async path => {
                    calls.push(path);
                    return [
                        {
                            name: 'input',
                            type: 'collection',
                            required: true,
                            spec: [{ name: 'text', type: 'text', required: true }],
                        },
                    ];
                },
            },
        );
        expect(result.valid).toBe(true);
        expect(calls).toEqual(['rpc://FunctionInputFieldsRPC?teamId={{teamId}}&functionId={{functionId}}']);
        expect(values).toEqual({ functionId: '{{1.functionId}}', input: '{{1.payload}}' });
    });

    it('preserves custom option keys in conversion and option validation', async () => {
        const custom: FormanSchemaField = {
            ...field,
            options: { store: 'rpc://ListFunctionsRPC', value: 'id', label: 'name' },
        };
        const converted = toJSONSchemaAdvanced(custom).schema;
        expect(JSON.parse(JSON.stringify(converted))['x-fetch-options']).toMatchObject({ value: 'id', label: 'name' });
        const result = await validateForman({ functionId: 123 }, [custom], {
            resolveRemote: async () => [{ id: 123, name: 'Invoice', active: true }],
        });
        expect(result.valid).toBe(true);
    });

    it('uses option-dependent nested fields when switching Functions', async () => {
        const schema: FormanSchemaField[] = [
            {
                ...field,
                options: [
                    { value: 123, nested: [{ name: 'count', type: 'integer', required: true }] },
                    { value: 456, nested: [{ name: 'text', type: 'text', required: true }] },
                ],
            },
        ];
        const first = await validateForman({ functionId: 123, count: 7 }, schema, { strict: true });
        const second = await validateForman({ functionId: 456, text: 'Invoice' }, schema, { strict: true });
        const missing = await validateForman({ functionId: 456 }, schema);
        expect(first.valid).toBe(true);
        expect(second.valid).toBe(true);
        expect(missing.errors).toEqual([expect.objectContaining({ path: 'text', message: 'Field is mandatory.' })]);
        const property = toJSONSchemaAdvanced({ type: 'collection', spec: schema }).schema.properties!
            .functionId as JSONSchema7;
        expect(property.type).toBe('number');
    });

    it('retains optional placeholder nesting in conversion, validation, and field edges', async () => {
        const placeholder = [{ name: 'fallback', type: 'text', required: true }];
        const optional: FormanSchemaField = {
            ...field,
            required: false,
            options: { store: [{ value: 123 }], placeholder: { label: 'Choose', nested: placeholder } },
        };
        const result = await validateForman({ functionId: '' }, [optional]);
        expect(result.errors).toEqual([expect.objectContaining({ path: 'fallback', message: 'Field is mandatory.' })]);
        expect(activeFieldEdges(optional, '')).toEqual([expect.objectContaining({ children: placeholder })]);
        const schema = toJSONSchemaAdvanced({ type: 'collection', spec: [optional] }).schema;
        expect(JSON.stringify(schema.allOf)).toContain('fallback');
    });

    it('retains select-compatible enum metadata in resolved schemas', async () => {
        const result = await validateForman(
            { functionId: 123 },
            [{ ...field, options: [{ value: 123 }, { value: 456 }] }],
            { schemas: true },
        );
        expect(result.schemas!.default).toEqual([
            expect.objectContaining({ name: 'functionId', type: 'function', validate: { enum: ['123', '456'] } }),
        ]);
    });
});
