import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import type { FormanSchemaField } from '../src/index.js';
import { toFormanSchema, toJSONSchema } from '../src/index.js';

describe('editor and multiline markers', () => {
    it('stamps x-editor and x-language on an editor field', () => {
        const schema = toJSONSchema({ name: 'code', type: 'editor', language: 'javascript', label: 'Code' });

        expect(schema).toMatchObject({ type: 'string', title: 'Code' });
        expect(Object.getOwnPropertyDescriptor(schema, 'x-editor')?.value).toBe(true);
        expect(Object.getOwnPropertyDescriptor(schema, 'x-language')?.value).toBe('javascript');
    });

    it('stamps x-editor without x-language when the editor declares no language', () => {
        const schema = toJSONSchema({ name: 'code', type: 'editor' });

        expect(Object.getOwnPropertyDescriptor(schema, 'x-editor')?.value).toBe(true);
        expect(Object.getOwnPropertyDescriptor(schema, 'x-language')).toBeUndefined();
    });

    it('stamps x-multiline on a multiline text field and on nothing else', () => {
        const multiline = toJSONSchema({ name: 'body', type: 'text', multiline: true });
        const single = toJSONSchema({ name: 'subject', type: 'text' });

        expect(Object.getOwnPropertyDescriptor(multiline, 'x-multiline')?.value).toBe(true);
        expect(Object.getOwnPropertyDescriptor(single, 'x-multiline')).toBeUndefined();
        expect(Object.getOwnPropertyDescriptor(single, 'x-editor')).toBeUndefined();
    });

    it('serializes the markers, like every other x-* marker', () => {
        const schema = toJSONSchema({ name: 'code', type: 'editor', language: 'python', multiline: true });

        expect(JSON.parse(JSON.stringify(schema))).toEqual({
            type: 'string',
            'x-editor': true,
            'x-language': 'python',
            'x-multiline': true,
        });
    });

    it('round-trips through toFormanSchema', () => {
        const editor = toFormanSchema(toJSONSchema({ name: 'code', type: 'editor', language: 'javascript' }));
        const multiline = toFormanSchema(toJSONSchema({ name: 'body', type: 'text', multiline: true }));
        const plain = toFormanSchema(toJSONSchema({ name: 'subject', type: 'text' }));

        expect(editor).toMatchObject({ type: 'editor', language: 'javascript' });
        expect(multiline).toMatchObject({ type: 'text', multiline: true });
        expect(plain.type).toBe('text');
        expect(plain).not.toHaveProperty('multiline');
        expect(plain).not.toHaveProperty('language');
    });

    it('lands the markers on branch-nested fields, under the if/then the branch produces', () => {
        // The shape of Make's `code:ExecuteCode` module: the editor and the plain string variant sit two
        // branches deep, under `language` and then `inputFormat`.
        const inputFormat = (suffix: string): FormanSchemaField => ({
            name: 'inputFormat',
            type: 'select',
            required: true,
            options: {
                store: [
                    {
                        value: 'editor',
                        nested: [{ name: `codeEditor${suffix}`, type: 'editor', language: suffix.toLowerCase() }],
                    },
                    { value: 'string', nested: [{ name: `codeString${suffix}`, type: 'text', multiline: true }] },
                ],
            },
        });
        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                {
                    name: 'language',
                    type: 'select',
                    required: true,
                    options: {
                        store: [
                            { value: 'javascript', nested: [inputFormat('Javascript')] },
                            { value: 'python', nested: [inputFormat('Python')] },
                        ],
                    },
                },
            ],
        });

        const located = new Map<string, JSONSchema7>();
        (function walk(node: JSONSchema7) {
            for (const [name, property] of Object.entries(node.properties ?? {})) {
                if (typeof property === 'object') located.set(name, property);
            }
            for (const entry of node.allOf ?? []) {
                if (typeof entry === 'object' && typeof entry.then === 'object') walk(entry.then);
            }
        })(schema);

        expect(schema.properties).toEqual({ language: expect.anything() });
        expect(JSON.parse(JSON.stringify(located.get('codeEditorJavascript')))).toEqual({
            type: 'string',
            'x-editor': true,
            'x-language': 'javascript',
        });
        expect(JSON.parse(JSON.stringify(located.get('codeEditorPython')))).toEqual({
            type: 'string',
            'x-editor': true,
            'x-language': 'python',
        });
        expect(JSON.parse(JSON.stringify(located.get('codeStringJavascript')))).toEqual({
            type: 'string',
            'x-multiline': true,
        });
        expect(JSON.parse(JSON.stringify(located.get('codeStringPython')))).toEqual({
            type: 'string',
            'x-multiline': true,
        });
    });
});
