import { describe, expect, it } from '@jest/globals';
import { toFormanSchema, toJSONSchema } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

// No JSON Schema validator is a dependency here, so the refusals are asserted on the schema shape:
// a `type` that contradicts a `const` refuses every value.
describe('Select type follows its option values', () => {
    const formanSchema: FormanSchemaField = {
        type: 'collection',
        spec: [
            {
                name: 'limit',
                type: 'select',
                options: [
                    { label: '10', value: 10 },
                    { label: '50', value: 50 },
                ],
            },
            {
                name: 'archived',
                type: 'select',
                options: [
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                ],
            },
            {
                name: 'color',
                type: 'select',
                options: [
                    { label: 'Red', value: 'red' },
                    { label: 'Blue', value: 'blue' },
                ],
            },
            {
                name: 'size',
                type: 'select',
                options: [{ value: 'small' }, { value: 'large' }],
            },
            {
                name: 'parent',
                type: 'select',
                required: true,
                options: [
                    { label: 'None', value: null },
                    { label: 'Root', value: 'root' },
                ],
            },
            {
                name: 'connection',
                type: 'account',
                options: [
                    { label: 'Main', value: 1 },
                    { label: 'Backup', value: 2 },
                ],
            },
            {
                name: 'mode',
                type: 'radio',
                required: true,
                options: [{ value: 1 }, { value: 2 }],
            },
        ],
    };

    const properties = toJSONSchema(formanSchema).properties as Record<string, JSONSchema7>;

    it('types an optional numeric select as string (empty choice) or number', () => {
        expect(properties['limit']!.type).toEqual(['string', 'number']);
        expect(properties['limit']!.oneOf).toEqual([
            { title: 'Empty', const: '' },
            { title: '10', const: 10 },
            { title: '50', const: 50 },
        ]);
        expect(properties['limit']!.default).toBe('');
    });

    it('types an optional boolean select as string (empty choice) or boolean', () => {
        expect(properties['archived']!.type).toEqual(['string', 'boolean']);
        expect(properties['archived']!.oneOf).toEqual([
            { title: 'Empty', const: '' },
            { title: 'Yes', const: true },
            { title: 'No', const: false },
        ]);
    });

    it('types a null option as null, not object', () => {
        expect(properties['parent']!.type).toEqual(['null', 'string']);
    });

    it('types a reference with static options by the options, empty choice included', () => {
        expect(properties['connection']!.type).toEqual(['string', 'number']);
    });

    it('types a required numeric radio as number', () => {
        expect(properties['mode']!.type).toBe('number');
        expect(properties['mode']!.enum).toEqual([1, 2]);
    });

    it('keeps type string for string option values', () => {
        expect(properties['color']!.type).toBe('string');
        expect(properties['size']!.type).toBe('string');
        expect(properties['size']!.enum).toEqual(['', 'small', 'large']);
    });

    it('leaves no type that contradicts an option constant', () => {
        const typeOf = (value: unknown) => (value === null ? 'null' : typeof value);
        for (const [name, field] of Object.entries(properties)) {
            const types = [field.type].flat();
            const values = field.enum ?? (field.oneOf as JSONSchema7[]).map(entry => entry.const);
            for (const value of values) expect([name, types]).toEqual([name, expect.arrayContaining([typeOf(value)])]);
        }
    });

    it('types a required numeric select (enum) as number', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [{ name: 'limit', type: 'select', required: true, options: [{ value: 10 }, { value: 50 }] }],
        });
        const limit = (schema.properties as Record<string, JSONSchema7>)['limit']!;
        expect(limit.type).toBe('number');
        expect(limit.enum).toEqual([10, 50]);
    });

    it('ignores options without a value when typing', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'broken',
                    type: 'select',
                    required: true,
                    options: [{ label: 'No value' } as never, { label: 'Ten', value: 10 }],
                },
                { name: 'empty', type: 'select', required: true, options: [{ label: 'No value' } as never] },
            ],
        });
        const properties = schema.properties as Record<string, JSONSchema7>;
        expect(properties['broken']!.type).toBe('number');
        expect(properties['empty']!.type).toBe('string');
    });

    it('keeps the mapped type for a select with remote options', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [{ name: 'list', type: 'select', options: 'rpc://lists' }],
        });
        expect((schema.properties as Record<string, JSONSchema7>)['list']!.type).toBe('string');
    });

    it('round-trips through toFormanSchema as a select with the same options', () => {
        const back = toFormanSchema(toJSONSchema(formanSchema));
        const byName = Object.fromEntries((back.spec as FormanSchemaField[]).map(field => [field.name, field]));
        expect(byName['limit']).toMatchObject({ type: 'select', options: [{ value: 10 }, { value: 50 }] });
        expect(byName['archived']).toMatchObject({ type: 'select', options: [{ value: true }, { value: false }] });
        expect(byName['color']).toMatchObject({ type: 'select', options: [{ value: 'red' }, { value: 'blue' }] });
        expect(byName['parent']).toMatchObject({ type: 'select', options: [{ value: null }, { value: 'root' }] });
        expect(byName['mode']).toMatchObject({ type: 'select', options: [{ value: 1 }, { value: 2 }] });
    });

    it('recovers a typeless option list as a select', () => {
        expect(toFormanSchema({ enum: [10, 50] })).toMatchObject({
            type: 'select',
            options: [{ value: 10 }, { value: 50 }],
        });
    });

    it('keeps default and search of a hand-written schema recovered as a select', () => {
        const schema = {
            type: 'integer',
            title: 'N',
            enum: [1, 2],
            default: 1,
            minimum: 1,
            'x-search': { url: 'rpc://searchN', label: 'Search', inputSchema: { $ref: 'rpc://searchNParams' } },
        } as JSONSchema7;
        expect(toFormanSchema(schema)).toMatchObject({
            type: 'select',
            label: 'N',
            default: 1,
            options: [{ value: 1 }, { value: 2 }],
            rpc: { url: 'rpc://searchN', label: 'Search', parameters: 'rpc://searchNParams' },
        });
    });

    it('does not turn the artificial empty default into a select default', () => {
        const back = toFormanSchema(toJSONSchema({ type: 'select', options: [{ value: 'a' }] }));
        expect(back).not.toHaveProperty('default');
    });
});
