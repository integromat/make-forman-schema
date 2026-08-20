import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src';

describe('schemas output', () => {
    it('should return flat schema fields for static nested selects', async () => {
        const result = await validateForman(
            { color: 'red', size: 'large' },
            [
                {
                    name: 'color',
                    type: 'select',
                    label: 'Color',
                    required: true,
                    options: [
                        {
                            value: 'red',
                            label: 'Red',
                            nested: [
                                {
                                    name: 'size',
                                    type: 'select',
                                    label: 'Size',
                                    options: [{ value: 'large', label: 'Large' }],
                                },
                            ],
                        },
                        { value: 'blue', label: 'Blue' },
                    ],
                },
            ],
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas).toEqual({
            default: [
                { name: 'color', type: 'select', label: 'Color', required: true, validate: { enum: ['red', 'blue'] } },
                { name: 'size', type: 'select', label: 'Size', validate: { enum: ['large'] } },
            ],
        });
    });

    it('should return schemas for cross-domain nested fields', async () => {
        const result = await validateFormanWithDomains(
            {
                source: {
                    values: { mode: 'a' },
                    schema: [
                        {
                            name: 'mode',
                            type: 'select',
                            label: 'Mode',
                            options: {
                                store: [{ value: 'a', label: 'A' }],
                                nested: {
                                    store: [{ name: 'extra', type: 'text', label: 'Extra' }],
                                    domain: 'target',
                                },
                            },
                        },
                    ],
                },
                target: {
                    values: { extra: 'hello' },
                    schema: [],
                },
            },
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas!.source).toEqual([
            { name: 'mode', type: 'select', label: 'Mode', validate: { enum: ['a'] } },
        ]);
        expect(result.schemas!.target).toEqual([{ name: 'extra', type: 'text', label: 'Extra' }]);
    });

    it('should expand nested fields when value contains IML expression', async () => {
        const result = await validateForman(
            { field: '{{something}}' },
            [
                {
                    name: 'field',
                    type: 'text',
                    label: 'Field',
                    nested: [{ name: 'sub', type: 'number', label: 'Sub' }],
                },
            ],
            { schemas: true, allowDynamicValues: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas).toEqual({
            default: [
                { name: 'field', type: 'text', label: 'Field' },
                { name: 'sub', type: 'number', label: 'Sub' },
            ],
        });
    });

    it('should include RPC-resolved nested fields', async () => {
        const result = await validateForman(
            { picker: 'x' },
            [
                {
                    name: 'picker',
                    type: 'select',
                    label: 'Picker',
                    options: {
                        store: 'rpc://options',
                        nested: 'rpc://fields',
                    },
                },
            ],
            {
                schemas: true,
                resolveRemote: async path => {
                    if (path === 'rpc://options') return [{ value: 'x', label: 'X' }];
                    if (path === 'rpc://fields') return [{ name: 'resolved', type: 'text', label: 'Resolved' }];
                    return [];
                },
            },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas).toEqual({
            default: [
                { name: 'picker', type: 'select', label: 'Picker' },
                { name: 'resolved', type: 'text', label: 'Resolved' },
            ],
        });
    });

    it('should preserve spec in array fields (stripped recursively)', async () => {
        const result = await validateForman(
            { items: [{ a: 'hello' }] },
            [
                {
                    name: 'items',
                    type: 'array',
                    label: 'Items',
                    spec: [{ name: 'a', type: 'text', label: 'A', help: 'some help', multiline: true }],
                },
            ],
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas).toEqual({
            default: [
                {
                    name: 'items',
                    type: 'array',
                    label: 'Items',
                    spec: [{ name: 'a', type: 'text', label: 'A' }],
                },
            ],
        });
    });

    it('should not return schemas when schemas option is false', async () => {
        const result = await validateForman({ x: 'hello' }, [{ name: 'x', type: 'text' }], { schemas: false });

        expect(result.valid).toBe(true);
        expect(result.schemas).toBeUndefined();
    });

    it('should not return schemas when schemas option is not set', async () => {
        const result = await validateForman({ x: 'hello' }, [{ name: 'x', type: 'text' }]);

        expect(result.valid).toBe(true);
        expect(result.schemas).toBeUndefined();
    });

    it('should not return schemas when validation fails', async () => {
        const result = await validateForman({}, [{ name: 'x', type: 'text', required: true }], { schemas: true });

        expect(result.valid).toBe(false);
        expect(result.schemas).toBeUndefined();
    });

    it('should strip blocklisted properties from schema fields', async () => {
        const result = await validateForman(
            { field: 'val' },
            [
                {
                    name: 'field',
                    type: 'text',
                    label: 'Field',
                    help: 'Help text',
                    disabled: true,
                    multiline: true,
                    tags: 'strip',
                    rpc: { url: 'rpc://something', parameters: [] },
                    advanced: true,
                    semantic: 'email',
                    mappable: true,
                    validate: { min: 1 },
                    custom: 'preserved',
                } as any,
            ],
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        const field = result.schemas!['default']![0];
        expect(field).toEqual({
            name: 'field',
            type: 'text',
            label: 'Field',
            advanced: true,
            semantic: 'email',
            mappable: true,
            validate: { min: 1 },
            custom: 'preserved',
        });
        // Ensure blocklisted properties are absent
        expect(field).not.toHaveProperty('help');
        expect(field).not.toHaveProperty('disabled');
        expect(field).not.toHaveProperty('multiline');
        expect(field).not.toHaveProperty('tags');
        expect(field).not.toHaveProperty('rpc');
    });

    it('should generate validate.enum for select fields with flat inline options', async () => {
        const result = await validateForman(
            { color: 'red' },
            [
                {
                    name: 'color',
                    type: 'select',
                    label: 'Color',
                    options: [
                        { value: 'red', label: 'Red' },
                        { value: 'blue', label: 'Blue' },
                    ],
                },
            ],
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas!['default']![0]).toEqual({
            name: 'color',
            type: 'select',
            label: 'Color',
            validate: { enum: ['red', 'blue'] },
        });
    });

    it('should generate validate.enum for select fields with grouped options', async () => {
        const result = await validateForman(
            { fruit: 'apple' },
            [
                {
                    name: 'fruit',
                    type: 'select',
                    label: 'Fruit',
                    grouped: true,
                    options: [
                        {
                            label: 'Citrus',
                            options: [
                                { value: 'orange', label: 'Orange' },
                                { value: 'lemon', label: 'Lemon' },
                            ],
                        },
                        {
                            label: 'Other',
                            options: [{ value: 'apple', label: 'Apple' }],
                        },
                    ],
                },
            ],
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas!['default']![0]).toEqual({
            name: 'fruit',
            type: 'select',
            label: 'Fruit',
            grouped: true,
            validate: { enum: ['orange', 'lemon', 'apple'] },
        });
    });

    it('should preserve existing validate.enum on select fields', async () => {
        const result = await validateForman(
            { color: 'red' },
            [
                {
                    name: 'color',
                    type: 'select',
                    label: 'Color',
                    validate: { enum: ['red', 'green', 'blue'] },
                    options: [
                        { value: 'red', label: 'Red' },
                        { value: 'blue', label: 'Blue' },
                    ],
                },
            ],
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas!['default']![0]).toEqual({
            name: 'color',
            type: 'select',
            label: 'Color',
            validate: { enum: ['red', 'green', 'blue'] },
        });
    });

    it('should not generate validate.enum for RPC-sourced select options', async () => {
        const result = await validateForman(
            { picker: 'x' },
            [
                {
                    name: 'picker',
                    type: 'select',
                    label: 'Picker',
                    options: 'rpc://options',
                },
            ],
            {
                schemas: true,
                resolveRemote: async () => [{ value: 'x', label: 'X' }],
            },
        );

        expect(result.valid).toBe(true);
        const field = result.schemas!['default']![0];
        expect(field).not.toHaveProperty('validate');
    });

    it('strips the embedded schema from json fields in schemas output', async () => {
        const result = await validateForman(
            { payload: { name: 'Alice' } },
            [
                {
                    name: 'payload',
                    type: 'json',
                    label: 'Payload',
                    schema: { type: 'object', properties: { name: { type: 'string' } } },
                },
            ],
            { schemas: true },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas!['default']![0]).toEqual({ name: 'payload', type: 'json', label: 'Payload' });
        expect(result.schemas!['default']![0]).not.toHaveProperty('schema');
    });
});

describe('resolvedSchemas on the failure path', () => {
    // The reported bug (MAIA-1290): a module whose fields only exist once a parent
    // selection is made. The validator resolves the sub-form, judges against it, and
    // then discards it — leaving the caller unable to name the fields it rejected.
    const scenarioPicker = [
        {
            name: 'scenario',
            type: 'select',
            label: 'Scenario',
            required: true,
            options: {
                store: 'rpc://scenario-service/1/RpcListScenarios',
                nested: 'rpc://scenario-service/1/RpcGetInputs',
            },
        },
    ];

    const resolveRemote = async (path: string) =>
        path.includes('RpcGetInputs')
            ? [
                  { name: 'blueprint', type: 'text', label: 'Blueprint', required: true },
                  { name: 'errorType', type: 'text', label: 'Error type' },
              ]
            : [{ value: 12345, label: 'T99 Lexoffice Master' }];

    it('exposes the resolved sub-form when validation FAILS', async () => {
        const result = await validateForman({ scenario: 12345 }, scenarioPicker, {
            schemas: true,
            resolveRemote,
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
            expect.objectContaining({ path: 'blueprint', message: 'Field is mandatory.' }),
        );

        // `schemas` stays success-only: callers treat its presence as a success signal.
        expect(result.schemas).toBeUndefined();

        // ...but the resolved spec, which the validator already built to reach the verdict
        // above, is now reachable — so a caller can name `blueprint` instead of guessing.
        expect(result.resolvedSchemas!.default).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'blueprint', type: 'text', required: true }),
                expect.objectContaining({ name: 'errorType', type: 'text' }),
            ]),
        );
    });

    it('still exposes them when validation succeeds', async () => {
        const result = await validateForman({ scenario: 12345, blueprint: 'x' }, scenarioPicker, {
            schemas: true,
            resolveRemote,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedSchemas).toEqual(result.schemas);
    });

    it('is omitted when the schemas option is off', async () => {
        const result = await validateForman({ scenario: 12345 }, scenarioPicker, { resolveRemote });

        expect(result.valid).toBe(false);
        expect(result.resolvedSchemas).toBeUndefined();
    });
});
