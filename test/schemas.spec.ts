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
});
