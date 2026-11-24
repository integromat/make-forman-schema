import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import { toFormanSchema, toJSONSchema, validateForman } from '../src/index.js';

const NUMERIC_KEYWORDS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'];
const LENGTH_KEYWORDS = ['minLength', 'maxLength'];

describe('validate.min / validate.max conversion', () => {
    it('converts a text field limit to minLength', () => {
        expect(toJSONSchema({ name: 'name', type: 'text', validate: { min: 1 } })).toEqual({
            type: 'string',
            minLength: 1,
        });
    });

    it('converts a text field limit to maxLength', () => {
        expect(toJSONSchema({ name: 'name', type: 'text', validate: { max: 255 } })).toEqual({
            type: 'string',
            maxLength: 255,
        });
    });

    it('converts both text field limits and emits no numeric keyword', () => {
        const schema = toJSONSchema({ name: 'name', type: 'text', validate: { min: 1, max: 255 } });

        expect(schema).toEqual({ type: 'string', minLength: 1, maxLength: 255 });
        for (const keyword of NUMERIC_KEYWORDS) expect(schema).not.toHaveProperty(keyword);
    });

    it.each(['url', 'email', 'password', 'editor', 'date'])('converts a %s field limit to a length', type => {
        const schema = toJSONSchema({ name: 'f', type, validate: { min: 2, max: 10 } } as any);

        expect(schema).toMatchObject({ type: 'string', minLength: 2, maxLength: 10 });
        for (const keyword of NUMERIC_KEYWORDS) expect(schema).not.toHaveProperty(keyword);
    });

    it.each(['number', 'integer', 'uinteger', 'port'])('keeps minimum / maximum on a %s field', type => {
        const schema = toJSONSchema({ name: 'n', type, validate: { min: 1, max: 100 } } as any);

        expect(schema).toEqual({ type: 'number', minimum: 1, maximum: 100 });
        for (const keyword of LENGTH_KEYWORDS) expect(schema).not.toHaveProperty(keyword);
    });

    it.each(['boolean', 'checkbox', 'any', 'hidden'])('emits no limit keyword on a %s field', type => {
        const schema = toJSONSchema({ name: 'f', type, validate: { min: 1, max: 5 } } as any);

        for (const keyword of [...NUMERIC_KEYWORDS, ...LENGTH_KEYWORDS]) expect(schema).not.toHaveProperty(keyword);
    });

    it('emits no min / max keyword on an array field, which only bounds items', () => {
        const schema = toJSONSchema({
            name: 'tags',
            type: 'array',
            spec: { type: 'text' },
            validate: { min: 1, max: 5, minItems: 1, maxItems: 3 },
        } as any);

        expect(schema).toMatchObject({ type: 'array', minItems: 1, maxItems: 3 });
        for (const keyword of [...NUMERIC_KEYWORDS, ...LENGTH_KEYWORDS]) expect(schema).not.toHaveProperty(keyword);
    });

    it('converts limits inside a collection the same way', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                { name: 'name', type: 'text', validate: { min: 1, max: 255 } },
                { name: 'count', type: 'number', validate: { min: 0, max: 10 } },
            ],
        });

        expect(schema.properties).toEqual({
            name: { type: 'string', minLength: 1, maxLength: 255 },
            count: { type: 'number', minimum: 0, maximum: 10 },
        });
    });

    it('enforces the same text limits as the validator', async () => {
        const field = { name: 'name', type: 'text', validate: { min: 2, max: 4 } } as const;

        expect((await validateForman({ name: 'a' }, [field])).errors[0]?.message).toBe(
            'Value must be at least 2 characters long.',
        );
        expect((await validateForman({ name: 'abcde' }, [field])).errors[0]?.message).toBe(
            'Value exceeded maximum length of 4 characters.',
        );
        expect((await validateForman({ name: 'abc' }, [field])).valid).toBe(true);
    });
});

describe('length limit round trip through toFormanSchema', () => {
    it('reads minLength / maxLength on a string schema back into validate.min / validate.max', () => {
        expect(toFormanSchema({ type: 'string', minLength: 1, maxLength: 255 })).toEqual({
            type: 'text',
            validate: { min: 1, max: 255 },
        });
    });

    it('round-trips a text field with min, max and both', () => {
        for (const validate of [{ min: 1 }, { max: 255 }, { min: 1, max: 255 }]) {
            const field = { name: 'name', type: 'text', label: 'Name', validate } as const;

            expect(toFormanSchema(toJSONSchema(field))).toEqual({ type: 'text', label: 'Name', validate });
        }
    });

    it('keeps the length limits next to pattern', () => {
        const schema: JSONSchema7 = { type: 'string', pattern: '^a', minLength: 2 };

        expect(toFormanSchema(schema)).toEqual({ type: 'text', validate: { pattern: '^a', min: 2 } });
    });

    it('round-trips a number field unchanged', () => {
        const field = { name: 'n', type: 'number', validate: { min: 0, max: 10 } } as const;

        expect(toFormanSchema(toJSONSchema(field))).toEqual({ type: 'number', validate: { min: 0, max: 10 } });
    });
});
