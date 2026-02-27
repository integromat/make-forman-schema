import type { JSONSchema7 } from 'json-schema';
import { noEmpty, isObject } from './utils';
import type { FormanSchemaField, FormanSchemaFieldType, FormanSchemaValue } from './types';
import { udttypeCollapse } from './composites/udttype';
import { udtspecCollapse } from './composites/udtspec';

/**
 * Maps JSON Schema primitive types to Forman Schema types.
 */
const JSON_PRIMITIVE_TYPE_MAP: Readonly<Record<string, FormanSchemaFieldType>> = {
    string: 'text',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
} as const;

type XSearchDirective = {
    url: string;
    label?: string;
    inputSchema: JSONSchema7;
};

/**
 * Converts a JSON Schema field to its Forman Schema equivalent.
 * @param field The JSON Schema field to convert
 * @returns The equivalent Forman Schema field
 */
export function toFormanSchema(field: JSONSchema7): FormanSchemaField {
    const compositeType = Object.getOwnPropertyDescriptor(field, 'x-composite')?.value;
    if (compositeType === 'udttype') return udttypeCollapse(field);
    if (compositeType === 'udtspec') return udtspecCollapse(field);

    switch (field.type) {
        case 'object':
            // When there are no defined properties in the spec, assume the collection is dynamic.
            if (!field.properties || !Object.entries(field.properties).length) {
                return {
                    type: 'dynamicCollection',
                    label: noEmpty(field.title),
                    help: noEmpty(field.description),
                };
            }

            // For objects, create a collection type with spec from properties
            const spec: FormanSchemaField[] = Object.entries(field.properties)
                .filter(([name, property]) => !!property)
                .map(([name, property]) => {
                    // Convert each property to a Forman Schema field
                    const subField = toFormanSchema(property as JSONSchema7);
                    subField.name = name;
                    subField.required = field.required?.includes(name) || false;
                    return subField;
                });

            return {
                type: 'collection',
                label: noEmpty(field.title),
                help: noEmpty(field.description),
                spec,
            };
        case 'array':
            // If the array is flagged as filter field root, then short-circuit to it
            const filterLogic = Object.getOwnPropertyDescriptor(field, 'x-filter');
            if (filterLogic) {
                return {
                    type: 'filter',
                    label: noEmpty(field.title),
                    help: noEmpty(field.description),
                    logic: filterLogic.value === 'default' ? undefined : filterLogic.value,
                };
            }

            // For arrays, create an array type with spec from items
            const items = field.items && isObject<JSONSchema7>(field.items) ? field.items : undefined;

            const formanSchema: FormanSchemaField = {
                type: 'array',
                label: noEmpty(field.title),
                help: noEmpty(field.description),
                spec: items
                    ? items.type === 'object' && items.properties
                        ? Object.entries(items.properties).map(([name, property]) => {
                              // If items is an object, convert its properties to Forman Schema fields
                              const subField = toFormanSchema(property as JSONSchema7);
                              subField.name = name;
                              subField.required = items.required?.includes(name) || false;
                              return subField;
                          })
                        : toFormanSchema(items)
                    : undefined,
            };

            // Add validation if present
            if (field.minItems !== undefined || field.maxItems !== undefined) {
                formanSchema.validate = formanSchema.validate || {};
                if (field.minItems !== undefined) formanSchema.validate.minItems = field.minItems;
                if (field.maxItems !== undefined) formanSchema.validate.maxItems = field.maxItems;
            }

            return formanSchema;
        case 'string':
            // If the field is flagged as path selector field root, then short-circuit to it
            const pathInfo = Object.getOwnPropertyDescriptor(field, 'x-path');
            if (pathInfo) {
                return {
                    type: pathInfo.value.type,
                    label: noEmpty(field.title),
                    help: noEmpty(field.description),
                    options: {
                        store: Object.getOwnPropertyDescriptor(field, 'x-fetch')?.value,
                        showRoot: pathInfo.value.showRoot,
                        singleLevel: pathInfo.value.singleLevel,
                    },
                };
            }
            if (field.enum) {
                // For strings with enum, create a select type
                return {
                    type: 'select',
                    label: noEmpty(field.title),
                    help: noEmpty(field.description),
                    options: field.enum.map(value => ({ value: value as FormanSchemaValue })),
                };
            } else if (field.oneOf) {
                // For strings with enum, create a select type
                return {
                    type: 'select',
                    label: noEmpty(field.title),
                    help: noEmpty(field.description),
                    options: field.oneOf
                        .filter(value => value)
                        .map(value => ({ value: (value as JSONSchema7).const as FormanSchemaValue })),
                };
            }

            // For regular strings, create a text type
            let textField: FormanSchemaField = {
                type: 'text',
                label: noEmpty(field.title),
                help: noEmpty(field.description),
                default: field.default as FormanSchemaValue,
            };

            // Add validation if present
            if (field.pattern || field.enum) {
                textField.validate = textField.validate || {};
                if (field.pattern) textField.validate.pattern = field.pattern;
                if (field.enum) textField.validate.enum = field.enum;
            }

            if ('x-search' in field) {
                textField = handleSearchDirective(textField, field['x-search'] as XSearchDirective);
            }
            return textField;
        default:
            // For primitive types, use the type mapping
            let primitiveField: FormanSchemaField = {
                type: (JSON_PRIMITIVE_TYPE_MAP[field.type as keyof typeof JSON_PRIMITIVE_TYPE_MAP] ||
                    'any') as FormanSchemaFieldType,
                label: noEmpty(field.title),
                help: noEmpty(field.description),
                default: field.default as FormanSchemaValue,
            };

            // Add validation if present
            if (field.minimum !== undefined || field.maximum !== undefined) {
                primitiveField.validate = primitiveField.validate || {};
                if (field.minimum !== undefined) primitiveField.validate.min = field.minimum;
                if (field.maximum !== undefined) primitiveField.validate.max = field.maximum;
            }

            if ('x-search' in field) {
                primitiveField = handleSearchDirective(primitiveField, field['x-search'] as XSearchDirective);
            }
            return primitiveField;
    }
}

function handleSearchDirective(formanField: FormanSchemaField, directive: XSearchDirective): FormanSchemaField {
    formanField.rpc = {
        url: directive.url,
        label: directive.label,
        parameters:
            typeof directive.inputSchema.$ref === 'string'
                ? directive.inputSchema.$ref
                : (toFormanSchema(directive.inputSchema).spec as FormanSchemaField[]),
    };
    return formanField;
}
