import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import type {
    FormanSchemaField,
    FormanSchemaValue,
    FormanSchemaExtendedOptions,
    FormanSchemaExtendedNested,
    FormanSchemaOption,
    FormanSchemaPathExtendedOptions,
} from './types';
import {
    noEmpty,
    isObject,
    isOptionGroup,
    normalizeFormanFieldType,
    isVisualType,
    IML_UNARY_FILTER_OPERATORS,
    IML_BINARY_FILTER_OPERATORS,
    IML_FILTER_ENTRY_TYPES,
} from './utils';

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
    /**
     * Add conditional fields to the schema
     * @param name The name of the field
     * @param value The value of the field
     * @param nested The nested fields to add
     */
    addConditionalFields: (name: string, value: FormanSchemaValue, nested: JSONSchema7 | string) => void;
}

/**
 * Domain root configuration
 */
export interface DomainRoot {
    /** Buffer of fields to add before the root has been found */
    buffer?: FormanDomainBuffer[];
    /** Add fields to the root
     * @param nested The nested fields to add
     * @param tail The tail of parameters in nested selects, required to resolve RPC payloads
     */
    addFields: (nested: (FormanSchemaField | string)[], tail?: string[]) => void;
}

/**
 * Buffer of fields to be added to a domain before the root has been identified
 */
export type FormanDomainBuffer = {
    /** Field to add */
    field: FormanSchemaField | string;
    /** Tail of parameters in nested selects, required to resolve RPC payloads */
    tail?: string[];
};

/**
 * Error thrown when schema conversion fails
 */
export class SchemaConversionError extends Error {
    /** Field that caused the error */
    public readonly field?: FormanSchemaField | JSONSchema7;

    /**
     * @param message The error message
     * @param field The field that caused the error
     */
    constructor(message: string, field?: FormanSchemaField | JSONSchema7) {
        super(message);
        this.name = 'SchemaConversionError';
    }
}

/**
 * Maps Forman Schema types to JSON Schema types.
 */
const FORMAN_TYPE_MAP: Readonly<Record<string, JSONSchema7['type']>> = {
    account: 'number',
    hook: 'number',
    keychain: 'number',
    datastore: 'number',
    aiagent: 'string',
    udt: 'number',
    array: 'array',
    collection: 'object',
    dynamicCollection: 'object',
    text: 'string',
    editor: 'string',
    number: 'number',
    boolean: 'boolean',
    checkbox: 'boolean',
    date: 'string',
    json: 'string',
    buffer: 'string',
    cert: 'string',
    color: 'string',
    email: 'string',
    filename: 'string',
    file: 'string',
    filter: 'array',
    folder: 'string',
    hidden: undefined,
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
    any: undefined,
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
    const normalizedField = normalizeFormanFieldType(field);

    const result: JSONSchema7 = {
        type: FORMAN_TYPE_MAP[normalizedField.type],
        title: noEmpty(normalizedField.label),
        description: noEmpty(normalizedField.help),
    };

    switch (normalizedField.type) {
        case 'collection':
        case 'dynamicCollection':
            return handleCollectionType(normalizedField, result, context);
        case 'array':
            return handleArrayType(normalizedField, result, context);
        case 'select':
        case 'account':
        case 'hook':
        case 'device':
        case 'keychain':
        case 'datastore':
        case 'aiagent':
        case 'file':
        case 'folder':
            return handleSelectOrPathType(normalizedField, result, context);
        case 'filter':
            return handleFilterType(normalizedField, result, context);
        default:
            return handlePrimitiveType(normalizedField, result, context);
    }
}

/**
 * Handles collection type conversion
 * @param field The field to convert
 * @param result The prepared JSON Schema field
 * @param context The context for the conversion
 * @returns The converted JSON Schema field
 */
