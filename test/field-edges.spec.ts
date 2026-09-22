import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import type { JSONSchema7 } from 'json-schema';
import type { FormanSchemaField } from '../src/index.js';
import { activeFieldEdges, fieldEdges, toJSONSchema, validateFormanWithDomains } from '../src/index.js';

const child = (name: string): FormanSchemaField => ({ name, type: 'text' });

describe('fieldEdges', () => {
    describe('conditional edges', () => {
        it('yields one gated edge per option carrying its own nested, in a plain options array', () => {
            const field: FormanSchemaField = {
                name: 'mode',
                type: 'select',
                options: [
                    { value: 'a', nested: [child('onA')] },
                    { value: 'b' },
                    { value: 'c', nested: [child('onC')] },
                ],
            };

            expect(fieldEdges(field)).toEqual([
                { gate: { name: 'mode', value: 'a' }, children: [child('onA')] },
                { gate: { name: 'mode', value: 'c' }, children: [child('onC')] },
            ]);
        });

        it('reads the extended store, unwrapping option groups', () => {
            const field: FormanSchemaField = {
                name: 'mode',
                type: 'select',
                options: {
                    store: [
                        { label: 'Group', options: [{ value: 'g1', nested: [child('onG1')] }] },
                        { value: 'top', nested: [child('onTop')] },
                    ],
                },
            };

            expect(fieldEdges(field)).toEqual([
                { gate: { name: 'mode', value: 'g1' }, children: [child('onG1')] },
                { gate: { name: 'mode', value: 'top' }, children: [child('onTop')] },
            ]);
        });

        it('carries the domain of a per-option { store, domain } nested', () => {
            const field: FormanSchemaField = {
                name: 'mode',
                type: 'select',
                options: { store: [{ value: 'mappable', nested: { domain: 'expect', store: [child('template')] } }] },
            };

            expect(fieldEdges(field)).toEqual([
                { gate: { name: 'mode', value: 'mappable' }, domain: 'expect', children: [child('template')] },
            ]);
        });

        it('yields a remote edge for an option whose nested is an rpc reference', () => {
            const field: FormanSchemaField = {
                name: 'mode',
                type: 'select',
                options: [{ value: 'dynamic', nested: 'rpc://form' }],
            };

            expect(fieldEdges(field)).toEqual([{ gate: { name: 'mode', value: 'dynamic' }, remote: 'rpc://form' }]);
        });

        it('gates each option on the key named by options.value', () => {
            const field: FormanSchemaField = {
                name: 'mode',
                type: 'select',
                options: { store: [{ id: 'a', nested: [child('onA')] } as never], value: 'id' },
            };

            expect(fieldEdges(field)).toEqual([{ gate: { name: 'mode', value: 'a' }, children: [child('onA')] }]);
        });

        it('gates the placeholder nested on the empty selection of a non-required select only', () => {
            const placeholder = { label: 'None', nested: [child('whenEmpty')] };

            expect(
                fieldEdges({ name: 'mode', type: 'select', options: { store: [{ value: 'x' }], placeholder } }),
            ).toEqual([{ gate: { name: 'mode', value: '' }, children: [child('whenEmpty')] }]);
            expect(
                fieldEdges({
                    name: 'mode',
                    type: 'select',
                    required: true,
                    options: { store: [{ value: 'x' }], placeholder },
                }),
            ).toEqual([]);
            expect(fieldEdges({ name: 'mode', type: 'text', options: { placeholder } })).toEqual([]);
        });

        it("gates a boolean field's own nested on true, or on false under reversedNested", () => {
            const nested = [child('whenOn')];

            expect(fieldEdges({ name: 'flag', type: 'boolean', nested })).toEqual([
                { gate: { name: 'flag', value: true }, children: nested },
            ]);
            expect(fieldEdges({ name: 'flag', type: 'boolean', reversedNested: true, nested })).toEqual([
                { gate: { name: 'flag', value: false }, children: nested },
            ]);
            expect(fieldEdges({ name: 'flag', type: 'checkbox', nested })).toEqual([
                { gate: { name: 'flag', value: true }, children: nested },
            ]);
        });

        it('resolves the boolean type through the shared alias and casing rules', () => {
            const nested = [child('whenOn')];

            for (const type of ['bool', 'Boolean', 'CHECKBOX'] as FormanSchemaField['type'][]) {
                expect(fieldEdges({ name: 'flag', type, nested })).toEqual([
                    { gate: { name: 'flag', value: true }, children: nested },
                ]);
            }
        });

        it('yields one edge per branch of the boolean { true, false } form', () => {
            const field: FormanSchemaField = {
                name: 'flag',
                type: 'boolean',
                nested: { true: [child('whenOn')], false: 'rpc://offForm' },
            };

            expect(fieldEdges(field)).toEqual([
                { gate: { name: 'flag', value: true }, children: [child('whenOn')] },
                { gate: { name: 'flag', value: false }, remote: 'rpc://offForm' },
            ]);
        });
    });

    describe('unconditional edges', () => {
        it('reads options.nested in the plain and { store, domain } forms', () => {
            expect(
                fieldEdges({ name: 'conn', type: 'account', options: { store: 'rpc://c', nested: [child('a')] } }),
            ).toEqual([{ children: [child('a')] }]);

            expect(
                fieldEdges({
                    name: 'conn',
                    type: 'account',
                    options: { nested: { domain: 'expect', store: [child('a')] } },
                }),
            ).toEqual([{ domain: 'expect', children: [child('a')] }]);
        });

        it('yields a remote edge for options.nested written as an rpc reference, plain or in a store', () => {
            expect(fieldEdges({ name: 'x', type: 'select', options: { nested: 'rpc://form' } })).toEqual([
                { remote: 'rpc://form' },
            ]);

            expect(
                fieldEdges({
                    name: 'type',
                    type: 'udt',
                    options: { nested: { store: 'rpc://udt', domain: 'expect' } },
                }),
            ).toEqual([{ remote: 'rpc://udt', domain: 'expect' }]);
        });

        it("reads a non-boolean field's own nested as unconditional", () => {
            expect(fieldEdges({ name: 'id', type: 'text', nested: [child('sub')] })).toEqual([
                { children: [child('sub')] },
            ]);
            expect(
                fieldEdges({ name: 'id', type: 'text', nested: { store: [child('sub')], domain: 'expect' } }),
            ).toEqual([{ domain: 'expect', children: [child('sub')] }]);
        });

        it('keeps bare rpc strings inside a child list verbatim', () => {
            expect(
                fieldEdges({ name: 'x', type: 'select', options: { nested: ['rpc://banner', child('a')] } }),
            ).toEqual([{ children: ['rpc://banner', child('a')] }]);
        });

        it("reads the field's own nested over options.nested when a field declares both, as the validator does", () => {
            const field: FormanSchemaField = {
                name: 'agent',
                type: 'aiagent',
                options: { store: 'rpc://agents', nested: { store: 'rpc://agentForm' } },
                nested: [child('contextId')],
            };

            expect(fieldEdges(field)).toEqual([{ children: [child('contextId')] }]);
        });
    });

    describe('edge cases', () => {
        it('returns nothing for a field without children, whatever its options encoding', () => {
            expect(fieldEdges({ name: 'a', type: 'text' })).toEqual([]);
            expect(fieldEdges({ name: 'a', type: 'select', options: [{ value: 1 }, { value: 2 }] })).toEqual([]);
            expect(fieldEdges({ name: 'a', type: 'select', options: 'rpc://options' })).toEqual([]);
            expect(fieldEdges({ name: 'a', type: 'select', options: { store: 'rpc://options' } })).toEqual([]);
        });

        it('emits option children unconditionally when the field has no name to gate on', () => {
            expect(fieldEdges({ type: 'select', options: [{ value: 'a', nested: [child('x')] }] })).toEqual([
                { children: [child('x')] },
            ]);
        });
    });
});

