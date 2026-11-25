import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import { type FormanSchemaField, toFormanSchema, toJSONSchema, toJSONSchemaAdvanced } from '../src/index.js';

/** Marks a hand-written schema the way the converter does. */
function sensitive(schema: JSONSchema7): JSONSchema7 {
    Object.defineProperty(schema, 'x-sensitive', { configurable: true, enumerable: true, writable: true, value: true });
    return schema;
}

describe('password and pkey fields carry x-sensitive', () => {
    it.each(['password', 'pkey'])('converts a %s field to a string marked x-sensitive', type => {
        expect(toJSONSchema({ name: 'secret', type } as any)).toEqual({ type: 'string', 'x-sensitive': true });
    });

    it.each(['Password', 'PASSWORD', 'PKey', 'PKEY'])('resolves the casing %s before stamping the marker', type => {
        expect(toJSONSchema({ name: 'secret', type } as any)).toEqual({ type: 'string', 'x-sensitive': true });
    });

    it.each(['text', 'email', 'url', 'uuid', 'editor', 'date', 'time', 'color', 'cert', 'buffer'])(
        'stamps no marker on a %s field',
        type => {
            expect(toJSONSchema({ name: 'f', type } as any)).not.toHaveProperty('x-sensitive');
        },
    );

    it('emits no format keyword for a secret field', () => {
        expect(toJSONSchema({ name: 'p', type: 'password' })).not.toHaveProperty('format');
        expect(toJSONSchema({ name: 'k', type: 'pkey' })).not.toHaveProperty('format');
    });

    it('stamps no marker on a field degraded to the permissive shape', () => {
        const { schema, skippedPaths } = toJSONSchemaAdvanced({ name: 'f', type: 'passwrd' } as any);

        expect(schema).not.toHaveProperty('x-sensitive');
        expect(skippedPaths?.unconvertible).toEqual(['f (unknown type: passwrd)']);
    });

    it('stamps no marker on a kind-suffixed password, which the type map leaves typeless', () => {
        expect(toJSONSchema({ name: 'f', type: 'password:x' } as any)).toEqual({});
    });

    it('keeps label, help, default, length limits and pattern beside the marker', () => {
        const schema = toJSONSchema({
            name: 'pass',
            type: 'password',
            label: 'Password',
            help: 'Your password',
            default: 'x',
            validate: { min: 8, max: 64, pattern: '^\\S+$' },
        });

        expect(schema).toEqual({
            type: 'string',
            title: 'Password',
            description: 'Your password',
            default: 'x',
            minLength: 8,
            maxLength: 64,
            pattern: '^\\S+$',
            'x-sensitive': true,
        });
    });

    it('carries x-sensitive and x-multiline together on a multiline pkey', () => {
        expect(toJSONSchema({ name: 'key', type: 'pkey', label: 'Private key', multiline: true })).toEqual({
            type: 'string',
            title: 'Private key',
            'x-sensitive': true,
            'x-multiline': true,
        });
    });

    it('carries x-sensitive beside x-search on a password with its own rpc', () => {
        const schema = toJSONSchema({ name: 'p', type: 'password', rpc: { url: 'rpc://keys', label: 'Find' } } as any);

        expect(schema).toMatchObject({ type: 'string', 'x-sensitive': true, 'x-search': { url: 'rpc://keys' } });
    });

    it("stamps the marker on a field among an rpc's parameters", () => {
        const schema = toJSONSchema({
            name: 'q',
            type: 'text',
            rpc: { url: 'rpc://search', parameters: [{ name: 'token', type: 'password' }] },
        } as any);

        expect((schema as any)['x-search'].inputSchema.properties).toEqual({
            token: { type: 'string', 'x-sensitive': true },
        });
    });

    it('stamps the marker inside a collection', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                { name: 'user', type: 'text' },
                { name: 'pass', type: 'password', required: true },
            ],
        });

        expect(schema.properties).toEqual({
            user: { type: 'string' },
            pass: { type: 'string', 'x-sensitive': true },
        });
    });

    it('stamps the marker on an array item', () => {
        expect(toJSONSchema({ name: 'keys', type: 'array', spec: { type: 'pkey' } } as any).items).toEqual({
            type: 'string',
            'x-sensitive': true,
        });
        expect(toJSONSchema({ name: 'creds', type: 'array', spec: [{ name: 'p', type: 'password' }] }).items).toEqual({
            type: 'object',
            properties: { p: { type: 'string', 'x-sensitive': true } },
            required: [],
        });
    });

    it("stamps the marker in a select option's nested fields (allOf / if / then)", () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'auth',
                    type: 'select',
                    options: [
                        { value: 'basic', nested: [{ name: 'pass', type: 'password' }] },
                        { value: 'key', nested: [{ name: 'key', type: 'pkey' }] },
                    ],
                },
            ],
        });

        expect(schema.allOf).toEqual([
            {
                if: { properties: { auth: { const: 'basic' } } },
                then: {
                    type: 'object',
                    properties: { pass: { type: 'string', 'x-sensitive': true } },
                    required: [],
                },
            },
            {
                if: { properties: { auth: { const: 'key' } } },
                then: {
                    type: 'object',
                    properties: { key: { type: 'string', 'x-sensitive': true } },
                    required: [],
                },
            },
        ]);
    });

    it("stamps the marker in a select's field-level nested fields (x-nested)", () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'mode',
                    type: 'select',
                    options: [{ value: 'a' }],
                    nested: [{ name: 'secret', type: 'password' }],
                },
            ],
        });

        expect((schema.properties!.mode as any)['x-nested']).toEqual({
            type: 'object',
            properties: { secret: { type: 'string', 'x-sensitive': true } },
            required: [],
        });
    });

    it('keeps the marker on a password with multiple: true, which is not select-like', () => {
        expect(toJSONSchema({ name: 'p', type: 'password', multiple: true } as any)).toEqual({
            type: 'string',
            'x-sensitive': true,
        });
    });

    it('stamps the marker on a kept advanced field and drops it with the field under excludeAdvancedFields', () => {
        const field: FormanSchemaField = {
            type: 'collection',
            spec: [
                { name: 'user', type: 'password' },
                { name: 'pass', type: 'password', advanced: true },
            ],
        };

        expect(toJSONSchema(field).properties!.pass).toEqual({
            type: 'string',
            'x-sensitive': true,
            'x-advanced': true,
        });

        const { schema, skippedPaths } = toJSONSchemaAdvanced(field, { excludeAdvancedFields: true });
        expect(schema.properties).toEqual({ user: { type: 'string', 'x-sensitive': true } });
        expect(skippedPaths).toEqual({ advanced: ['pass'] });
    });

    it('defines the marker like the other markers and keeps it through JSON serialization', () => {
        const schema = toJSONSchema({ name: 'p', type: 'password' });

        expect(Object.getOwnPropertyDescriptor(schema, 'x-sensitive')).toEqual({
            configurable: true,
            enumerable: true,
            writable: true,
            value: true,
        });
        expect(JSON.parse(JSON.stringify(schema))).toEqual({ type: 'string', 'x-sensitive': true });
    });
});

