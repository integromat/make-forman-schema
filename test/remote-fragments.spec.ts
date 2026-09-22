import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import type { FormanSchemaField } from '../src/index.js';
import { toJSONSchema, toJSONSchemaAdvanced } from '../src/index.js';

describe('excludeRemoteFragments', () => {
    const banner = 'rpc://banner';

    describe('default behaviour', () => {
        it('renders a bare rpc string in a collection as an allOf $ref and reports nothing', () => {
            const result = toJSONSchemaAdvanced({
                name: 'w',
                type: 'collection',
                spec: [banner, { name: 'a', type: 'text' }] as FormanSchemaField[],
            });

            expect(result.schema.allOf).toEqual([{ $ref: banner }]);
            expect(result.skippedPaths).toBeUndefined();
        });
    });

    describe('with the option on', () => {
        const options = { excludeRemoteFragments: true };

        it('drops a bare rpc string from a collection and reports the list path with the reference', () => {
            const result = toJSONSchemaAdvanced(
                { name: 'w', type: 'collection', spec: [banner, { name: 'a', type: 'text' }] as FormanSchemaField[] },
                options,
            );

            expect(result.schema).toEqual({ type: 'object', properties: { a: { type: 'string' } }, required: [] });
            expect(result.schema.allOf).toBeUndefined();
            expect(result.skippedPaths).toEqual({ remoteFragments: [`w (${banner})`] });
        });

        it('reports the empty path for a fragment at the root of an anonymous collection', () => {
            const result = toJSONSchemaAdvanced(
                { type: 'collection', spec: [banner] as unknown as FormanSchemaField[] },
                options,
            );

            expect(result.skippedPaths).toEqual({ remoteFragments: [` (${banner})`] });
        });

        it('drops a fragment from a branch nested list, leaving a plain collection under then', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        {
                            name: 'mode',
                            type: 'select',
                            options: [{ value: 'a', label: 'A', nested: [banner, { name: 'onA', type: 'text' }] }],
                        },
                    ],
                },
                options,
            );

            const branch = result.schema.allOf![0] as JSONSchema7;
            expect(branch.then).toEqual({ type: 'object', properties: { onA: { type: 'string' } }, required: [] });
            expect(JSON.stringify(result.schema)).not.toContain(banner);
            expect(result.skippedPaths).toEqual({ remoteFragments: [`w.mode (${banner})`] });
        });

        it('drops a fragment from an unconditional nested list, leaving a plain collection under x-nested', () => {
            const result = toJSONSchemaAdvanced(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [
                        {
                            name: 'conn',
                            type: 'account:google',
                            options: { nested: [banner, { name: 'sub', type: 'text' }] },
                        },
                    ],
                },
                options,
            );

            const conn = result.schema.properties!['conn'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(conn, 'x-nested')?.value).toEqual({
                type: 'object',
                properties: { sub: { type: 'string' } },
                required: [],
            });
            expect(result.skippedPaths).toEqual({ remoteFragments: [`w.conn (${banner})`] });
        });

        it('drops a fragment relocated to another domain, at the receiving root', () => {
            const result = toJSONSchemaAdvanced(
                {
                    type: 'collection',
                    spec: [
                        {
                            name: 'parameters',
                            type: 'collection',
                            spec: [
                                {
                                    name: 'conn',
                                    type: 'account:slack',
                                    options: {
                                        nested: { domain: 'expect', store: [banner, { name: 'text', type: 'text' }] },
                                    },
                                },
                            ],
                        },
                        { name: 'mapper', type: 'collection', 'x-domain-root': 'expect', spec: [] },
                    ],
                },
                options,
            );

            const mapper = result.schema.properties!['mapper'] as JSONSchema7;
            expect(mapper.properties).toEqual({ text: { type: 'string' } });
            expect(mapper.allOf).toBeUndefined();
            expect(result.skippedPaths).toEqual({ remoteFragments: [`mapper (${banner})`] });
        });

        it('keeps a whole-list remote as the x-nested $ref marker', () => {
            const schema = toJSONSchema(
                { name: 'w', type: 'collection', spec: [{ name: 'wsdl', type: 'text', nested: 'rpc://soapForm' }] },
                options,
            );

            const wsdl = schema.properties!['wsdl'] as JSONSchema7;
            expect(Object.getOwnPropertyDescriptor(wsdl, 'x-nested')?.value).toEqual({
                $ref: 'rpc://soapForm?wsdl={{wsdl}}',
            });
        });

        it('keeps a whole-branch remote as the then $ref', () => {
            const schema = toJSONSchema(
                {
                    name: 'w',
                    type: 'collection',
                    spec: [{ name: 'mode', type: 'select', options: [{ value: 'a', nested: 'rpc://aForm' }] }],
                },
                options,
            );

            expect((schema.allOf![0] as JSONSchema7).then).toEqual({ $ref: 'rpc://aForm?mode={{mode}}' });
        });

        it('reports alongside the other skip reasons', () => {
            const spec: FormanSchemaField[] = [
                banner,
                { name: 'odd', type: 'somethingNew' },
                { name: 'adv', type: 'text', advanced: true },
            ] as FormanSchemaField[];
            const result = toJSONSchemaAdvanced(
                { name: 'w', type: 'collection', spec },
                { ...options, excludeAdvancedFields: true },
            );

            expect(result.skippedPaths).toEqual({
                advanced: ['w.adv'],
                unconvertible: ['w.odd (unknown type: somethingNew)'],
                remoteFragments: [`w (${banner})`],
            });
        });
    });
});
