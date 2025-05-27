import type { JSONSchema7 } from 'json-schema';
import type {
    FormanSchemaFieldType,
    FormanSchemaField,
    FormanSchemaValue,
    FormanSchemaExtendedOptions,
    FormanSchemaExtendedNested,
} from './types';
import { noEmpty, isObject } from './utils';

declare module 'json-schema' {
    interface JSONSchema7 extends Record<`x-${string}`, unknown> {}
}

/**
 * Context for schema conversion operations
 */
export interface ConversionContext {
    domain: string;
    /** Tail of parameters in nested selects, required to resolve RPC payloads */
    tail: string[];
    /** Path of parameters in nested collections */
    path: string[];
    /** Domain roots */
    roots: Record<string, DomainRoot>;
    addConditionalFields: (name: string, value: FormanSchemaValue, nested: JSONSchema7 | string) => void;
}

/**
 * Domain root configuration
 */
export interface DomainRoot {
    /** Buffer of fields to add before the root has been found */
    buffer?: FormainDomainBuffer[];
    /** Add fields to the root */
    addFields: (nested: FormanSchemaField[], tail?: string[]) => void;
}

export type FormainDomainBuffer = {
    field: FormanSchemaField;
    tail?: string[];
};

/**
 * Error thrown when schema conversion fails
 */
export class SchemaConversionError extends Error {
    constructor(
        message: string,
        public readonly field?: FormanSchemaField | JSONSchema7,
    ) {
        super(message);
        this.name = 'SchemaConversionError';
    }
}

/**
 * Constants for API endpoints
 */
export const API_ENDPOINTS = {
    CONNECTIONS: 'api://connections',
    HOOKS: 'api://hooks',
    KEYS: 'api://keys',
} as const;

/**
 * Maps Forman Schema types to JSON Schema types.
 */
const FORMAN_TYPE_MAP: Readonly<Record<string, JSONSchema7['type']>> = {
    account: 'number',
    hook: 'number',
    keychain: 'number',
    datastore: 'number',
    aiagent: 'string',
    array: 'array',
    collection: 'object',
    text: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'string',
    json: 'string',
    buffer: 'string',
    cert: 'string',
    color: 'string',
    email: 'string',
    filename: 'string',
    file: 'string',
    folder: 'string',
    hidden: 'string',
    integer: 'number',
    uinteger: 'number',
    password: 'string',
    path: 'string',
    pkey: 'string',
    port: 'number',
    select: 'string',
    time: 'string',
    timestamp: 'string',
    timezone: 'string',
    url: 'string',
    uuid: 'string',
} as const;

/**
 * Validates a Forman Schema field
 * @param field The field to validate
 * @throws {SchemaConversionError} If validation fails
 */
function validateFormanField(field: FormanSchemaField): void {
    if (!field.type) {
        throw new SchemaConversionError('Field type is required', field);
    }

    const normalizedType = field.type.includes(':') ? field.type.split(':')[0] : field.type;
    if (!Object.keys(FORMAN_TYPE_MAP).includes(normalizedType!)) {
        throw new SchemaConversionError(`Unknown field type: ${field.type}`, field);
    }
}

/**
 * Normalizes a field type by handling prefixed types
 * @param field The field to normalize
 * @returns A normalized copy of the field
 */
function normalizeFieldType(field: FormanSchemaField): FormanSchemaField {
    const typeHandlers = {
        'account:': (type: string) => ({
            ...field,
            type: 'account' as FormanSchemaFieldType,
            options: {
                ...(field.options as FormanSchemaExtendedOptions),
                store: `${API_ENDPOINTS.CONNECTIONS}/${type.substring(8)}`,
            },
        }),
        'hook:': (type: string) => ({
            ...field,
            type: 'hook' as FormanSchemaFieldType,
            options: {
                ...(field.options as FormanSchemaExtendedOptions),
                store: `${API_ENDPOINTS.HOOKS}/${type.substring(5)}`,
            },
        }),
        'keychain:': (type: string) => ({
            ...field,
            type: 'keychain' as FormanSchemaFieldType,
            options: {
                ...(field.options as FormanSchemaExtendedOptions),
                store: `${API_ENDPOINTS.KEYS}/${type.substring(9)}`,
            },
        }),
    };

    for (const [prefix, handler] of Object.entries(typeHandlers)) {
        if (field.type.startsWith(prefix)) {
            return handler(field.type);
        }
    }

    return field;
}

