import type { JSONSchema7 } from 'json-schema';
import type { FormanSchemaField } from '../types';
import { noEmpty } from '../utils';

/**
 * Expands a udttype composite field into its primitive select structure.
 * Mutates the field in place and returns it.
 */
export function udttypeExpand(field: FormanSchemaField): FormanSchemaField {
    field.type = 'select';
    field.options = {
        store: [
            {
                label: 'Array',
                value: 'array',
                nested: [
                    {
                        name: 'spec',
                        type: 'collection',
                        label: 'Array Item Specification',
                        spec: [
                            {
                                name: 'type',
                                label: 'Type',
                                type: 'udttype',
                                required: true,
                                default: 'text',
                            },
                        ],
                        mappable: false,
                    },
                    {
                        name: 'required',
                        label: 'Required',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                ],
            },
            {
                label: 'Collection',
                value: 'collection',
                nested: [
                    {
                        name: 'spec',
                        label: 'Specification',
                        type: 'udtspec',
                    },
                    {
                        name: 'sequence',
                        label: 'Preserve the order of object keys',
                        type: 'boolean',
                        mappable: false,
                    },
                    {
                        name: 'required',
                        label: 'Required',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                ],
            },
            {
                label: 'Date',
                value: 'date',
                nested: [
                    {
                        name: 'required',
                        label: 'Required',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                ],
            },
            {
                label: 'Text',
                value: 'text',
                nested: [
                    {
                        name: 'default',
                        label: 'Default value',
                        placeholder: 'Enter default value',
                        type: 'text',
                    } as FormanSchemaField,
                    {
                        name: 'required',
                        label: 'Required',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                    {
                        name: 'multiline',
                        label: 'Multi-line',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                ],
            },
            {
                label: 'Number',
                value: 'number',
                nested: [
                    {
                        name: 'default',
                        label: 'Default value',
                        placeholder: 'Enter default value',
                        type: 'number',
                    } as FormanSchemaField,
                    {
                        name: 'required',
                        label: 'Required',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                ],
            },
            {
                label: 'Boolean',
                value: 'boolean',
                nested: [
                    {
                        name: 'default',
                        label: 'Default value',
                        placeholder: 'Enter default value',
                        type: 'boolean',
                        mappable: false,
                    } as FormanSchemaField,
                    {
                        name: 'required',
                        label: 'Required',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                ],
            },
            {
                label: 'Binary Data',
                value: 'buffer',
                nested: [
                    {
                        name: 'required',
                        label: 'Required',
                        type: 'boolean',
                        required: true,
                        default: false,
                        mappable: false,
                    },
                    {
                        name: 'codepage',
                        label: 'Codepage',
                        type: 'text',
                        help: "Possible values: `binary`, `utf8`. Leave empty if you're not sure.",
                    },
                ],
            },
        ],
    };
    return field;
}

/**
 * Extracts the inner structural fragment from an expanded udttype schema.
 * For udttype (string/select-based), the inner fragment is the schema minus title/description.
 */
export function udttypeExtractInner(schema: JSONSchema7): JSONSchema7 {
    const { title, description, ...inner } = schema;
    return inner;
}

/**
 * Builds a per-usage allOf wrapper that references the $defs inner fragment via $ref.
 * Uses allOf for draft-07 compliance (siblings of $ref are ignored in draft-07).
 */
export function udttypeWrapRef(ref: string, field: FormanSchemaField): JSONSchema7 {
    return {
        allOf: [{ $ref: ref }],
        title: noEmpty(field.label),
        description: noEmpty(field.help),
        ...(field.default !== '' && field.default != null ? { default: field.default } : {}),
    };
}

/**
 * Collapses a JSON Schema field with x-composite: 'udttype' back to its composite form.
 */
export function udttypeCollapse(field: JSONSchema7): FormanSchemaField {
    return {
        type: 'udttype',
        label: noEmpty(field.title),
        help: noEmpty(field.description),
        ...(field.default !== '' && field.default != null ? { default: field.default as FormanSchemaField['default'] } : {}),
    };
}