function handleCollectionType(field: FormanSchemaField, result: JSONSchema7, context: ConversionContext): JSONSchema7 {
    Object.assign(result, {
        properties: {} as Record<string, JSONSchema7>,
        required: [],
    });

    function addField(subField: FormanSchemaField | string, tail?: string[]) {
        if (typeof subField === 'string') {
            const value = { $ref: appendQueryString(subField, context.domain, tail || context.tail) };

            result.allOf ||= [];
            result.allOf.push(value);
            return;
        }

        if (isVisualType(subField.type)) {
            return;
        }

        if (!subField.name) return;

        /*
        Some app configs may have duplicate field names.
        Forman handles that with bidirectional value binding.
        In JSON Schema, we can't have duplicate property names,
        so if the property has already been defined, we skip the redefinition,
        and keep the first defined one only.
         */
        if (result.properties && Object.hasOwn(result.properties, subField.name)) return;

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
                        then: typeof nested === 'string' ? { $ref: nested } : nested,
                    });
                },
            }),
        });
    }

    if (field['x-domain-root']) {
        const domainRoot = field['x-domain-root'] as string;
        const buffer = context.roots[domainRoot]?.buffer;

        context.roots[domainRoot] = {
            addFields: (nested: (FormanSchemaField | string)[], tail?: string[]) => {
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
 * @param field The field to convert
 * @param result The prepared JSON Schema field
 * @param context The context for the conversion
 * @returns The converted JSON Schema field
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
 * Handles filter type conversion
 * @param field The field to convert
 * @param result The prepared JSON Schema field
 * @param context The context for the conversion
 * @returns The converted JSON Schema field
 */
function handleFilterType(field: FormanSchemaField, result: JSONSchema7, context: ConversionContext): JSONSchema7 {
    const filterItems: JSONSchema7Definition = {
        oneOf: [
            {
                type: 'object',
                properties: {
                    a: { type: IML_FILTER_ENTRY_TYPES },
                    o: { enum: IML_UNARY_FILTER_OPERATORS },
                },
                required: ['a', 'o'],
            },
            {
                type: 'object',
                properties: {
                    a: { type: IML_FILTER_ENTRY_TYPES },
                    b: { type: IML_FILTER_ENTRY_TYPES },
                    o: { enum: IML_BINARY_FILTER_OPERATORS },
                },
                required: ['a', 'b', 'o'],
            },
        ],
    };
    const logic = field.logic ?? 'default';

    result.items = ['and', 'or'].includes(logic)
        ? filterItems
        : {
              type: 'array',
              items: filterItems,
          };
    // Store this to the JSON Schema to allow safe conversion back to the Forman Schema
    Object.defineProperty(result, 'x-filter', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: logic,
    });

    return result;
}

/**
 * Handles select type conversion
 * @param field The field to convert
 * @param result The prepared JSON Schema field
 * @param context The context for the conversion
 * @returns The converted JSON Schema field
 */
function handleSelectOrPathType(
    field: FormanSchemaField,
    result: JSONSchema7,
    context: ConversionContext,
): JSONSchema7 {
    const optionsOrGroups = isObject<FormanSchemaExtendedOptions | FormanSchemaPathExtendedOptions>(field.options)
        ? field.options.store
        : field.options;

    // Special flags for Files and Folders, as they need to be handled differently when RPCs are executed
    if (['file', 'folder'].includes(field.type)) {
        const optionsWrapper = isObject<FormanSchemaPathExtendedOptions>(field.options) ? field.options : undefined;
        Object.defineProperty(result, 'x-path', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: {
                type: field.type,
                showRoot: optionsWrapper?.showRoot ?? true,
                singleLevel: optionsWrapper?.singleLevel ?? false,
                ownName: field.name,
            },
        });
    }

    const { nested, domain } = extractNestedAndDomain(field);

    if (typeof optionsOrGroups === 'string') {
        Object.defineProperty(result, 'x-fetch', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: appendQueryString(optionsOrGroups, context.domain, context.tail),
        });
    } else {
        const options = optionsOrGroups?.flatMap(optionOrGroup => {
            // Selects can be partially grouped, unwrap the groups, and append the rest.
            if (isOptionGroup(optionOrGroup)) {
                return optionOrGroup.options.map(option => ({
                    ...option,
                    label: `${optionOrGroup.label}: ${option.label || option.value}`,
                }));
            }
            return optionOrGroup as FormanSchemaOption;
        });

        if (
            options?.some(option => {
                if (isOptionGroup(option)) return option.options.some(option => option.label || option.nested);
                return option.label || option.nested;
            })
        ) {
            result.oneOf = (options || []).map(option => {
                const localNested =
                    (isObject<FormanSchemaExtendedNested>(option.nested) ? option.nested.store : option.nested) ||
                    nested;

                const localNestedContainsStrings =
                    Array.isArray(localNested) && localNested.some(item => typeof item === 'string');

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
                            : localNestedContainsStrings
                              ? {
                                    type: 'object',
                                    allOf: localNested.map(item =>
                                        typeof item === 'string'
                                            ? {
                                                  $ref: appendQueryString(item, localDomain, [
                                                      ...context.tail,
                                                      field.name!,
                                                  ]),
                                              }
                                            : toJSONSchemaInternal(
                                                  {
                                                      type: 'collection',
                                                      spec: [item],
                                                  },
                                                  {
                                                      ...context,
                                                      domain: localDomain,
                                                      tail: [...context.tail, field.name!],
                                                  },
                                              ),
                                    ),
                                }
                              : toJSONSchemaInternal(
                                    { type: 'collection', spec: localNested as FormanSchemaField[] },
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
    }

    result = handleNestedWithDomain(field, nested, domain, result, context);

    if (field.rpc) result = processRpcDirective(field, result, context);
    return result;
}

/**
 * Handles primitive type conversion
 * @param field The field to convert
 * @param result The prepared JSON Schema field
 * @param context The context for the conversion
 * @returns The converted JSON Schema field
 */
function handlePrimitiveType(field: FormanSchemaField, result: JSONSchema7, context: ConversionContext): JSONSchema7 {
    if (field.default !== '' && field.default != null) {
        result.default = field.default;
    }

    // Add validation if present
    if (field.validate) {
        if (field.validate.pattern) {
            result.pattern =
                typeof field.validate.pattern === 'object' ? field.validate.pattern.regexp : field.validate.pattern;
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

    if (field.rpc) result = processRpcDirective(field, result, context);

    if (field.nested) {
        const { nested, domain } = extractNestedAndDomain(field);
        result = handleNestedWithDomain(field, nested, domain, result, context);
    }

    return result;
}

/**
 * Processes the RPC directive for a field
 * @param field The field with the RPC directive
 * @param result The prepared JSON Schema field
 * @param context The context for the conversion
 * @returns The converted JSON Schema field with RPC information
 */
function processRpcDirective(field: FormanSchemaField, result: JSONSchema7, context: ConversionContext): JSONSchema7 {
    if (!field.rpc) return result;

    Object.defineProperty(result, 'x-search', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: {
            url: appendQueryString(field.rpc.url, context.domain, context.tail),
            label: field.rpc.label,
            inputSchema:
                typeof field.rpc.parameters === 'string'
                    ? { $ref: field.rpc.parameters } // The context frame for the Panel RPC is not the form itself, so we're not propagating the Query String Tail here
                    : toJSONSchemaInternal({ type: 'collection', spec: field.rpc.parameters }, context),
        },
    });

    return result;
}

/**
 * Extracts nested fields and domain from a field, unwrapping extended nested format
 * @param field The field to extract from
 * @returns Object containing nested fields and optional domain
 */
function extractNestedAndDomain(field: FormanSchemaField): {
    nested: (FormanSchemaField | string)[] | string | undefined;
    domain: string | undefined;
} {
    const nested = isObject<FormanSchemaExtendedOptions>(field.options)
        ? isObject<FormanSchemaExtendedNested>(field.options.nested)
            ? field.options.nested.store
            : field.options.nested
        : isObject<FormanSchemaExtendedNested>(field.nested)
          ? field.nested.store
          : field.nested;

    const domain = isObject<FormanSchemaExtendedOptions>(field.options)
        ? isObject<FormanSchemaExtendedNested>(field.options.nested) && field.options.nested.domain
            ? field.options.nested.domain
            : undefined
        : isObject<FormanSchemaExtendedNested>(field.nested) && field.nested.domain
          ? field.nested.domain
          : undefined;

    return { nested, domain };
}

/**
 * Handles cross-domain nested fields by buffering them or processing inline
 * @param field The field with nested directive
 * @param nested The nested fields (already extracted)
 * @param domain The target domain (already extracted)
 * @param result The JSON Schema result to potentially modify
 * @param context The conversion context
 * @returns Modified result if inline processing, otherwise original result
 */
function handleNestedWithDomain(
    field: FormanSchemaField,
    nested: (FormanSchemaField | string)[] | string | undefined,
    domain: string | undefined,
    result: JSONSchema7,
    context: ConversionContext,
): JSONSchema7 {
    if (!nested) return result;

    if (domain && domain !== context.domain) {
        // Cross-domain: buffer the nested fields
        const normalizedNested = typeof nested === 'string' ? [nested] : nested;

        let root = context.roots[domain];
        if (!root) {
            const buffer: FormanDomainBuffer[] = [];
            root = context.roots[domain] = {
                buffer,
                addFields: (nested: (FormanSchemaField | string)[], tail?: string[]) => {
                    buffer.push(...nested.map(field => ({ field, tail })));
                },
            };
        }

        root.addFields(normalizedNested, [...context.tail, field.name!]);
        return result;
    }

    // Same domain: process inline
    return processNestedDirective(field, result, context);
}

/**
 * Processes nested directives by adding an x-nested property to the JSON Schema, handling both string and array formats
 * @param field The field with the nested directive
 * @param result The JSON Schema result to modify
 * @param context The conversion context
 * @returns The modified JSON Schema with nested information
 */
function processNestedDirective(
    field: FormanSchemaField,
    result: JSONSchema7,
    context: ConversionContext,
): JSONSchema7 {
    const { nested, domain } = extractNestedAndDomain(field);

    const nestedContainsStrings = Array.isArray(nested) && nested.some(item => typeof item === 'string');

    Object.defineProperty(result, 'x-nested', {
        configurable: true,
        enumerable: true,
        writable: true,
        value:
            typeof nested === 'string'
                ? { $ref: appendQueryString(nested, context.domain, [...context.tail, field.name!]) }
                : nestedContainsStrings
                  ? {
                        type: 'object',
                        allOf: nested.map(item =>
                            typeof item === 'string'
                                ? { $ref: appendQueryString(item, context.domain, [...context.tail, field.name!]) }
                                : toJSONSchemaInternal(
                                      { type: 'collection', spec: [item] },
                                      {
                                          ...context,
                                          domain: domain || context.domain,
                                          tail: [...context.tail, field.name!],
                                      },
                                  ),
                        ),
                    }
                  : toJSONSchemaInternal(
                        { type: 'collection', spec: nested as FormanSchemaField[] },
                        {
                            ...context,
                            domain: domain || context.domain,
                            tail: [...context.tail, field.name!],
                        },
                    ),
    });

    return result;
}
