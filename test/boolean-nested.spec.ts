import { describe, expect, it } from '@jest/globals';
import type { FormanSchemaField } from '../src/index.js';
import { validateForman } from '../src/index.js';

describe('Boolean nested conditioning', () => {
    describe('single-branch nested (applies when true)', () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'advanced',
                type: 'boolean',
                label: 'Advanced settings',
                nested: [
                    {
                        name: 'timeout',
                        type: 'number',
                        label: 'Timeout',
                        required: true,
                    },
                ],
            },
        ];

        it('should not require nested fields when the toggle is false', async () => {
            const result = await validateForman({ advanced: false }, schema, { strict: true });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should require nested fields when the toggle is true', async () => {
            const result = await validateForman({ advanced: true }, schema, { strict: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                {
                    domain: 'default',
                    path: 'timeout',
                    message: 'Field is mandatory.',
                },
            ]);
        });

        it('should accept a true toggle with the nested field provided', async () => {
            const result = await validateForman({ advanced: true, timeout: 30 }, schema, { strict: true });
            expect(result.valid).toBe(true);
        });

        it('should keep an absent toggle valid', async () => {
            const result = await validateForman({}, schema, { strict: true });
            expect(result.valid).toBe(true);
        });

        it('should keep nested values of a false toggle known to strict mode', async () => {
            const result = await validateForman({ advanced: false, timeout: 30 }, schema, { strict: true });
            expect(result.valid).toBe(true);
        });

        it('should still type-check nested values of a false toggle', async () => {
            const result = await validateForman({ advanced: false, timeout: 'thirty' }, schema, { strict: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                {
                    domain: 'default',
                    path: 'timeout',
                    message: "Expected type 'number', got type 'string'.",
                },
            ]);
        });
    });

    describe('reversedNested', () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'simple',
                type: 'boolean',
                label: 'Simple mode',
                reversedNested: true,
                nested: [
                    {
                        name: 'config',
                        type: 'text',
                        label: 'Config',
                        required: true,
                    },
                ],
            },
        ];

        it('should require nested fields when the toggle is false', async () => {
            const result = await validateForman({ simple: false }, schema, { strict: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                {
                    domain: 'default',
                    path: 'config',
                    message: 'Field is mandatory.',
                },
            ]);
        });

        it('should not require nested fields when the toggle is true', async () => {
            const result = await validateForman({ simple: true }, schema, { strict: true });
            expect(result.valid).toBe(true);
        });
    });

    describe('two-branch object form', () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'sendEmail',
                type: 'boolean',
                label: 'Send email',
                nested: {
                    true: [
                        {
                            name: 'recipient',
                            type: 'text',
                            label: 'Recipient',
                            required: true,
                        },
                    ],
                    false: [
                        {
                            name: 'skipReason',
                            type: 'text',
                            label: 'Skip reason',
                            required: true,
                        },
                    ],
                },
            },
        ];

        it('should enforce the true branch when the value is true', async () => {
            const invalid = await validateForman({ sendEmail: true }, schema, { strict: true });
            expect(invalid.valid).toBe(false);
            expect(invalid.errors).toEqual([
                {
                    domain: 'default',
                    path: 'recipient',
                    message: 'Field is mandatory.',
                },
            ]);

            const valid = await validateForman({ sendEmail: true, recipient: 'a@b.c' }, schema, { strict: true });
            expect(valid.valid).toBe(true);
        });

        it('should enforce the false branch when the value is false', async () => {
            const invalid = await validateForman({ sendEmail: false }, schema, { strict: true });
            expect(invalid.valid).toBe(false);
            expect(invalid.errors).toEqual([
                {
                    domain: 'default',
                    path: 'skipReason',
                    message: 'Field is mandatory.',
                },
            ]);

            const valid = await validateForman({ sendEmail: false, skipReason: 'opted out' }, schema, {
                strict: true,
            });
            expect(valid.valid).toBe(true);
        });

        it('should ignore reversedNested when nested is an object', async () => {
            const reversedSchema: FormanSchemaField[] = [
                {
                    ...schema[0]!,
                    reversedNested: true,
                },
            ];
            const result = await validateForman({ sendEmail: true }, reversedSchema, { strict: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual([
                {
                    domain: 'default',
                    path: 'recipient',
                    message: 'Field is mandatory.',
                },
            ]);
        });

        it('should skip a missing branch', async () => {
            const singleBranchSchema: FormanSchemaField[] = [
                {
                    name: 'sendEmail',
                    type: 'boolean',
                    label: 'Send email',
                    nested: {
                        true: [
                            {
                                name: 'recipient',
                                type: 'text',
                                label: 'Recipient',
                                required: true,
                            },
                        ],
                    },
                },
            ];
            const result = await validateForman({ sendEmail: false }, singleBranchSchema, {});
            expect(result.valid).toBe(true);
        });
    });

    describe('RPC string nested', () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'flag',
                type: 'boolean',
                label: 'Flag',
                nested: 'rpc://renderFields',
            },
        ];
        const resolveRemote = (path: string): Promise<unknown> => {
            if (path === 'rpc://renderFields') {
                return Promise.resolve([
                    {
                        name: 'child',
                        type: 'text',
                        label: 'Child',
                        required: true,
                    },
                ]);
            }
            return Promise.resolve([]);
        };

        it('should resolve and enforce nested fields when the toggle is true', async () => {
            const invalid = await validateForman({ flag: true }, schema, { strict: true, resolveRemote });
            expect(invalid.valid).toBe(false);
            expect(invalid.errors).toEqual([
                {
                    domain: 'default',
                    path: 'child',
                    message: 'Field is mandatory.',
                },
            ]);

            const valid = await validateForman({ flag: true, child: 'value' }, schema, {
                strict: true,
                resolveRemote,
            });
            expect(valid.valid).toBe(true);
        });

        it('should not enforce RPC nested fields when the toggle is false', async () => {
            const result = await validateForman({ flag: false }, schema, { strict: true, resolveRemote });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });
    });
});
