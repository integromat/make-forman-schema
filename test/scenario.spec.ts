import { describe, expect, it } from '@jest/globals';
import { toJSONSchema, toFormanSchema, validateForman } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('scenario type', () => {
    it('should convert to string type with x-fetch pointing to api://scenario-list', () => {
        const result = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'scenarioId',
                    type: 'scenario',
                    label: 'Select scenario',
                    help: 'Pick a scenario to run.',
                    required: true,
                },
            ],
        });

        const prop = (result.properties as Record<string, JSONSchema7>).scenarioId!;
        expect(prop.type).toBe('string');
        expect(prop.title).toBe('Select scenario');

        const xFetch = Object.getOwnPropertyDescriptor(prop, 'x-fetch');
        expect(xFetch?.value).toBe('api://scenario-list');
    });

    it('should convert static options to oneOf (with labels) or enum (without)', () => {
        const withLabels = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 's',
                    type: 'scenario',
                    options: [
                        { value: 'SCN_1', label: 'Scenario 1' },
                        { value: 'SCN_2', label: 'Scenario 2' },
                    ],
                },
            ],
        });
        const propLabels = (withLabels.properties as Record<string, JSONSchema7>).s!;
        // Non-required → empty option prepended
        expect(propLabels.oneOf).toEqual([
            { title: 'Empty', const: '' },
            { title: 'Scenario 1', const: 'SCN_1' },
            { title: 'Scenario 2', const: 'SCN_2' },
        ]);

        const withoutLabels = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 's',
                    type: 'scenario',
                    required: true,
                    options: [{ value: 'SCN_1' }, { value: 'SCN_2' }],
                },
            ],
        });
        const propEnum = (withoutLabels.properties as Record<string, JSONSchema7>).s!;
        // Required → no empty option
        expect(propEnum.enum).toEqual(['SCN_1', 'SCN_2']);
    });

    it('should round-trip through toFormanSchema as select', () => {
        const jsonSchema = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'scenarioId',
                    type: 'scenario',
                    label: 'My Scenario',
                    required: true,
                    options: [{ value: 'SCN_34174', label: 'Scenario A' }],
                },
            ],
        });

        const forman = toFormanSchema((jsonSchema.properties as Record<string, JSONSchema7>).scenarioId!);
        // Reference type info is lost in JSON Schema — comes back as select
        expect(forman.type).toBe('select');
        expect(forman.label).toBe('My Scenario');
    });

    it('should validate valid string value with static options', async () => {
        const result = await validateForman({ scenarioId: 'SCN_34174' }, [
            {
                name: 'scenarioId',
                type: 'scenario',
                options: [
                    { value: 'SCN_34174', label: 'Scenario A' },
                    { value: 'SCN_99881', label: 'Scenario B' },
                ],
            },
        ]);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('should reject non-string value', async () => {
        const result = await validateForman({ scenarioId: 12345 }, [
            { name: 'scenarioId', type: 'scenario', options: [{ value: 'SCN_1', label: 'A' }] },
        ]);
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toBe("Expected type 'string', got type 'number'.");
    });

    it('should enforce required', async () => {
        const result = await validateForman({}, [
            { name: 'scenarioId', type: 'scenario', required: true, options: [{ value: 'SCN_1', label: 'A' }] },
        ]);
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toBe('Field is mandatory.');
    });

    it('should reject value not in options', async () => {
        const result = await validateForman({ scenarioId: 'SCN_00000' }, [
            {
                name: 'scenarioId',
                type: 'scenario',
                options: [{ value: 'SCN_34174', label: 'Scenario A' }],
            },
        ]);
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toBe("Value 'SCN_00000' not found in options.");
    });

    it('should validate via resolveRemote', async () => {
        const resolveRemote = async () => [
            { value: 'SCN_34174', label: 'Scenario A' },
            { value: 'SCN_99881', label: 'Scenario B' },
        ];

        const valid = await validateForman({ scenarioId: 'SCN_34174' }, [{ name: 'scenarioId', type: 'scenario' }], {
            resolveRemote,
        });
        expect(valid.valid).toBe(true);

        const invalid = await validateForman({ scenarioId: 'SCN_00000' }, [{ name: 'scenarioId', type: 'scenario' }], {
            resolveRemote,
        });
        expect(invalid.valid).toBe(false);
        expect(invalid.errors[0]!.message).toBe("Value 'SCN_00000' not found in options.");
    });

    it('should handle production config with rpc://, grouped options, and custom value/label keys', async () => {
        const prodSchema: FormanSchemaField[] = [
            {
                name: 'scenario',
                type: 'scenario',
                label: 'Scenario',
                help: 'Scenario within your team to run.',
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
            {
                label: 'Inactive scenarios',
                options: [{ value: 'SCN_11111', label: 'Old Scenario' }],
            },
        ];

        // Valid grouped value
        const valid = await validateForman({ scenario: 'SCN_34174' }, prodSchema, { resolveRemote });
        expect(valid.valid).toBe(true);

        // Invalid grouped value
        const invalid = await validateForman({ scenario: 'SCN_00000' }, prodSchema, { resolveRemote });
        expect(invalid.valid).toBe(false);
        expect(invalid.errors[0]!.message).toBe("Value 'SCN_00000' not found in options.");

        // Conversion carries rpc:// URL and custom keys
        const jsonSchema = toJSONSchema({ type: 'collection', spec: prodSchema });
        const prop = (jsonSchema.properties as Record<string, JSONSchema7>).scenario!;
        expect(prop.type).toBe('string');

        const xFetch = Object.getOwnPropertyDescriptor(prop, 'x-fetch');
        expect(xFetch?.value).toBe(
            'rpc://scenario-service/2.15.6/GetScenarios?teamId={{teamId}}&scenarioId={{scenarioId}}&type=all',
        );

        const xFetchOptions = Object.getOwnPropertyDescriptor(prop, 'x-fetch-options');
        expect(xFetchOptions?.value).toEqual({ value: 'value', label: 'label' });
    });
});