/**
 * Appends a query string to a path.
 * @param path The path to append the query string to
 * @param domain The domain to use in the query string (ignored, but kept for future use)
 * @param tail The tail to use in the query string
 * @returns The path with the query string appended
 */
function appendQueryString(path: string, domain: string, tail: string[]): string {
    if (path.startsWith('api://')) return path;

    const queryString = tail.map(part => `${encodeURIComponent(part)}={{${part}}}`).join('&');

    if (!queryString) return path;

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${queryString}`;
}

/**
 * Creates a default conversion context
 * @param options Conversion options
 * @returns A new conversion context
 */
function createDefaultContext(): ConversionContext {
    return {
        domain: 'default',
        tail: [],
        path: [],
        roots: {},
        addConditionalFields: () => {
            throw new SchemaConversionError('Cannot serialize nested fields without parent field.');
        },
    };
}

/**
 * Converts a Forman Schema field to its JSON Schema equivalent.
 * @param field The Forman Schema field to convert
 * @param context The context for the conversion
 * @returns The equivalent JSON Schema field
 */
export function toJSONSchemaInternal(
    field: FormanSchemaField,
    context: ConversionContext = createDefaultContext(),
): JSONSchema7 {
    // Validate the field
    validateFormanField(field);

    // Normalize field type (handle prefixed types)
    const normalizedField = normalizeFieldType(field);

    const result: JSONSchema7 = {
        type: FORMAN_TYPE_MAP[normalizedField.type] || 'string',
        title: noEmpty(normalizedField.label),
        description: noEmpty(normalizedField.help),
    };

    switch (normalizedField.type) {
        case 'collection':
            return handleCollectionType(normalizedField, result, context);
        case 'array':
            return handleArrayType(normalizedField, result, context);
        case 'select':
        case 'account':
        case 'hook':
        case 'keychain':
        case 'datastore':
        case 'aiagent':
        case 'file':
            return handleSelectType(normalizedField, result, context);
        default:
            return handlePrimitiveType(normalizedField, result);
    }
}

/**
 * Handles collection type conversion
 */
function handleCollectionType(field: FormanSchemaField, result: JSONSchema7, context: ConversionContext): JSONSchema7 {
    Object.assign(result, {
        type: 'object',
        properties: {} as Record<string, JSONSchema7>,
        required: [],
    });

    function addField(subField: FormanSchemaField, tail?: string[]) {
        if (!subField.name) return;

        if (subField.required) {
            result.required!.push(subField.name);
        }

        Object.defineProperty(result.properties, subField.name, {
            enumerable: true,
            value: toJSONSchemaInternal(subField, {
                ...context,
                domain: (field['x-domain-root'] as string) || context.domain,
                tail: tail || context.tail,
                path: [...context.path, field.name!],
                addConditionalFields: (name: string, value: FormanSchemaValue, nested: JSONSchema7 | string) => {
                    result.allOf ||= [];
                    result.allOf.push({
                        if: {
                            properties: {
                                [name]: { const: value },
                            },
                        },
                        then: typeof nested === 'string' ? { $ref: `${nested}#` } : nested,
                    });
                },
            }),
        });
    }

    if (field['x-domain-root']) {
        const domainRoot = field['x-domain-root'] as string;
        const buffer = context.roots[domainRoot]?.buffer;

        context.roots[domainRoot] = {
            addFields: (nested: FormanSchemaField[], tail?: string[]) => {
                nested.forEach(subField => addField(subField, tail));
            },
        };

        if (buffer) {
            buffer.forEach(item => addField(item.field, item.tail));
        }
    }

    if (Array.isArray(field.spec)) {
        field.spec.forEach(subField => addField(subField));
    }

    return result;
}