describe('activeFieldEdges', () => {
    const select: FormanSchemaField = {
        name: 'mode',
        type: 'select',
        options: {
            store: [{ value: 'a', nested: [child('onA')] }, { value: 'b' }],
            nested: [child('always')],
            placeholder: { label: 'None', nested: [child('whenEmpty')] },
        },
    };

    it('returns the matching gated edge in place of the unconditional ones', () => {
        expect(activeFieldEdges(select, 'a')).toEqual([
            { gate: { name: 'mode', value: 'a' }, children: [child('onA')] },
        ]);
    });

    it('falls back to the unconditional edges for an option without its own nested', () => {
        expect(activeFieldEdges(select, 'b')).toEqual([{ children: [child('always')] }]);
    });

    it('falls back to the unconditional edges for a value outside the static options', () => {
        expect(activeFieldEdges(select, '{{1.custom}}')).toEqual([{ children: [child('always')] }]);
    });

    it('treats undefined, null and the empty string as the placeholder selection', () => {
        for (const empty of [undefined, null, '']) {
            expect(activeFieldEdges(select, empty)).toEqual([
                { gate: { name: 'mode', value: '' }, children: [child('whenEmpty')] },
            ]);
        }
    });

    it('matches the option through the key named by options.value', () => {
        const field: FormanSchemaField = {
            name: 'mode',
            type: 'select',
            options: { store: [{ id: 'a', nested: [child('onA')] } as never, { id: 'b' } as never], value: 'id' },
        };

        expect(activeFieldEdges(field, 'a')).toEqual([
            { gate: { name: 'mode', value: 'a' }, children: [child('onA')] },
        ]);
        expect(activeFieldEdges(field, 'b')).toEqual([]);
    });

    it('reveals a boolean branch only for the matching value, nothing when unset', () => {
        const flag: FormanSchemaField = { name: 'flag', type: 'boolean', nested: [child('whenOn')] };

        expect(activeFieldEdges(flag, true)).toEqual([
            { gate: { name: 'flag', value: true }, children: [child('whenOn')] },
        ]);
        expect(activeFieldEdges(flag, false)).toEqual([]);
        expect(activeFieldEdges(flag, undefined)).toEqual([]);
    });

    it("reveals a boolean's single-branch nested for an IML value, and neither branch of the two-branch form", () => {
        const flag: FormanSchemaField = { name: 'flag', type: 'boolean', nested: [child('whenOn')] };
        const reversed: FormanSchemaField = { ...flag, reversedNested: true };
        const branched: FormanSchemaField = {
            name: 'flag',
            type: 'boolean',
            nested: { true: [child('whenOn')], false: [child('whenOff')] },
        };

        expect(activeFieldEdges(flag, '{{1.x}}')).toEqual([
            { gate: { name: 'flag', value: true }, children: [child('whenOn')] },
        ]);
        expect(activeFieldEdges(reversed, '{{1.x}}')).toEqual([
            { gate: { name: 'flag', value: false }, children: [child('whenOn')] },
        ]);
        expect(activeFieldEdges(branched, '{{1.x}}')).toEqual([]);
    });
});

