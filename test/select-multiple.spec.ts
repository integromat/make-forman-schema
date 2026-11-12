import { describe, expect, it } from '@jest/globals';
import { fieldEdges, toFormanSchema, toJSONSchema, validateForman } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

const marker = (schema: JSONSchema7, name: string) => Object.getOwnPropertyDescriptor(schema, name)?.value;

describe('Multiple select converts to an array', () => {
    const formanSchema: FormanSchemaField = {
        type: 'collection',
        spec: [
            {
                name: 'fields',
                type: 'select',
                label: 'Fields',
                help: 'Fields to return.',
                multiple: true,
                options: [
                    { label: 'ID', value: 'id' },
                    { label: 'Description', value: 'description' },
                ],
            },
            {
                name: 'tags',
                type: 'select',
                multiple: true,
                required: true,
                options: [{ value: 'a' }, { value: 'b' }],
                validate: { minItems: 1, maxItems: 2 },
            },
            {
                name: 'limits',
                type: 'select',
                multiple: true,
                required: true,
                options: [{ value: 10 }, { value: 50 }],
            },
            {
                name: 'colors',
                type: 'select',
                multiple: true,
                options: 'rpc://getColors',
            },
            {
                name: 'modes',
                type: 'radio',
                multiple: true,
                options: [{ value: 'x' }, { value: 'y' }],
            },
            {
                name: 'single',
                type: 'select',
                options: [{ value: 'one' }],
            },
        ],
    };

    const properties = toJSONSchema(formanSchema).properties as Record<string, JSONSchema7>;

    it('types a multiple select as an array of its option values (IEN-17244)', () => {
        expect(properties['fields']).toEqual({
            type: 'array',
            title: 'Fields',
            description: 'Fields to return.',
            items: {
                type: 'string',
                oneOf: [
                    { title: 'ID', const: 'id' },
                    { title: 'Description', const: 'description' },
                ],
            },
            'x-multiple': true,
        });
    });

    it('adds no empty choice or empty default to an optional multiple select', () => {
        const fields = properties['fields']!;
        expect(fields).not.toHaveProperty('default');
        expect((fields.items as JSONSchema7).oneOf).not.toContainEqual(expect.objectContaining({ const: '' }));
    });

    it('maps minItems / maxItems and keeps an enum in items', () => {
        expect(properties['tags']).toMatchObject({
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: { type: 'string', enum: ['a', 'b'] },
        });
    });

    it('types the items by the option values', () => {
        expect(properties['limits']!.items).toEqual({ type: 'number', enum: [10, 50] });
    });

    it('keeps x-fetch on the field and types the items by the mapped type for remote options', () => {
        const colors = properties['colors']!;
        expect(colors.type).toBe('array');
        expect(colors.items).toEqual({ type: 'string' });
        expect(marker(colors, 'x-fetch')).toBe('rpc://getColors');
    });

    it('applies to other select-like types', () => {
        expect(properties['modes']).toMatchObject({ type: 'array', items: { type: 'string', enum: ['x', 'y'] } });
    });

    it('leaves a single select unchanged', () => {
        expect(properties['single']).toMatchObject({ type: 'string', enum: ['', 'one'] });
    });

    it('does not apply to file / folder pickers', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [{ name: 'file', type: 'file', multiple: true, options: 'rpc://files' }],
        });
        expect((schema.properties as Record<string, JSONSchema7>)['file']!.type).toBe('string');
    });

    it('emits no per-option conditions, but keeps the field-level nested on the array', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'kinds',
                    type: 'select',
                    multiple: true,
                    options: [{ value: 'a', nested: [{ name: 'onlyA', type: 'text' }] }, { value: 'b' }],
                    nested: 'rpc://kindFields',
                },
            ],
        });
        expect(schema).not.toHaveProperty('allOf');
        const kinds = (schema.properties as Record<string, JSONSchema7>)['kinds']!;
        expect(kinds.type).toBe('array');
        expect(marker(kinds, 'x-nested')).toBeDefined();
    });

    it('round-trips through toFormanSchema as a multiple select', () => {
        const back = toFormanSchema(toJSONSchema(formanSchema));
        const byName = Object.fromEntries((back.spec as FormanSchemaField[]).map(field => [field.name, field]));
        expect(byName['fields']).toMatchObject({
            type: 'select',
            label: 'Fields',
            help: 'Fields to return.',
            multiple: true,
            options: [{ value: 'id' }, { value: 'description' }],
        });
        expect(byName['tags']).toMatchObject({
            type: 'select',
            multiple: true,
            validate: { minItems: 1, maxItems: 2 },
            options: [{ value: 'a' }, { value: 'b' }],
        });
        expect(byName['limits']).toMatchObject({
            type: 'select',
            multiple: true,
            options: [{ value: 10 }, { value: 50 }],
        });
        expect(byName['colors']).toMatchObject({ type: 'select', multiple: true });
        expect(byName['single']).not.toHaveProperty('multiple');
    });

    it('still round-trips a plain array of selects as an array', () => {
        const back = toFormanSchema(
            toJSONSchema({ type: 'array', spec: { type: 'select', options: [{ value: 'a' }] } as FormanSchemaField }),
        );
        expect(back.type).toBe('array');
        expect(back).not.toHaveProperty('multiple');
    });

    it('round-trips the search directive of a multiple select', () => {
        const back = toFormanSchema(
            toJSONSchema({
                type: 'collection',
                spec: [
                    {
                        name: 'users',
                        type: 'select',
                        multiple: true,
                        options: 'rpc://users',
                        rpc: { label: 'Search', url: 'rpc://searchUsers', parameters: [{ name: 'q', type: 'text' }] },
                    },
                ],
            }),
        );
        expect((back.spec as FormanSchemaField[])[0]).toMatchObject({
            type: 'select',
            multiple: true,
            rpc: { label: 'Search', url: 'rpc://searchUsers', parameters: [{ name: 'q', type: 'text' }] },
        });
    });

    it('has only the field-level edge, matching the converter', () => {
        const field: FormanSchemaField = {
            name: 'kinds',
            type: 'select',
            multiple: true,
            options: {
                store: [{ value: 'a', nested: [{ name: 'onlyA', type: 'text' }] }],
                nested: [{ name: 'always', type: 'text' }],
                placeholder: { label: 'None', nested: [{ name: 'whenEmpty', type: 'text' }] },
            },
        };
        expect(fieldEdges(field)).toEqual([{ children: [{ name: 'always', type: 'text' }] }]);
    });

    // The validator accepts an empty value for an optional field before any type check, so `''` passes it,
    // while the schema demands an array so agents send one. Pinned so the difference stays deliberate.
    it('is stricter than the validator for an empty optional multiple select', async () => {
        const spec: FormanSchemaField[] = [{ name: 'tags', type: 'select', multiple: true, options: [{ value: 'a' }] }];
        expect((await validateForman({ tags: '' }, spec)).valid).toBe(true);
        expect((await validateForman({ tags: 'a' }, spec)).valid).toBe(false);
        const tags = (toJSONSchema({ type: 'collection', spec }).properties as Record<string, JSONSchema7>)['tags']!;
        expect(tags.type).toBe('array');
    });
});
