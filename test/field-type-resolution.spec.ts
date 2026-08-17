import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import { resolveFormanFieldType, toJSONSchema, toJSONSchemaAdvanced } from '../src/index.js';

/** Converts a single field inside a wrapper collection and returns its rendered sub-schema. */
const convertField = (type: string): JSONSchema7 => {
    const schema = toJSONSchema({ name: 'w', type: 'collection', spec: [{ name: 'f', type }] });
    return schema.properties!['f'] as JSONSchema7;
};

describe('field type resolution', () => {
    describe('case-insensitive resolution', () => {
        // App schemas in the wild ship these; they are canonical types differing only in case.
        it.each([
            ['fileName', 'filename'],
            ['FileName', 'filename'],
            ['FILENAME', 'filename'],
            ['Boolean', 'boolean'],
            ['URL', 'url'],
            ['Select', 'select'],
            ['Collection', 'collection'],
            ['Text', 'text'],
            ['Number', 'number'],
        ])('resolves %s to the same schema as %s', (miscased, canonical) => {
            expect(resolveFormanFieldType(miscased)).toBe(canonical);
            expect(convertField(miscased)).toEqual(convertField(canonical));
        });
    });

    describe('aliases', () => {
        it.each([
            ['string', 'text'],
            ['bool', 'boolean'],
            ['datetime', 'date'],
            ['float', 'number'],
            ['upload', 'filestorage'],
        ])('aliases %s to %s', (alias, canonical) => {
            expect(resolveFormanFieldType(alias)).toBe(canonical);
            expect(convertField(alias)).toEqual(convertField(canonical));
        });
    });

    describe('deliberately NOT aliased', () => {
        // These require a guess about intent, so they degrade (and are reported) rather than being
        // silently mis-typed. A degraded field is honest; a wrongly-aliased one is a lie.
        // `tags` collides with the unrelated `tags` field property; `object` would round-trip back
        // as `dynamicCollection`; `uuis` is a typo we refuse to fuzzy-match.
        it.each(['tags', 'category', 'object', 'uuis'])('degrades %s instead of guessing', type => {
            expect(resolveFormanFieldType(type)).toBeUndefined();

            const result = toJSONSchemaAdvanced({ name: 'w', type: 'collection', spec: [{ name: 'f', type }] });
            expect(result.schema.properties!['f']).toEqual({});
            expect(result.skippedPaths).toEqual({ unconvertible: [`w.f (unknown type: ${type})`] });
        });
    });

    describe('kind-suffixed types', () => {
        it('resolves the base type and keeps the kind suffix usable', () => {
            expect(resolveFormanFieldType('account:google')).toBe('account');
            expect(resolveFormanFieldType('device:apn')).toBe('device');
        });

        it('resolves a miscased kind-suffixed type and still expands its store', () => {
            // Guards the ordering trap: `normalizeFormanFieldType` matches API_ENDPOINTS by lowercase
            // type, so canonicalization must happen before it or the `api://` store is silently lost.
            const field = convertField('Device:ios');

            expect(Object.getOwnPropertyDescriptor(field, 'x-fetch')?.value).toBe('api://devices/ios');
        });
    });

    describe('resolveFormanFieldType', () => {
        it('returns undefined for a missing type', () => {
            expect(resolveFormanFieldType(undefined)).toBeUndefined();
            expect(resolveFormanFieldType('')).toBeUndefined();
        });

        it('returns the canonical key unchanged for an already-canonical type', () => {
            expect(resolveFormanFieldType('text')).toBe('text');
            expect(resolveFormanFieldType('filestorage')).toBe('filestorage');
        });
    });

    describe('type map coverage guard', () => {
        // `device` was in the type union, in API_ENDPOINTS and in the converter's dispatch switch, but
        // missing from FORMAN_TYPE_MAP — so it always threw and its `case` was dead code. This asserts
        // every non-visual type in the public union actually converts.
        const UNION_TYPES = [
            'aiagent',
            'account',
            'hook',
            'device',
            'keychain',
            'datastore',
            'udt',
            'scenario',
            'array',
            'collection',
            'text',
            'number',
            'boolean',
            'checkbox',
            'date',
            'json',
            'buffer',
            'cert',
            'color',
            'email',
            'filename',
            'file',
            'filter',
            'filestorage',
            'folder',
            'hidden',
            'integer',
            'uinteger',
            'path',
            'pkey',
            'port',
            'list',
            'radio',
            'select',
            'time',
            'timestamp',
            'timezone',
            'url',
            'uuid',
        ];

        it.each(UNION_TYPES)('resolves %s from the public type union', type => {
            expect(resolveFormanFieldType(type)).toBe(type);
        });

        it.each(['account:google', 'hook:custom', 'keychain:aes', 'device:apn'])(
            'resolves the kind-suffixed union member %s',
            type => {
                expect(resolveFormanFieldType(type)).toBeDefined();
            },
        );
    });
});