/**
 * Handles array type conversion
 */
function handleArrayType(field: FormanSchemaField, result: JSONSchema7, context: ConversionContext): JSONSchema7 {
    if (field.spec) {
        result.items = toJSONSchemaInternal(
            Array.isArray(field.spec) ? { type: 'collection', spec: field.spec } : field.spec,
            {
                ...context,
                path: [...context.path, `${field.name!}[]`],
            },
        );
    }

    // Add validation if present
    if (field.validate) {
        if (field.validate.minItems !== undefined) {
            result.minItems = field.validate.minItems;
        }
        if (field.validate.maxItems !== undefined) {
            result.maxItems = field.validate.maxItems;
        }
    }

    return result;
}

/**
 * Handles select type conversion
 */
function handleSelectType(field: FormanSchemaField, result: JSONSchema7, context: ConversionContext): JSONSchema7 {
    const options = isObject<FormanSchemaExtendedOptions>(field.options) ? field.options.store : field.options;

    const nested = isObject<FormanSchemaExtendedOptions>(field.options)
        ? isObject<FormanSchemaExtendedNested>(field.options.nested)
            ? field.options.nested.store
            : field.options.nested
        : undefined;

    const domain = isObject<FormanSchemaExtendedOptions>(field.options)
        ? isObject<FormanSchemaExtendedNested>(field.options.nested) && field.options.nested.domain
            ? field.options.nested.domain
            : undefined
        : undefined;

    if (typeof options === 'string') {
        result['x-fetch'] = appendQueryString(options, context.domain, context.tail);
    } else if (options?.some(option => option.label || option.nested)) {
        result.oneOf = (options || []).map(option => {
            const localNested =
                (isObject<FormanSchemaExtendedNested>(option.nested) ? option.nested.store : option.nested) || nested;

            const localDomain =
                (isObject<FormanSchemaExtendedNested>(option.nested) && option.nested.domain
                    ? option.nested.domain
                    : domain) || context.domain;

            if (localNested) {
                context.addConditionalFields(
                    field.name!,
                    option.value,
                    typeof localNested === 'string'
                        ? appendQueryString(localNested, localDomain, [...context.tail, field.name!])
                        : toJSONSchemaInternal(
                              { type: 'collection', spec: localNested },
                              {
                                  ...context,
                                  domain: localDomain,
                                  tail: [...context.tail, field.name!],
                              },
                          ),
                );
            }

            return {
                title: noEmpty(option.label),
                const: option.value,
            };
        });
    } else {
        result.enum = (options || []).map(option => option.value);
    }

    if (nested && domain && domain !== context.domain) {
        if (typeof nested === 'string') {
            throw new SchemaConversionError('Dynamic nested fields with domain change are not supported.');
        }

        let root = context.roots[domain];
        if (!root) {
            const buffer: FormainDomainBuffer[] = [];
            root = context.roots[domain] = {
                buffer,
                addFields: (nested: FormanSchemaField[], tail?: string[]) => {
                    buffer.push(...nested.map(field => ({ field, tail })));
                },
            };
        }

        root.addFields(nested, [...context.tail, field.name!]);
    } else if (nested) {
        result['x-nested'] =
            typeof nested === 'string'
                ? nested
                : toJSONSchemaInternal(
                      { type: 'collection', spec: nested },
                      {
                          ...context,
                          domain: domain || context.domain,
                          tail: [...context.tail, field.name!],
                      },
                  );
    }

    return result;
}

/**
 * Handles primitive type conversion
 */
function handlePrimitiveType(field: FormanSchemaField, result: JSONSchema7): JSONSchema7 {
    if (field.default !== '' && field.default != null) {
        result.default = field.default;
    }

    // Add validation if present
    if (field.validate) {
        if (field.validate.pattern) {
            result.pattern = field.validate.pattern;
        }
        if (field.validate.min !== undefined) {
            result.minimum = field.validate.min;
        }
        if (field.validate.max !== undefined) {
            result.maximum = field.validate.max;
        }
        if (field.validate.enum) {
            result.enum = field.validate.enum;
        }
    }

    return result;
}
