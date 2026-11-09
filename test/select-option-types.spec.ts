import { describe, expect, it } from '@jest/globals';
import { toFormanSchema, toJSONSchema } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

// No JSON Schema validator is a dependency here, so the refusals below are asserted on the schema
// shape: a `type` that contradicts a `const` refuses every value, no `type` leaves the `const`s in charge.
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
        ],
    };

    const properties = toJSONSchema(formanSchema).properties as Record<string, JSONSchema7>;

    it('emits no type for numeric option values', () => {
        expect(properties['limit']).not.toHaveProperty('type');
        expect(properties['limit']!.oneOf).toEqual([
            { title: 'Empty', const: '' },
            { title: '10', const: 10 },
            { title: '50', const: 50 },
        ]);
        expect(properties['limit']!.default).toBe('');
    });

    it('emits no type for boolean option values', () => {
        expect(properties['archived']).not.toHaveProperty('type');
        expect(properties['archived']!.oneOf).toEqual([
            { title: 'Empty', const: '' },
            { title: 'Yes', const: true },
            { title: 'No', const: false },
        ]);
    });

    it('leaves no type that contradicts an option constant', () => {
        for (const name of ['limit', 'archived']) {
            const field = properties[name]!;
            const types = field.type === undefined ? [] : [field.type].flat();
            for (const entry of field.oneOf as JSONSchema7[]) {
                // Every accepted constant must satisfy the declared type, if there is one.
                if (types.length) expect(types).toContain(typeof entry.const);
            }
        }
    });

    it('keeps type string for string option values', () => {
        expect(properties['color']!.type).toBe('string');
        expect(properties['size']!.type).toBe('string');
        expect(properties['size']!.enum).toEqual(['', 'small', 'large']);
    });

    it('drops the type for numeric options without labels (enum)', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [{ name: 'limit', type: 'select', required: true, options: [{ value: 10 }, { value: 50 }] }],
        });
        const limit = (schema.properties as Record<string, JSONSchema7>)['limit']!;
        expect(limit).not.toHaveProperty('type');
        expect(limit.enum).toEqual([10, 50]);
    });

    it('round-trips through toFormanSchema as a select with the same options', () => {
        const back = toFormanSchema(toJSONSchema(formanSchema));
        const byName = Object.fromEntries((back.spec as FormanSchemaField[]).map(field => [field.name, field]));
        expect(byName['limit']).toMatchObject({ type: 'select', options: [{ value: 10 }, { value: 50 }] });
        expect(byName['archived']).toMatchObject({ type: 'select', options: [{ value: true }, { value: false }] });
        expect(byName['color']).toMatchObject({ type: 'select', options: [{ value: 'red' }, { value: 'blue' }] });
    });
});
