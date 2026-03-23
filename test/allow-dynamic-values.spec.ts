import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';

describe('allowDynamicValues', () => {
    describe('IML expressions', () => {
        it('should reject IML when allowDynamicValues is false (default)', async () => {
            const result = await validateForman({ name: '{{1.name}}' }, [{ name: 'name', type: 'text' }]);
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: 'Value contains prohibited IML expression.' }),
            ]);
        });

        it('should accept IML when allowDynamicValues is true', async () => {
            const result = await validateForman({ name: '{{1.name}}' }, [{ name: 'name', type: 'text' }], {
                allowDynamicValues: true,
            });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should still reject IML when field.mappable is explicitly false even with allowDynamicValues', async () => {
            const result = await validateForman(
                { name: '{{1.name}}' },
                [{ name: 'name', type: 'text', mappable: false }],
                { allowDynamicValues: true },
            );
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: 'Value contains prohibited IML expression.' }),
            ]);
        });
    });

    describe('select with RPC options', () => {
        const schema: FormanSchemaField[] = [{ name: 'color', type: 'select', options: 'rpc://getColors' }];
        const resolveRemote = () =>
            Promise.resolve([
                { value: 'red', label: 'Red' },
                { value: 'blue', label: 'Blue' },
            ]);

        it('should error when value not in RPC options and allowDynamicValues is false', async () => {
            const result = await validateForman({ color: 'green' }, schema, { resolveRemote });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: "Value 'green' not found in options." }),
            ]);
            expect(result.warnings).toEqual([]);
        });

        it('should warn (not error) when value not in RPC options and allowDynamicValues is true', async () => {
            const result = await validateForman({ color: 'green' }, schema, {
                resolveRemote,
                allowDynamicValues: true,
            });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([
                expect.objectContaining({ message: "Value 'green' not found in options." }),
            ]);
        });

        it('should produce mode:edit state only when allowDynamicValues is true', async () => {
            const result = await validateForman({ color: 'green' }, schema, {
                resolveRemote,
                allowDynamicValues: true,
                states: true,
            });
            expect(result.states).toEqual({
                default: { color: { mode: 'edit' } },
            });
        });

        it('should not produce mode:edit state when allowDynamicValues is false', async () => {
            const result = await validateForman({ color: 'green' }, schema, {
                resolveRemote,
                states: true,
            });
            // Errors → no edit state
            expect(result.valid).toBe(false);
        });
    });

    describe('multiple select with RPC options', () => {
        const schema: FormanSchemaField[] = [
            { name: 'colors', type: 'select', multiple: true, options: 'rpc://getColors' },
        ];
        const resolveRemote = () => Promise.resolve([{ value: 'red', label: 'Red' }]);

        it('should error for missing values when allowDynamicValues is false', async () => {
            const result = await validateForman({ colors: ['red', 'green'] }, schema, { resolveRemote });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                expect.objectContaining({ message: "Value 'green' not found in options." }),
            ]);
        });

        it('should warn for missing values when allowDynamicValues is true', async () => {
            const result = await validateForman({ colors: ['red', 'green'] }, schema, {
                resolveRemote,
                allowDynamicValues: true,
            });
            expect(result.valid).toBe(true);
            expect(result.warnings).toEqual([
                expect.objectContaining({ message: "Value 'green' not found in options." }),
            ]);
        });
    });

    describe('validateFormanWithDomains per-domain flag', () => {
        const schema: FormanSchemaField[] = [{ name: 'field', type: 'text' }];

        it('should allow IML in domain with allowDynamicValues and reject in domain without', async () => {
            const result = await validateFormanWithDomains({
                dynamic: {
                    values: { field: '{{1.value}}' },
                    schema,
                    allowDynamicValues: true,
                },
                static: {
                    values: { field: '{{1.value}}' },
                    schema,
                    allowDynamicValues: false,
                },
            });

            expect(result.valid).toBe(false);
            // Only the static domain should have the error
            expect(result.errors).toEqual([
                expect.objectContaining({
                    domain: 'static',
                    message: 'Value contains prohibited IML expression.',
                }),
            ]);
        });
    });

    describe('editable/mappable field overrides allowDynamicValues for RPC options', () => {
        const resolveRemote = () =>
            Promise.resolve([
                { value: 'red', label: 'Red' },
                { value: 'blue', label: 'Blue' },
            ]);

        describe('select with RPC', () => {
            it('should warn when field has editable: true even if allowDynamicValues is false', async () => {
                const schema: FormanSchemaField[] = [
                    { name: 'color', type: 'select', options: 'rpc://getColors', editable: true },
                ];
                const result = await validateForman({ color: 'green' }, schema, { resolveRemote });
                expect(result.valid).toBe(true);
                expect(result.errors).toEqual([]);
                expect(result.warnings).toEqual([
                    expect.objectContaining({ message: "Value 'green' not found in options." }),
                ]);
            });

            it('should warn when field has mappable: true even if allowDynamicValues is false', async () => {
                const schema: FormanSchemaField[] = [
                    { name: 'color', type: 'select', options: 'rpc://getColors', mappable: true },
                ];
                const result = await validateForman({ color: 'green' }, schema, { resolveRemote });
                expect(result.valid).toBe(true);
                expect(result.errors).toEqual([]);
                expect(result.warnings).toEqual([
                    expect.objectContaining({ message: "Value 'green' not found in options." }),
                ]);
            });

            it('should produce mode:edit state when field has editable: true', async () => {
                const schema: FormanSchemaField[] = [
                    { name: 'color', type: 'select', options: 'rpc://getColors', editable: true },
                ];
                const result = await validateForman({ color: 'green' }, schema, {
                    resolveRemote,
                    states: true,
                });
                expect(result.states).toEqual({
                    default: { color: { mode: 'edit' } },
                });
            });

            it('should still error when field has no editable/mappable flags and allowDynamicValues is false', async () => {
                const schema: FormanSchemaField[] = [{ name: 'color', type: 'select', options: 'rpc://getColors' }];
                const result = await validateForman({ color: 'green' }, schema, { resolveRemote });
                expect(result.valid).toBe(false);
                expect(result.errors).toEqual([
                    expect.objectContaining({ message: "Value 'green' not found in options." }),
                ]);
            });
        });

        describe('multiple select with RPC', () => {
            it('should warn when field has editable: true even if allowDynamicValues is false', async () => {
                const schema: FormanSchemaField[] = [
                    { name: 'colors', type: 'select', multiple: true, options: 'rpc://getColors', editable: true },
                ];
                const result = await validateForman({ colors: ['red', 'green'] }, schema, { resolveRemote });
                expect(result.valid).toBe(true);
                expect(result.warnings).toEqual([
                    expect.objectContaining({ message: "Value 'green' not found in options." }),
                ]);
            });
        });

        describe('path with RPC', () => {
            const resolveRemotePath = () =>
                Promise.resolve([
                    { value: '', label: 'Root', children: true },
                    { value: 'folder1', label: 'Folder 1' },
                ]);

            it('should warn when field has editable: true even if allowDynamicValues is false', async () => {
                const schema: FormanSchemaField[] = [
                    { name: 'path', type: 'folder', options: 'rpc://getFolders', editable: true },
                ];
                const result = await validateForman({ path: '/unknown' }, schema, {
                    resolveRemote: resolveRemotePath,
                });
                expect(result.valid).toBe(true);
                expect(result.errors).toEqual([]);
                expect(result.warnings).toEqual([
                    expect.objectContaining({ message: "Path 'unknown' not found in options." }),
                ]);
            });

            it('should error when field has no editable/mappable flags and allowDynamicValues is false', async () => {
                const schema: FormanSchemaField[] = [{ name: 'path', type: 'folder', options: 'rpc://getFolders' }];
                const result = await validateForman({ path: '/unknown' }, schema, {
                    resolveRemote: resolveRemotePath,
                });
                expect(result.valid).toBe(false);
                expect(result.errors).toEqual([
                    expect.objectContaining({ message: "Path 'unknown' not found in options." }),
                ]);
            });
        });

        describe('IML is NOT affected by editable flag', () => {
            it('should still reject IML when editable: true but allowDynamicValues is false', async () => {
                const result = await validateForman({ name: '{{1.name}}' }, [
                    { name: 'name', type: 'text', editable: true },
                ]);
                expect(result.valid).toBe(false);
                expect(result.errors).toEqual([
                    expect.objectContaining({ message: 'Value contains prohibited IML expression.' }),
                ]);
            });
        });
    });
});
