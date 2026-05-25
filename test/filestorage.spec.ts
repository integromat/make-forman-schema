import { describe, expect, it } from '@jest/globals';
import { toJSONSchema, toFormanSchema, validateForman } from '../src/index.js';
import type { FormanSchemaField } from '../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('filestorage type', () => {
    it('should convert to array with string items and x-filestorage marker', () => {
        const result = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'filestorage',
                    type: 'filestorage',
                    label: 'Knowledge files',
                    help: 'Select files for the agent.',
                },
            ],
        });

        const prop = (result.properties as Record<string, JSONSchema7>).filestorage!;
        expect(prop.type).toBe('array');
        expect(prop.items).toEqual({ type: 'string' });
        expect(prop.title).toBe('Knowledge files');

        // Non-enumerable marker for round-trip, invisible in JSON output
        const desc = Object.getOwnPropertyDescriptor(prop, 'x-filestorage');
        expect(desc?.value).toBe(true);
        expect(desc?.enumerable).toBe(false);
        expect(JSON.stringify(prop)).not.toContain('x-filestorage');
    });

    it('should round-trip through toFormanSchema', () => {
        const jsonSchema = toJSONSchema({
            type: 'collection',
            spec: [{ name: 'fs', type: 'filestorage', label: 'Files', help: 'Help text' }],
        });

        const forman = toFormanSchema((jsonSchema.properties as Record<string, JSONSchema7>).fs!);
        expect(forman.type).toBe('filestorage');
        expect(forman.label).toBe('Files');
        expect(forman.help).toBe('Help text');
    });

    it('should validate a valid array of UUIDs', async () => {
        const result = await validateForman(
            { files: ['ea042799-cf77-4a3b-95da-7fbe49ba9e87', '17b5128f-e380-4bac-bca3-538407d94187'] },
            [{ name: 'files', type: 'filestorage' }],
        );
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('should reject non-array values', async () => {
        const result = await validateForman({ files: 'not-an-array' }, [{ name: 'files', type: 'filestorage' }]);
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toBe("Expected type 'array', got type 'string'.");
    });

    it('should enforce required', async () => {
        const result = await validateForman({}, [{ name: 'files', type: 'filestorage', required: true }]);
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toBe('Field is mandatory.');
    });

    it('should handle real production config with upload UI metadata', async () => {
        const schema: FormanSchemaField[] = [
            {
                name: 'filestorage',
                type: 'filestorage',
                label: 'Knowledge files',
                help: 'Your agent will use these files as reference.',
                upload: {
                    label: 'Upload knowledge files',
                    description: 'Only text is extracted from the file.',
                    buttonLabel: 'Upload files',
                    submitLabel: 'Save',
                    accept: 'text/plain,.txt,application/pdf,.pdf,text/csv,.csv',
                    maxFileSizeMB: 10,
                    multiple: true,
                },
            } as FormanSchemaField,
        ];

        // upload metadata is ignored — validation still works
        const result = await validateForman({ filestorage: ['ea042799-cf77-4a3b-95da-7fbe49ba9e87'] }, schema);
        expect(result.valid).toBe(true);

        // conversion also ignores upload metadata
        const jsonSchema = toJSONSchema({ type: 'collection', spec: schema });
        const prop = (jsonSchema.properties as Record<string, JSONSchema7>).filestorage!;
        expect(prop.type).toBe('array');
        expect(prop.items).toEqual({ type: 'string' });
    });
});
