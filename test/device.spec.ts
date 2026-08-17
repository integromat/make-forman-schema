import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import { toFormanSchema, toJSONSchema } from '../src/index.js';

/** Reads a non-enumerable `x-` marker off a rendered schema. */
const marker = (schema: JSONSchema7, key: string): unknown => Object.getOwnPropertyDescriptor(schema, key)?.value;

describe('device type', () => {
    it('converts a bare device field to a number-backed picker', () => {
        const schema = toJSONSchema({ name: 'd', type: 'device' });

        expect(schema.type).toBe('number');
        expect(marker(schema, 'x-fetch')).toBe('api://devices');
    });

    it.each(['apn', 'fcm', 'new_sms', 'new_reminder', 'save_contact', 'new_calendar_event'])(
        'expands the device:%s kind into its store path',
        kind => {
            const schema = toJSONSchema({ name: 'd', type: `device:${kind}` });

            expect(schema.type).toBe('number');
            expect(marker(schema, 'x-fetch')).toBe(`api://devices/${kind}`);
        },
    );

    it('leaves an explicitly provided store untouched rather than substituting the device endpoint', () => {
        // `normalizeFormanFieldType` early-returns when a store is already set, so the device endpoint
        // is not injected. Rendering of an object-form store is pre-existing behaviour shared with the
        // other reference types (`account:google` behaves identically) and is not device-specific.
        const explicit = toJSONSchema({
            name: 'd',
            type: 'device:apn',
            options: { store: 'api://custom/devices' },
        });

        expect(marker(explicit, 'x-fetch')).not.toBe('api://devices/apn');
    });

    it('omits x-fetch-options.type for reference types', () => {
        const schema = toJSONSchema({ name: 'd', type: 'device:apn' });

        expect(marker(schema, 'x-fetch-options')).toBeUndefined();
    });

    it('converts inside a collection alongside other fields', () => {
        const schema = toJSONSchema({
            name: 'w',
            type: 'collection',
            spec: [
                { name: 'msg', type: 'text' },
                { name: 'd', type: 'device:apn' },
            ],
        });

        expect(schema.properties).toHaveProperty('msg');
        expect((schema.properties!['d'] as JSONSchema7).type).toBe('number');
    });

    it('round-trips back to a device field', () => {
        const schema = toJSONSchema({ name: 'w', type: 'collection', spec: [{ name: 'd', type: 'device' }] });
        const back = toFormanSchema(schema) as { spec: { name: string; type: string }[] };

        expect(back.spec[0]!.name).toBe('d');
    });
});
