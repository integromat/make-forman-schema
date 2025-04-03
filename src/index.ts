/**
 * Represents a field in Forman Schema format.
 */
export type FormanSchemaField = {
    /** Field name identifier */
    name?: string;
    /** The field type (e.g., 'text', 'number', 'boolean', 'collection', 'array', etc.) */
    type: string;
    /** Whether the field is required or not */
    required?: boolean;
    /** Default value for the field */
    default?: string | number | boolean | null;
    /** Available options for select type fields */
    options?: {
        /** Option value */
        value: string;
    }[];
    /** Help text or description for the field */
    help?: string;
    /** Sub-fields specification for collection or array types */
    spec?: FormanSchemaField[] | FormanSchemaField;
};

/**
 * Represents a field in JSON Schema format.
 */
export type JSONSchemaField = {
    /** The JSON Schema type (e.g., 'string', 'number', 'boolean', 'object', 'array', etc.) */
    type: string;
    /** Field description */
    description?: string;
    /** Default value for the field */
    default?: string | number | boolean | null;
    /** Enumeration of allowed values for the field */
    enum?: string[];
    /** Child properties for object type */
    properties?: Record<string, JSONSchemaField>;
    /** Array item specification for array type */
    items?: JSONSchemaField;
    /** List of required property names */
    required?: string[];
};

/**
 * Maps Forman Schema primitive types to JSON Schema types.
 */
const FORMAN_PRIMITIVE_TYPE_MAP = {
    text: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'string',
    json: 'string',
};

/**
 * Maps JSON Schema primitive types to Forman Schema types.
 */
const JSON_PRIMITIVE_TYPE_MAP = {
    string: 'text',
    number: 'number',
    boolean: 'boolean',
};

/**
 * Utility function to handle empty strings by converting them to undefined.
 * @param text - The input text to check
 * @returns undefined if the input is falsy, otherwise returns the input text
 */
function noEmpty(text: string | undefined): string | undefined {
    if (!text) return undefined;
    return text;
}

/**
 * Converts a Forman Schema field to its JSON Schema equivalent.
 * @param field - The Forman Schema field to convert
 * @returns The equivalent JSON Schema field
 */
export function toJSONSchema(field: FormanSchemaField): JSONSchemaField {
    switch (field.type) {
        case 'collection':
            // For collections, create an object type with properties from the spec
            const required: string[] = [];
            const properties: Record<string, JSONSchemaField> = (Array.isArray(field.spec) ? field.spec : []).reduce(
                (object, subField) => {
                    // Skip fields without names
                    if (!subField.name) return object;
                    // Add required field names to the required array
                    if (subField.required) required.push(subField.name);

                    // Add the converted subfield to the properties object
                    return Object.defineProperty(object, subField.name, {
                        enumerable: true,
                        value: toJSONSchema(subField),
                    });
                },
                {},
            );

            return {
                type: 'object',
                description: noEmpty(field.help),
                properties,
                required,
            };
        case 'array':
            // For arrays, create an array type with items from the spec
            return {
                type: 'array',
                description: noEmpty(field.help),
                items:
                    field.spec &&
                    toJSONSchema(
                        Array.isArray(field.spec)
                            ? {
                                  // If spec is an array, treat it as a collection
                                  type: 'collection',
                                  spec: field.spec,
                              }
                            : field.spec,
                    ),
            };
        case 'select':
            // For select fields, create a string type with enum values
            return {
                type: 'string',
                description: noEmpty(field.help),
                enum: (field.options || []).map(option => option.value),
            };
        default:
            // For primitive types, use the type mapping
            return {
                type: FORMAN_PRIMITIVE_TYPE_MAP[field.type as keyof typeof FORMAN_PRIMITIVE_TYPE_MAP],
                default: field.default != '' && field.default != null ? field.default : undefined,
                description: noEmpty(field.help),
            };
    }
}

/**
 * Converts a JSON Schema field to its Forman Schema equivalent.
 * @param field - The JSON Schema field to convert
 * @returns The equivalent Forman Schema field
 */
export function toFormanSchema(field: JSONSchemaField): FormanSchemaField {
    switch (field.type) {
        case 'object':
            // For objects, create a collection type with spec from properties
            const spec: FormanSchemaField[] = field.properties
                ? Object.entries(field.properties).map(([name, property]) => {
                      // Convert each property to a Forman Schema field
                      const subField = toFormanSchema(property);
                      subField.name = name;
                      subField.required = field.required?.includes(name) || false;
                      return subField;
                  })
                : [];

            return {
                type: 'collection',
                help: field.description,
                spec,
            };
        case 'array':
            // For arrays, create an array type with spec from items
            return {
                type: 'array',
                help: field.description,
                spec:
                    field.items &&
                    (field.items?.type === 'object' && field.items.properties
                        ? Object.entries(field.items.properties).map(([name, property]) => {
                              // If items is an object, convert its properties to Forman Schema fields
                              const subField = toFormanSchema(property);
                              subField.name = name;
                              subField.required = field.items?.required?.includes(name) || false;
                              return subField;
                          })
                        : toFormanSchema(field.items)),
            };
        case 'string':
            if (field.enum) {
                // For strings with enum, create a select type
                return {
                    type: 'select',
                    help: field.description,
                    options: field.enum.map(value => ({ value })),
                };
            }

            // For regular strings, create a text type
            return {
                type: 'text',
                help: field.description,
                default: field.default,
            };
        default:
            // For primitive types, use the type mapping
            return {
                type: JSON_PRIMITIVE_TYPE_MAP[field.type as keyof typeof JSON_PRIMITIVE_TYPE_MAP],
                help: field.description,
                default: field.default,
            };
    }
}