describe('x-sensitive through toFormanSchema', () => {
    it('recovers a hand-written string schema marked x-sensitive as a password field', () => {
        expect(toFormanSchema(sensitive({ type: 'string' }))).toEqual({ type: 'password' });
    });

    it('leaves a string schema with format password a text field: only the marker means secret', () => {
        expect(toFormanSchema({ type: 'string', format: 'password' })).toEqual({ type: 'text' });
    });

    it('round-trips a password field', () => {
        const field = {
            name: 'pass',
            type: 'password',
            label: 'Password',
            help: 'Your password',
            default: 'x',
            multiline: true,
            validate: { min: 8, max: 64, pattern: '^\\S+$' },
        } as const;

        expect(toFormanSchema(toJSONSchema(field))).toEqual({
            type: 'password',
            label: 'Password',
            help: 'Your password',
            default: 'x',
            multiline: true,
            validate: { min: 8, max: 64, pattern: '^\\S+$' },
        });
    });

    it('round-trips a pkey field to password', () => {
        // `pkey` and `password` emit the same schema and nothing tells them apart, so `pkey` comes back
        // as `password`: still a secret, but no longer flagged as a private key.
        expect(toFormanSchema(toJSONSchema({ name: 'key', type: 'pkey', label: 'Key', multiline: true }))).toEqual({
            type: 'password',
            label: 'Key',
            multiline: true,
        });
    });

    it('recovers a password inside a collection', () => {
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                { name: 'user', type: 'text' },
                { name: 'pass', type: 'password', required: true },
            ],
        });

        expect(toFormanSchema(schema).spec).toEqual([
            { name: 'user', type: 'text', required: false },
            { name: 'pass', type: 'password', required: true },
        ]);
    });

    it('keeps the existing precedence: an option list makes a select, x-path a path field', () => {
        expect(toFormanSchema(sensitive({ type: 'string', enum: ['a', 'b'] }))).toEqual({
            type: 'select',
            options: [{ value: 'a' }, { value: 'b' }],
        });
        expect(toFormanSchema(sensitive({ type: 'string', oneOf: [{ const: 'a' }] }))).toEqual({
            type: 'select',
            options: [{ value: 'a' }],
        });

        const path = sensitive({ type: 'string' });
        Object.defineProperty(path, 'x-path', { enumerable: true, value: { type: 'folder' } });
        expect(toFormanSchema(path).type).toBe('folder');
    });

    it('keeps a secret a password when the schema also carries x-editor', () => {
        const schema = sensitive({ type: 'string' });
        Object.defineProperty(schema, 'x-editor', { enumerable: true, value: true });
        Object.defineProperty(schema, 'x-language', { enumerable: true, value: 'json' });

        expect(toFormanSchema(schema)).toEqual({ type: 'password' });
    });

    it('ignores x-sensitive set to anything but true', () => {
        const schema: JSONSchema7 = { type: 'string' };
        Object.defineProperty(schema, 'x-sensitive', { enumerable: true, value: 'yes' });

        expect(toFormanSchema(schema)).toEqual({ type: 'text' });
    });

    it.each(['email', 'uri', 'date-time', 'uuid'])('leaves a string with format %s a text field', format => {
        expect(toFormanSchema({ type: 'string', format })).toEqual({ type: 'text' });
    });
});
