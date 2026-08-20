import { describe, expect, it } from '@jest/globals';
import { FormanSchemaField, validateForman } from '../src';

describe('Required fields with a schema default', () => {
    const fallbackToggle: FormanSchemaField[] = [
        {
            name: 'fallbackEnabled',
            type: 'boolean',
            label: 'Enable fallback connection',
            required: true,
            default: false,
            nested: [
                {
                    name: 'fallbackConnectionId',
                    type: 'text',
                    label: 'Fallback connection',
                    required: true,
                },
            ],
        },
    ];

    it('should satisfy an absent required field from its default', async () => {
        const result = await validateForman({}, fallbackToggle, { strict: true });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('should apply the default before conditioning nested fields', async () => {
        const result = await validateForman({ fallbackConnectionId: 'legacy-value' }, fallbackToggle, { strict: true });
        expect(result.valid).toBe(true);
    });

    it('should enforce the branch the default activates', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'compactionEnabled',
                type: 'boolean',
                required: true,
                default: true,
                nested: [{ name: 'compactionThreshold', type: 'number', required: true }],
            },
        ];
        const result = await validateForman({}, schema, { strict: true });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            { domain: 'default', path: 'compactionThreshold', message: 'Field is mandatory.' },
        ]);
    });

    it('should still reject an absent required field with no default', async () => {
        const schema: FormanSchemaField[] = [{ name: 'connection', type: 'text', required: true }];
        const result = await validateForman({}, schema, { strict: true });
        expect(result.errors).toEqual([{ domain: 'default', path: 'connection', message: 'Field is mandatory.' }]);
    });

    it('should treat a null default as no default', async () => {
        const schema: FormanSchemaField[] = [{ name: 'source', type: 'text', required: true, default: null as never }];
        const result = await validateForman({}, schema, { strict: true });
        expect(result.errors).toEqual([{ domain: 'default', path: 'source', message: 'Field is mandatory.' }]);
    });

    it('should still reject a value the caller explicitly cleared', async () => {
        const schema: FormanSchemaField[] = [{ name: 'mode', type: 'text', required: true, default: 'select' }];
        expect((await validateForman({ mode: null }, schema, { strict: true })).errors).toEqual([
            { domain: 'default', path: 'mode', message: 'Field is mandatory.' },
        ]);
        expect((await validateForman({ mode: '' }, schema, { strict: true })).errors).toEqual([
            { domain: 'default', path: 'mode', message: 'Field is mandatory.' },
        ]);
    });

    it('should apply a falsy default rather than reporting it absent', async () => {
        const schema: FormanSchemaField[] = [
            { name: 'retries', type: 'number', required: true, default: 0 },
            { name: 'verbose', type: 'boolean', required: true, default: false },
        ];
        const result = await validateForman({}, schema, { strict: true });
        expect(result.valid).toBe(true);
    });

    it('should apply defaults inside a collection', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'modelConfig',
                type: 'collection',
                spec: [{ name: 'recursionLimit', type: 'number', required: true, default: 300 }],
            },
        ];
        const result = await validateForman({ modelConfig: {} }, schema, { strict: true });
        expect(result.valid).toBe(true);
    });
});