describe('activeFieldEdges against the validator, per selection rule', () => {
    /** The names a renderer walking `activeFieldEdges` shows, in the validator's depth-first order. */
    function liveNames(fields: FormanSchemaField[], values: Record<string, unknown>, out: string[] = []) {
        for (const field of fields) {
            if (field.name) out.push(field.name);
            for (const edge of activeFieldEdges(field, values[field.name ?? ''])) {
                liveNames(
                    (edge.children ?? []).filter((c): c is FormanSchemaField => typeof c !== 'string'),
                    values,
                    out,
                );
            }
        }
        return out;
    }

    const select = (extra: Partial<FormanSchemaField>): FormanSchemaField => ({
        name: 'mode',
        type: 'select',
        options: {
            store: [{ value: 'a', nested: [child('onA')] }, { value: 'b' }],
            nested: [child('always')],
            placeholder: { label: 'None', nested: [child('whenEmpty')] },
        },
        ...extra,
    });
    const flag = (extra: Partial<FormanSchemaField>): FormanSchemaField => ({
        name: 'flag',
        type: 'boolean',
        nested: [child('whenOn')],
        ...extra,
    });

    const cases: [string, FormanSchemaField[], Record<string, unknown>][] = [
        ['an option with its own nested replaces the field-level nested', [select({})], { mode: 'a' }],
        ['an option without nested falls back to the field-level nested', [select({})], { mode: 'b' }],
        ['an IML value on a select falls back to the field-level nested', [select({})], { mode: '{{1.x}}' }],
        ['an empty non-required select reveals the placeholder nested', [select({})], {}],
        ['an empty required select reveals nothing', [select({ required: true })], {}],
        ['a placeholder on a non-select field reveals nothing', [{ ...select({}), type: 'text' }], {}],
        [
            "the field's own nested wins over options.nested",
            [
                select({
                    nested: [child('fromField')],
                    options: { store: [{ value: 'a' }], nested: [child('fromOptions')] },
                }),
            ],
            { mode: 'a' },
        ],
        [
            'options.value names the option key',
            [
                select({
                    options: {
                        store: [{ id: 'a', nested: [child('onA')] } as never, { id: 'b' } as never],
                        value: 'id',
                    },
                }),
            ],
            { mode: 'a' },
        ],
        ['a boolean set to true reveals its nested', [flag({})], { flag: true }],
        ['a boolean set to false hides its nested', [flag({})], { flag: false }],
        ['a reversed boolean set to false reveals its nested', [flag({ reversedNested: true })], { flag: false }],
        ['a boolean holding an IML value reveals its nested', [flag({})], { flag: '{{1.x}}' }],
        [
            'a two-branch boolean reveals the matching branch',
            [flag({ nested: { true: [child('on')], false: [child('off')] } })],
            { flag: false },
        ],
        [
            'a two-branch boolean holding an IML value reveals nothing',
            [flag({ nested: { true: [child('on')], false: [child('off')] } })],
            { flag: '{{1.x}}' },
        ],
        ['an unset boolean hides its nested', [flag({})], {}],
    ];

    it.each(cases)('%s', async (_, schema, values) => {
        const result = await validateFormanWithDomains(
            { default: { schema, values } },
            { schemas: true, allowDynamicValues: true },
        );

        expect(liveNames(schema, values)).toEqual(result.resolvedSchemas!['default']!.map(field => field.name));
    });
});

