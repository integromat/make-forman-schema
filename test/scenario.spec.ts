import { describe, expect, it } from '@jest/globals';
import { toJSONSchema, validateForman } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('scenario type', () => {
    it('should convert to string type with x-fetch pointing to api://scenario-list', () => {
        const result = toJSONSchema({
            type: 'collection',
            spec: [{ name: 'scenarioId', type: 'scenario', label: 'Select scenario', required: true }],
        });

        const prop = (result.properties as Record<string, JSONSchema7>).scenarioId!;
        expect(prop.type).toBe('string');
        expect(prop.title).toBe('Select scenario');
        expect(Object.getOwnPropertyDescriptor(prop, 'x-fetch')?.value).toBe('api://scenario-list');
    });

    it('should validate string value against static options', async () => {
        const schema: FormanSchemaField[] = [
            { name: 'scenarioId', type: 'scenario', options: [{ value: 'SCN_34174', label: 'Scenario A' }] },
        ];

        const valid = await validateForman({ scenarioId: 'SCN_34174' }, schema);
        expect(valid.valid).toBe(true);

        const wrongType = await validateForman({ scenarioId: 12345 }, schema);
        expect(wrongType.valid).toBe(false);
        expect(wrongType.errors[0]!.message).toBe("Expected type 'string', got type 'number'.");

        const notInOptions = await validateForman({ scenarioId: 'SCN_00000' }, schema);
        expect(notInOptions.valid).toBe(false);
        expect(notInOptions.errors[0]!.message).toBe("Value 'SCN_00000' not found in options.");
    });

    it('should handle production config with rpc://, grouped options, and custom value/label keys', async () => {
        const prodSchema: FormanSchemaField[] = [
            {
                name: 'scenario',
                type: 'scenario',
                label: 'Scenario',
                required: true,
                grouped: true,
                options: {
                    store: 'rpc://scenario-service/2.15.6/GetScenarios?teamId={{teamId}}&scenarioId={{scenarioId}}&type=all',
                    value: 'value',
                    label: 'label',
                },
            },
        ];

        const resolveRemote = async () => [
            {
                label: 'Active scenarios',
                options: [
                    { value: 'SCN_34174', label: 'My Scenario' },
                    { value: 'SCN_99881', label: 'Other Scenario' },
                ],
            },
        ];

        const valid = await validateForman({ scenario: 'SCN_34174' }, prodSchema, { resolveRemote });
        expect(valid.valid).toBe(true);

        const invalid = await validateForman({ scenario: 'SCN_00000' }, prodSchema, { resolveRemote });
        expect(invalid.valid).toBe(false);
        expect(invalid.errors[0]!.message).toBe("Value 'SCN_00000' not found in options.");

        // Conversion carries rpc:// URL and custom keys
        const jsonSchema = toJSONSchema({ type: 'collection', spec: prodSchema });
        const prop = (jsonSchema.properties as Record<string, JSONSchema7>).scenario!;
        expect(prop.type).toBe('string');
        expect(Object.getOwnPropertyDescriptor(prop, 'x-fetch')?.value).toBe(
            'rpc://scenario-service/2.15.6/GetScenarios?teamId={{teamId}}&scenarioId={{scenarioId}}&type=all',
        );
        expect(Object.getOwnPropertyDescriptor(prop, 'x-fetch-options')?.value).toEqual({
            value: 'value',
            label: 'label',
        });
    });
});
