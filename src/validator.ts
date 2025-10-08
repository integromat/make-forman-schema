import {
    FormanSchemaField,
    FormanValidationResult,
    FormanSchemaExtendedNested,
    FormanSchemaExtendedOptions,
    FormanSchemaOption,
    FormanSchemaOptionGroup,
    FormanValidationOptions,
    FormanSchemaNested,
} from './types';
import { containsIMLExpression, FORMAN_VISUAL_TYPES, isObject, isOptionGroup, normalizeFormanFieldType } from './utils';

/**
 * Context for schema validation operations
 */
export interface ValidationContext {
    /** Current domain */
    domain: string;
    /** Domain roots */
    roots: Record<string, DomainRoot>;
    /** Tail of parameters in nested selects, required to resolve RPC payloads */
    tail: {
        /** Name of the parameter */
        name: string;
        /** Value of the parameter */
        value: unknown;
    }[];
    /** Path of parameters in nested collections */
    path: string[];
    /** Unknown fields are not allowed when strict is true */
    strict: boolean;
    /** Validate nested fields */
    validateNestedFields(fields: FormanSchemaField[], context: ValidationContext): Promise<void>;
    /** Remote resource resolver */
    resolveRemote(path: string, context: ValidationContext): Promise<unknown>;
}

/**
 * Domain root configuration
 */
export interface DomainRoot {
    /** Validate fields in the root of the domain
     * @param fields The fields to validate
     * @param tail The tail of parameters in nested selects, required to resolve RPC payloads
     * @returns The validation result
     */
    validateFields: (fields: FormanSchemaField[], context: ValidationContext) => Promise<FormanValidationResult>;
    /** Fields seen by the validator (for strict mode) */
    seenFields: Set<string>;
}

/**
 * Maps Forman Schema types to JS values.
 */
const FORMAN_TYPE_MAP: Readonly<Record<string, string | undefined>> = {
    account: 'number',
    hook: 'number',
    keychain: 'number',
    datastore: 'number',
    aiagent: 'string',
    udt: 'number',
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
    hidden: undefined,
    integer: 'number',
    uinteger: 'number',
    password: 'string',
    path: 'string',
    pkey: 'string',
    port: 'number',
    select: undefined,
    time: 'string',
    timestamp: 'string',
    timezone: 'string',
    upload: 'array',
    url: 'string',
    uuid: 'string',
    any: undefined,
} as const;

/**
 * Validates a Forman domains against schemas
 * @param domains The domains to validate
 * @param options The validation options
 * @returns The validation result
 */
