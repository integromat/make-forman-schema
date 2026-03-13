import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';

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
                                { name: 'size', type: 'select', label: 'Size', options: [{ value: 'large', label: 'Large' }] },
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
                { name: 'color', type: 'select', label: 'Color', required: true },
                { name: 'size', type: 'select', label: 'Size' },
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
            { name: 'mode', type: 'select', label: 'Mode' },
        ]);
        expect(result.schemas!.target).toEqual([
            { name: 'extra', type: 'text', label: 'Extra' },
        ]);
    });

    it('should expand nested fields when value contains IML expression', async () => {
        const result = await validateForman(
            { field: '{{something}}' },
            [
                {
                    name: 'field',
                    type: 'text',
                    label: 'Field',
                    nested: [
                        { name: 'sub', type: 'number', label: 'Sub' },
                    ],
                },
            ],
            { schemas: true },
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
                resolveRemote: async (path) => {
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
                    spec: [
                        { name: 'a', type: 'text', label: 'A', help: 'some help', multiline: true },
                    ],
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
        const result = await validateForman(
            { x: 'hello' },
            [{ name: 'x', type: 'text' }],
            { schemas: false },
        );

        expect(result.valid).toBe(true);
        expect(result.schemas).toBeUndefined();
    });

    it('should not return schemas when schemas option is not set', async () => {
        const result = await validateForman(
            { x: 'hello' },
            [{ name: 'x', type: 'text' }],
        );

        expect(result.valid).toBe(true);
        expect(result.schemas).toBeUndefined();
    });

    it('should not return schemas when validation fails', async () => {
        const result = await validateForman(
            {},
            [{ name: 'x', type: 'text', required: true }],
            { schemas: true },
        );

        expect(result.valid).toBe(false);
        expect(result.schemas).toBeUndefined();
    });

    it('should strip non-essential properties from schema fields', async () => {
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
                },
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
        });
        // Ensure stripped properties are absent
        expect(field).not.toHaveProperty('help');
        expect(field).not.toHaveProperty('disabled');
        expect(field).not.toHaveProperty('multiline');
        expect(field).not.toHaveProperty('tags');
        expect(field).not.toHaveProperty('rpc');
    });
});
