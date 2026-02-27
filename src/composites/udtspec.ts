import type { JSONSchema7 } from 'json-schema';
import type { FormanSchemaField } from '../types';
import { noEmpty } from '../utils';

/**
 * Expands a udtspec composite field into its primitive array structure.
 * Mutates the field in place and returns it.
 */
export function udtspecExpand(field: FormanSchemaField): FormanSchemaField {
    field.type = 'array';
    field.spec = [
        {
            name: 'name',
            label: 'Name',
            placeholder: 'Enter name',
            type: 'text',
            required: true,
        } as FormanSchemaField,
        {
            name: 'label',
            label: 'Label',
            help: 'Display name for better readability.',
            type: 'text',
            advanced: true,
        },
        {
            name: 'help',
            label: 'Description',
            type: 'text',
            multiline: true,
            required: false,
            placeholder: 'Enter description',
        } as FormanSchemaField,
        {
            name: 'type',
            label: 'Type',
            type: 'udttype',
            required: true,
            default: 'text',
        },
    ];
    return field;
}

/**
 * Extracts the inner structural fragment from an expanded udtspec schema.
 * For udtspec (array-based), the inner fragment is the `items` object.
 */
export function udtspecExtractInner(schema: JSONSchema7): JSONSchema7 {
    return schema.items as JSONSchema7;
}

/**
 * Builds a per-usage wrapper that references the $defs inner fragment via $ref.
 */
export function udtspecWrapRef(ref: string, field: FormanSchemaField): JSONSchema7 {
    return {
        type: 'array',
        title: noEmpty(field.label),
        description: noEmpty(field.help),
        items: { $ref: ref },
    };
}

/**
 * Collapses a JSON Schema field with x-composite: 'udtspec' back to its composite form.
 */
export function udtspecCollapse(field: JSONSchema7): FormanSchemaField {
    return {
        type: 'udtspec',
        label: noEmpty(field.title),
        help: noEmpty(field.description),
    };
}