export async function validateFormanWithDomainsInternal(
    domains: Record<
        string,
        {
            values: Record<string, unknown>;
            schema?: FormanSchemaField[];
        }
    >,
    options?: FormanValidationOptions,
): Promise<FormanValidationResult> {
    const errors: FormanValidationResult['errors'] = [];

    const roots = Object.keys(domains).reduce(
        (acc, domain) => {
            acc[domain] = {
                seenFields: new Set(),
                validateFields: (fields: FormanSchemaField[], context: ValidationContext) => {
                    return validateFormanValue(
                        domains[domain]!.values,
                        {
                            name: domain,
                            type: 'collection',
                            spec: fields,
                        },
                        {
                            ...context,
                            path: [],
                            domain,
                        },
                    );
                },
            };

            return acc;
        },
        {} as Record<string, DomainRoot>,
    );

    for (const domain of Object.keys(domains)) {
        if (!domains[domain]) continue;

        const result = await validateFormanValue(
            domains[domain].values,
            {
                name: domain,
                type: 'collection',
                spec: domains[domain].schema || [],
            },
            {
                roots,
                domain,
                path: [],
                tail: [],
                strict: options?.strict === true,
                validateNestedFields: () => {
                    throw new Error('Cannot validate nested fields without parent field.');
                },
                resolveRemote: async (path, context) => {
                    if (!options?.resolveRemote) {
                        throw new Error('Remote resource not supported when resolver is not provided.');
                    }
                    const data = context.tail.reduce(
                        (acc, curr) => {
                            acc[curr.name] = curr.value;
                            return acc;
                        },
                        {} as Record<string, unknown>,
                    );
                    return await options.resolveRemote(path, data);
                },
            },
        );
        errors.push(...result.errors);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates a Forman value against a schema
 * @param value The value to validate
 * @param field The schema to validate against
 * @param context The context for the validation
 * @returns The validation result
 */
async function validateFormanValue(
    value: unknown,
    field: FormanSchemaField,
    context: ValidationContext,
): Promise<FormanValidationResult> {
    if (FORMAN_VISUAL_TYPES.includes(field.type)) {
        return {
            valid: true,
            errors: [],
        };
    }

    // Normalize field type (handle prefixed types)
    const normalizedField = normalizeFormanFieldType(field);

    if (normalizedField.required && (value == null || value === '')) {
        return {
            valid: false,
            errors: [
                {
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: 'Field is mandatory.',
                },
            ],
        };
    }

    if (value == null) {
        return {
            valid: true,
            errors: [],
        };
    }

    const expectedType = FORMAN_TYPE_MAP[normalizedField.type];
    let actualType: string = typeof value;
    if (actualType === 'object' && Array.isArray(value)) actualType = 'array';

    if (expectedType && expectedType !== actualType) {
        return {
            valid: false,
            errors: [
                {
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Expected type '${expectedType}', got type '${actualType}'.`,
                },
            ],
        };
    }

    switch (normalizedField.type) {
        case 'collection':
            return handleCollectionType(value as Record<string, unknown>, normalizedField, context);
        case 'array':
            return handleArrayType(value as unknown[], normalizedField, context);
        case 'select':
        case 'account':
        case 'hook':
        case 'keychain':
        case 'datastore':
        case 'aiagent':
        case 'udt':
        case 'file':
        case 'folder':
            return handleSelectType(value, normalizedField, context);
        default:
            return handlePrimitiveType(value, normalizedField, context);
    }
}

/**
 * Handles collection type validation
 * @param field The field to convert
 * @param object The object to validate
 * @param schema The schema to validate against
 * @returns The validation result
 */
async function handleCollectionType(
    value: Record<string, unknown>,
    field: FormanSchemaField,
    context: ValidationContext,
): Promise<FormanValidationResult> {
    const errors: FormanValidationResult['errors'] = [];
    const seen = context.path.length === 0 ? context.roots[context.domain]!.seenFields : new Set<string>();
    const path = context.path;

    if (Array.isArray(field.spec)) {
        const spec = field.spec.slice();
        while (spec.length > 0) {
            let subField = spec.shift();
            if (!subField) continue;

            if (typeof subField === 'string') {
                try {
                    const resolved = (await context.resolveRemote(subField, context)) as FormanSchemaField;
                    if (Array.isArray(resolved)) {
                        spec.unshift(...resolved);
                        continue;
                    } else {
                        subField = resolved;
                    }
                } catch (error) {
                    return {
                        valid: false,
                        errors: [
                            ...errors,
                            {
                                domain: context.domain,
                                path: context.path.join('.'),
                                message: `Failed to resolve remote resource ${subField}: ${error}`,
                            },
                        ],
                    };
                }
            }

            if (FORMAN_VISUAL_TYPES.includes(subField.type)) {
                continue;
            }
            if (!subField.name) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: 'Object contains field with unknown name.',
                });
                continue;
            }
            if (context.strict && !seen.has(subField.name)) seen.add(subField.name);
            const result = await validateFormanValue(value[subField.name], subField, {
                ...context,
                path: [...path, subField.name],
                validateNestedFields: async (fields: FormanSchemaField[], context: ValidationContext) => {
                    for (const subField of fields) {
                        if (FORMAN_VISUAL_TYPES.includes(subField.type)) {
                            continue;
                        }
                        if (!subField.name) {
                            errors.push({
                                domain: context.domain,
                                path: context.path.join('.'),
                                message: 'Object contains field with unknown name.',
                            });
                            continue;
                        }
                        if (context.strict && !seen.has(subField.name)) seen.add(subField.name);
                        const result = await validateFormanValue(value[subField.name], subField, {
                            ...context,
                            path: [...path, subField.name],
                        });
                        errors.push(...result.errors);
                    }
                },
            });
            errors.push(...result.errors);
        }
    }

    if (context.strict) {
        for (const key of Object.keys(value)) {
            if (!seen.has(key)) {
                seen.add(key); // To avoid duplicate detection when nested fields are specified by another domain
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Unknown field '${key}'.`,
                });
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Handles array type validation
 * @param field The field to convert
 * @param value The value to validate
 * @param path The path to the value
 * @returns The validation result
 */
async function handleArrayType(
    value: unknown[],
    field: FormanSchemaField,
    context: ValidationContext,
): Promise<FormanValidationResult> {
    const errors: FormanValidationResult['errors'] = [];

    if (field.spec) {
        for (const [index, item] of value.entries()) {
            const result = await validateFormanValue(
                item,
                Array.isArray(field.spec)
                    ? { name: index.toString(), type: 'collection', spec: field.spec }
                    : Object.assign({}, field.spec, { name: index.toString() }),
                { ...context, path: [...context.path, index.toString()] },
            );
            errors.push(...result.errors);
        }
    }

    // Add validation if present
    if (field.validate) {
        if (field.validate.minItems !== undefined && value.length < field.validate.minItems) {
            errors.push({
                domain: context.domain,
                path: context.path.join('.'),
                message: `Array has less than ${field.validate.minItems} items.`,
            });
        }
        if (field.validate.maxItems !== undefined && value.length > field.validate.maxItems) {
            errors.push({
                domain: context.domain,
                path: context.path.join('.'),
                message: `Array has more than ${field.validate.maxItems} items.`,
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Handles select type validation
 * @param field The field to convert
 * @param result The prepared JSON Schema field
 * @param context The context for the conversion
 * @returns The converted JSON Schema field
 */
async function handleSelectType(
    value: unknown,
    field: FormanSchemaField,
    context: ValidationContext,
): Promise<FormanValidationResult> {
    const errors: FormanValidationResult['errors'] = [];

    let optionsOrGroups = isObject<FormanSchemaExtendedOptions>(field.options) ? field.options.store : field.options;
    let nested = field.nested
        ? field.nested
        : isObject<FormanSchemaExtendedOptions>(field.options)
          ? field.options.nested
          : undefined;

    if (typeof optionsOrGroups === 'string') {
        try {
            optionsOrGroups = (await context.resolveRemote(optionsOrGroups, context)) as
                | FormanSchemaOption[]
                | FormanSchemaOptionGroup[];
        } catch (error) {
            return {
                valid: false,
                errors: [
                    ...errors,
                    {
                        domain: context.domain,
                        path: context.path.join('.'),
                        message: `Failed to resolve remote resource ${optionsOrGroups}: ${error}`,
                    },
                ],
            };
        }
    }

    if (field.multiple) {
        if (!Array.isArray(value)) {
            return {
                valid: false,
                errors: [
                    ...errors,
                    {
                        domain: context.domain,
                        path: context.path.join('.'),
                        message: `Value is not an array.`,
                    },
                ],
            };
        }

        for (const singleValue of value) {
            const found = field.grouped
                ? (optionsOrGroups as FormanSchemaOptionGroup[]).some(group =>
                      group.options.some(option => option.value === singleValue),
                  )
                : (optionsOrGroups as FormanSchemaOption[]).some(option => option.value === singleValue);
            if (!found) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Value '${singleValue}' not found in options.`,
                });
            }
        }

        // Add validation if present
        if (field.validate) {
            if (field.validate.minItems !== undefined && value.length < field.validate.minItems) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Selected less than ${field.validate.minItems} items.`,
                });
            }
            if (field.validate.maxItems !== undefined && value.length > field.validate.maxItems) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Selected more than ${field.validate.maxItems} items.`,
                });
            }
        }
    } else {
        const item = field.grouped
            ? (optionsOrGroups as FormanSchemaOptionGroup[])
                  .find(group => group.options.some(option => option.value === value))
                  ?.options.find(option => option.value === value)
            : (optionsOrGroups as FormanSchemaOption[]).find(option => option.value === value);

        if (!item) {
            return {
                valid: false,
                errors: [
                    ...errors,
                    {
                        domain: context.domain,
                        path: context.path.join('.'),
                        message: `Value '${value}' not found in options.`,
                    },
                ],
            };
        }

        if (item.nested) nested = item.nested;
    }

    if (nested) {
        const result = await handleNestedFields(nested, value, field, context);
        errors.push(...result.errors);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Handles nested fields validation
 * @param nested The nested fields
 * @param value The value to validate
 * @param field The field to validate
 * @param context The context for the validation
 * @returns The validation result
 */
async function handleNestedFields(
    nested: FormanSchemaNested | FormanSchemaExtendedNested,
    value: unknown,
    field: FormanSchemaField,
    context: ValidationContext,
): Promise<FormanValidationResult> {
    const errors: FormanValidationResult['errors'] = [];

    let store = isObject<FormanSchemaExtendedNested>(nested) ? nested.store : nested;
    const domain = isObject<FormanSchemaExtendedNested>(nested) && nested.domain ? nested.domain : undefined;
    context = {
        ...context,
        tail: field.name ? [...context.tail, { name: field.name, value }] : context.tail,
    };

    if (typeof store === 'string') {
        try {
            store = (await context.resolveRemote(store, context)) as FormanSchemaField[];
        } catch (error) {
            return {
                valid: false,
                errors: [
                    ...errors,
                    {
                        domain: context.domain,
                        path: context.path.join('.'),
                        message: `Failed to resolve remote resource ${store}: ${error}`,
                    },
                ],
            };
        }
    }

    if (store && domain && domain !== context.domain) {
        if (!context.roots[domain]) {
            errors.push({
                domain: context.domain,
                path: context.path.join('.'),
                message: `Unable to process nested fields: Domain '${domain}' not found.`,
            });
        } else {
            const result = await context.roots[domain].validateFields(store as FormanSchemaField[], context);
            errors.push(...result.errors);
        }
    } else if (store) {
        await context.validateNestedFields(store as FormanSchemaField[], context);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Handles primitive type validation
 * @param value The value to validate
 * @param field The field to validate
 * @returns The validation result
 */
async function handlePrimitiveType(
    value: unknown,
    field: FormanSchemaField,
    context: ValidationContext,
): Promise<FormanValidationResult> {
    const errors: FormanValidationResult['errors'] = [];

    if (containsIMLExpression(value)) {
        return {
            valid: true,
            errors,
        };
    }

    if (errors.length > 0) {
        // No need to continue if type is not valid
        return {
            valid: false,
            errors,
        };
    }

    // Add validation if present
    if (field.validate) {
        if (typeof value === 'string') {
            if (
                field.validate.pattern &&
                !new RegExp(
                    typeof field.validate.pattern === 'object' ? field.validate.pattern.regexp : field.validate.pattern,
                ).test(value)
            ) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Value doesn't match the pattern: ${typeof field.validate.pattern === 'object' ? field.validate.pattern.regexp : field.validate.pattern}`,
                });
            }
            if (field.validate.min !== undefined && value.length < field.validate.min) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Value must be at least ${field.validate.min} characters long.`,
                });
            }
            if (field.validate.max !== undefined && value.length > field.validate.max) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Value exceeded maximum length of ${field.validate.max} characters.`,
                });
            }
            if (field.validate.enum && !field.validate.enum.includes(value)) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: 'Value must be one of the following: ' + field.validate.enum.join(', '),
                });
            }
        } else if (typeof value === 'number') {
            if (field.validate.min !== undefined && value < field.validate.min) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Value is too small. Minimum value is ${field.validate.min}.`,
                });
            }
            if (field.validate.max !== undefined && value > field.validate.max) {
                errors.push({
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Value is too big. Maximum value is ${field.validate.max}.`,
                });
            }
        }
    }

    if (field.nested) {
        const result = await handleNestedFields(field.nested, value, field, context);
        errors.push(...result.errors);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
