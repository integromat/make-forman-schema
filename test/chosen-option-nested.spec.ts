import { describe, expect, it } from '@jest/globals';
import { validateForman } from '../src/index.js';

/**
 * The chosen option of a select-like field can carry the specification of its dependent
 * fields in `option.nested`. The UI persists that spec in `metadata.restore` (as the
 * `nested` member of the field's state) to render the dependent fields section. The
 * generated field states must carry it, otherwise a restore rebuilt from states wipes
 * the dependent fields from the form.
 */
describe('Chosen option nested spec in field states', () => {
    const argumentsSpec = [
        {
            name: 'arguments',
            type: 'collection',
            label: 'Arguments',
            spec: [
                { name: 'url', type: 'text', label: 'URL' },
                { name: 'method', type: 'text', label: 'Method' },
            ],
        },
    ];

    it('should emit the chosen RPC option nested spec on the field state', async () => {
        const result = await validateForman(
            { toolName: 'fetch-tool', arguments: { url: 'https://example.com', method: 'GET' } },
            [{ name: 'toolName', type: 'select', options: 'rpc://listTools' }],
            {
                states: true,
                resolveRemote() {
                    return Promise.resolve([
                        { value: 'fetch-tool', label: 'Fetch Tool', nested: argumentsSpec },
                        { value: 'other-tool', label: 'Other Tool' },
                    ]);
                },
            },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    toolName: { mode: 'chose', label: 'Fetch Tool', nested: argumentsSpec },
                },
            },
        });
    });

    it('should emit the chosen static option nested spec on the field state', async () => {
        const result = await validateForman(
            { toolName: 'fetch-tool', arguments: { url: 'https://example.com' } },
            [
                {
                    name: 'toolName',
                    type: 'select',
                    options: [
                        { value: 'fetch-tool', label: 'Fetch Tool', nested: argumentsSpec },
                        { value: 'other-tool', label: 'Other Tool' },
                    ],
                },
            ],
            { states: true },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    toolName: { mode: 'chose', label: 'Fetch Tool', nested: argumentsSpec },
                },
            },
        });
    });

    it('should not emit a nested member when the chosen option has none', async () => {
        const result = await validateForman(
            { toolName: 'other-tool' },
            [
                {
                    name: 'toolName',
                    type: 'select',
                    options: [
                        { value: 'fetch-tool', label: 'Fetch Tool', nested: argumentsSpec },
                        { value: 'other-tool', label: 'Other Tool' },
                    ],
                },
            ],
            { states: true },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    toolName: { mode: 'chose', label: 'Other Tool' },
                },
            },
        });
    });

    it('should emit the placeholder nested spec on the field state for empty values', async () => {
        const placeholderNested = [{ name: 'defaultField', type: 'text', label: 'Default Field' }];
        const result = await validateForman(
            { aggregator: '' },
            [
                {
                    name: 'aggregator',
                    type: 'select',
                    options: {
                        store: [
                            { value: 'sum', label: 'Sum' },
                            { value: 'avg', label: 'Average' },
                        ],
                        placeholder: {
                            label: 'Select an aggregator...',
                            nested: placeholderNested,
                        },
                    },
                },
            ],
            { states: true },
        );

        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    aggregator: { mode: 'chose', label: 'Select an aggregator...', nested: placeholderNested },
                },
            },
        });
    });

    it('should keep the spec array intact when a dependent field emits its own state', async () => {
        const nestedWithSelect = [
            {
                name: 'mode',
                type: 'select',
                label: 'Mode',
                options: [
                    { value: 'fast', label: 'Fast' },
                    { value: 'slow', label: 'Slow' },
                ],
            },
        ];
        const result = await validateForman(
            { toolName: 'fetch-tool', mode: 'fast' },
            [{ name: 'toolName', type: 'select', options: 'rpc://listTools' }],
            {
                states: true,
                resolveRemote() {
                    return Promise.resolve([{ value: 'fetch-tool', label: 'Fetch Tool', nested: nestedWithSelect }]);
                },
            },
        );

        // Dependent field states are siblings of the select state; the spec array on the
        // select's state must survive buildRestoreStructure untouched.
        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    toolName: { mode: 'chose', label: 'Fetch Tool', nested: nestedWithSelect },
                    mode: { mode: 'chose', label: 'Fast' },
                },
            },
        });
    });
});
