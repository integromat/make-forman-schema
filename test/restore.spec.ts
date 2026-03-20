import { describe, expect, it } from '@jest/globals';
import { validateForman } from '../src/index.js';

describe('Restore state for IML-mapped fields', () => {
    it('should produce mode: edit for select with static options and IML value', async () => {
        const result = await validateForman(
            { color: '{{1.color}}' },
            [
                {
                    name: 'color',
                    type: 'select',
                    options: [
                        { value: 'red', label: 'Red' },
                        { value: 'blue', label: 'Blue' },
                    ],
                },
            ],
            { states: true },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    color: { mode: 'edit' },
                },
            },
        });
    });

    it('should produce mode: edit for select with RPC options and IML value', async () => {
        const result = await validateForman(
            { item: '{{1.item}}' },
            [{ name: 'item', type: 'select', options: { store: 'rpc://getItems' } }],
            { states: true },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    item: { mode: 'edit' },
                },
            },
        });
    });

    it('should produce mode: edit for file field with IML value', async () => {
        const result = await validateForman({ doc: '{{1.fileId}}' }, [{ name: 'doc', type: 'file' }], { states: true });

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    doc: { mode: 'edit' },
                },
            },
        });
    });

    it('should produce mode: edit for folder field with IML value', async () => {
        const result = await validateForman({ dir: '{{1.folderId}}' }, [{ name: 'dir', type: 'folder' }], {
            states: true,
        });

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    dir: { mode: 'edit' },
                },
            },
        });
    });

    it('should produce mode: edit for boolean field with IML value', async () => {
        const result = await validateForman({ flag: '{{1.isActive}}' }, [{ name: 'flag', type: 'boolean' }], {
            states: true,
        });

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    flag: { mode: 'edit' },
                },
            },
        });
    });

    it('should produce mode: edit when dynamic select value is not found in RPC options', async () => {
        const result = await validateForman(
            { item: 'missing-value' },
            [{ name: 'item', type: 'select', options: 'rpc://getItems' }],
            {
                states: true,
                resolveRemote() {
                    return Promise.resolve([
                        { value: 'a', label: 'Option A' },
                        { value: 'b', label: 'Option B' },
                    ]);
                },
            },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [
                {
                    domain: 'default',
                    path: 'item',
                    message: "Value 'missing-value' not found in options.",
                },
            ],
            states: {
                default: {
                    item: { mode: 'edit' },
                },
            },
        });
    });

    it('should produce mode: edit when multiple select has unresolved values from RPC', async () => {
        const result = await validateForman(
            { items: ['a', 'missing'] },
            [{ name: 'items', type: 'select', multiple: true, options: 'rpc://getItems' }],
            {
                states: true,
                resolveRemote() {
                    return Promise.resolve([
                        { value: 'a', label: 'Option A' },
                        { value: 'b', label: 'Option B' },
                    ]);
                },
            },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [
                {
                    domain: 'default',
                    path: 'items',
                    message: "Value 'missing' not found in options.",
                },
            ],
            states: {
                default: {
                    items: { mode: 'edit' },
                },
            },
        });
    });

    it('should still produce mode: chose for non-mapped select', async () => {
        const result = await validateForman(
            { color: 'red' },
            [
                {
                    name: 'color',
                    type: 'select',
                    options: [
                        { value: 'red', label: 'Red' },
                        { value: 'blue', label: 'Blue' },
                    ],
                },
            ],
            { states: true },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    color: { label: 'Red', mode: 'chose' },
                },
            },
        });
    });
});