describe('fieldEdges against the converter and the validator', () => {
    const addRow = JSON.parse(readFileSync('./test/mocks/google-sheets-add-row.json').toString()) as {
        parameters: FormanSchemaField[];
        expect: FormanSchemaField[];
    };

    /** Every field name reachable through edges, by the domain the edges place it in. */
    function reachableNames(fields: FormanSchemaField[], domain: string, out = new Map<string, Set<string>>()) {
        for (const field of fields) {
            if (field.name) (out.get(domain) ?? out.set(domain, new Set()).get(domain)!).add(field.name);
            for (const edge of fieldEdges(field)) {
                const children = (edge.children ?? []).filter((c): c is FormanSchemaField => typeof c !== 'string');
                reachableNames(children, edge.domain ?? domain, out);
            }
        }
        return out;
    }

    /** Every property name the converter emitted under `schema`, at any depth of properties, allOf/then and x-nested. */
    function emittedNames(schema: JSONSchema7, out = new Set<string>()): Set<string> {
        for (const [name, property] of Object.entries(schema.properties ?? {})) {
            out.add(name);
            if (typeof property === 'object') {
                emittedNames(property, out);
                const nested = (property as Record<string, unknown>)['x-nested'];
                if (nested && typeof nested === 'object') emittedNames(nested as JSONSchema7, out);
            }
        }
        for (const entry of schema.allOf ?? []) {
            if (typeof entry === 'object' && typeof entry.then === 'object') emittedNames(entry.then, out);
        }
        return out;
    }

    it('reaches exactly the fields the converter emits, per domain, on the google-sheets addRow module', () => {
        const reachable = reachableNames(addRow.parameters, 'default');
        reachableNames(addRow.expect, 'expect', reachable);

        const schema = toJSONSchema({
            type: 'collection',
            spec: [
                { name: 'default', type: 'collection', spec: addRow.parameters },
                { name: 'expect', type: 'collection', 'x-domain-root': 'expect', spec: addRow.expect },
            ],
        });

        for (const domain of ['default', 'expect']) {
            const emitted = emittedNames((schema.properties![domain] as JSONSchema7) ?? {});
            expect([...emitted].sort()).toEqual([...(reachable.get(domain) ?? [])].sort());
        }
    });

    /** The live form for `values`, walking only the edges each value reveals — what a renderer shows. */
    function liveForm(
        fields: FormanSchemaField[],
        values: Record<string, unknown>,
        domain: string,
        out = new Map<string, string[]>(),
    ) {
        for (const field of fields) {
            if (field.name) (out.get(domain) ?? out.set(domain, []).get(domain)!).push(field.name);
            for (const edge of activeFieldEdges(field, values[field.name ?? ''] ?? field.default)) {
                const children = (edge.children ?? []).filter((c): c is FormanSchemaField => typeof c !== 'string');
                liveForm(children, values, edge.domain ?? domain, out);
            }
        }
        return out;
    }

    it('reveals, for chosen values, the same form the validator resolves', async () => {
        const values = { __IMTCONN__: 1, mode: 'select', from: 'drive', spreadsheetId: 'abc' };
        const result = await validateFormanWithDomains(
            {
                default: { values: { __IMTCONN__: values.__IMTCONN__ }, schema: addRow.parameters },
                expect: {
                    values: { mode: values.mode, from: values.from, spreadsheetId: values.spreadsheetId },
                    schema: addRow.expect,
                },
            },
            {
                schemas: true,
                allowDynamicValues: true,
                async resolveRemote(path) {
                    return path.startsWith('api://') ? [{ value: 1 }] : [];
                },
            },
        );

        const form = liveForm(addRow.parameters, values, 'default');
        liveForm(addRow.expect, values, 'expect', form);

        expect(form.get('default')).toEqual(result.resolvedSchemas!['default']!.map(field => field.name));
        expect(form.get('expect')).toEqual(result.resolvedSchemas!['expect']!.map(field => field.name));
    });
});
