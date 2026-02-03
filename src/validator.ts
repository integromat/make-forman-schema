import type {
    FormanSchemaField,
    FormanValidationResult,
    FormanSchemaExtendedNested,
    FormanSchemaExtendedOptions,
    FormanSchemaOption,
    FormanSchemaOptionGroup,
    FormanValidationOptions,
    FormanSchemaNested,
    FormanSchemaFieldState,
    FormanSchemaPathExtendedOptions,
    FormanSchemaDirectoryOption,
} from './types';
import {
    containsIMLExpression,
    isObject,
    buildRestoreStructure,
    isPrimitiveIMLExpression,
    normalizeFormanFieldType,
    isVisualType,
    isReferenceType,
    IML_FILTER_OPERATORS,
} from './utils';

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
    /** Path of parameters in nested collections (string for field name, number for array index) */
    path: (string | number)[];
    /** Unknown fields are not allowed when strict is true */
    strict: boolean;
    /** Validate nested fields */
    validateNestedFields(fields: FormanSchemaField[], context: ValidationContext): Promise<void>;
    /** Remote resource resolver */
    resolveRemote(path: string, context: ValidationContext, localData?: Record<string, unknown>): Promise<unknown>;
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
    /** States of fields used to restore UI components */
    fieldStates: Array<{
        /** Path of the field (string for field name, number for array index) */
        path: (string | number)[];
        /** State of the field */
        state: Omit<FormanSchemaFieldState, 'nested' | 'items'>;
    }>;
}

/**
 * Maps Forman Schema types to JS values.
 */
const FORMAN_TYPE_MAP: Readonly<Record<string, string | undefined>> = {
    account: 'number',
    hook: 'number',
    device: 'number',
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
    filter: 'array',
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
                fieldStates: [],
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
                resolveRemote: async (path, context, localData) => {
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
                    return await options.resolveRemote(path, {
                        ...data,
                        ...localData,
                    });
                },
            },
        );
        errors.push(...result.errors);
    }

    return {
        valid: errors.length === 0,
        errors,
        states:
            errors.length === 0 && options?.states
                ? buildRestoreStructure(
                      Object.keys(domains)
                          .map(domain => roots[domain]!.fieldStates.map(state => ({ domain, ...state })))
                          .flat(),
                  )
                : undefined,
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
    if (isVisualType(field.type)) {
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

    if (expectedType && expectedType !== actualType && !isPrimitiveIMLExpression(value)) {
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

    if (containsIMLExpression(value)) {
        if (normalizedField.mappable === false) {
            return {
                valid: false,
                errors: [
                    {
                        domain: context.domain,
                        path: context.path.join('.'),
                        message: 'Value contains prohibited IML expression.',
                    },
                ],
            };
        }
        return {
            valid: true,
            errors: [],
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
        case 'device':
        case 'keychain':
        case 'datastore':
        case 'aiagent':
        case 'udt':
        case 'scenario':
            return handleSelectType(value, normalizedField, context);
        case 'file':
        case 'folder':
            return handlePathType(value, normalizedField, context);
        case 'filter':
            return handleFilterType(value, normalizedField, context);
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

            if (isVisualType(subField.type)) {
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
                        if (isVisualType(subField.type)) {
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
                { ...context, path: [...context.path, index] },
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
 * Handles filter type validation
 * @param value Value to validate
 * @param field Forman Field Definition
 * @param context The context for the validation
 * @returns Validation result
 */
async function handleFilterType(value: unknown, field: FormanSchemaField, context: ValidationContext) {
    // The filter is technically just an array or arrays, or an array. Craft the inline definition and pass to array validator instead.
    const filterEntry: FormanSchemaField = {
        type: 'collection',
        spec: [
            {
                name: 'a',
                type: 'any',
                required: true,
            },
            {
                name: 'b',
                type: 'any',
            },
            {
                name: 'o',
                type: 'text',
                validate: {
                    enum: IML_FILTER_OPERATORS,
                },
            },
        ],
    };

    const inlineSchema: FormanSchemaField = ['and', 'or'].includes(field.logic ?? 'default')
        ? {
              name: field.name,
              type: 'array',
              spec: filterEntry,
          }
        : {
              name: field.name,
              type: 'array',
              spec: {
                  type: 'array',
                  spec: filterEntry,
              },
          };
    return handleArrayType(value as unknown[], inlineSchema, context);
}

async function handlePathType(value: unknown, field: FormanSchemaField, context: ValidationContext) {
    const errors: FormanValidationResult['errors'] = [];

    if (typeof value !== 'string') {
        return {
            valid: false,
            errors: [
                ...errors,
                {
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Expected type 'string' for path, got type '${typeof value}'.`,
                },
            ],
        };
    }

    let showRoot = true;
    let ids = false;
    let singleLevel = false;
    let options: string | FormanSchemaPathExtendedOptions | FormanSchemaDirectoryOption[];

    if (isObject<FormanSchemaPathExtendedOptions>(field.options)) {
        if (field.options.showRoot !== undefined) showRoot = field.options.showRoot;
        if (field.options.ids !== undefined) ids = field.options.ids;
        if (field.options.singleLevel !== undefined) singleLevel = field.options.singleLevel;
        options = field.options.store;
    } else {
        options = field.options as string | FormanSchemaDirectoryOption[];
    }

    // If single level AND either (not showing root and value contains slashes) OR (showing root and there's more than the root slash), it's invalid
    if (singleLevel && ((!showRoot && value.includes('/')) || (showRoot && value.lastIndexOf('/') > 0))) {
        return {
            valid: false,
            errors: [
                ...errors,
                {
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Single level path cannot contain slashes.`,
                },
            ],
        };
    }
    let nested = field.nested
        ? field.nested
        : isObject<FormanSchemaPathExtendedOptions>(field.options)
          ? field.options.nested
          : undefined;

    // In order to validate the full path, we need to go level-by-level in the nesting. That's the only way we get also the labels correctly.
    const levels = value.split('/');

    // This way we start with an empty path always
    if (levels[0] !== '') levels.unshift('');

    // Special case: root folder is valid for folder type
    if (showRoot && value === '/' && field.type === 'folder') {
        return {
            valid: true,
            errors: [],
        };
    }

    // Now there have to be at least two levels (root + one entry)
    if (levels.length < 2) {
        return {
            valid: false,
            errors: [
                ...errors,
                {
                    domain: context.domain,
                    path: context.path.join('.'),
                    message: `Invalid path "${value}" encountered.`,
                },
            ],
        };
    }

    const selectedPath: FormanSchemaDirectoryOption[] = [];
    let levelOptions: FormanSchemaDirectoryOption[] = [];

    for (let levelIndex = 0; levelIndex < levels.length - 1; ++levelIndex) {
        const isLastLevel = levelIndex === levels.length - 2;
        const levelSelectedValue = levels[levelIndex + 1];
        const selectedPathValue = selectedPath.map(({ value }) => value).join('/');

        if (!levelSelectedValue) {
            return {
                valid: false,
                errors: [
                    ...errors,
                    {
                        domain: context.domain,
                        path: context.path.join('.'),
                        message: `Invalid selected value of "${value}" encountered.`,
                    },
                ],
            };
        }

        if (typeof options === 'string') {
            try {
                levelOptions = (await context.resolveRemote(options, context, {
                    [field.name!]: (showRoot && !selectedPathValue.startsWith('/') ? '/' : '') + selectedPathValue,
                })) as FormanSchemaDirectoryOption[];
            } catch (error) {
                return {
                    valid: false,
                    errors: [
                        ...errors,
                        {
                            domain: context.domain,
                            path: context.path.join('.'),
                            message: `Failed to resolve remote resource ${options}: ${error}`,
                        },
                    ],
                };
            }
        } else if (isLastLevel) {
            levelOptions = options;
        }

        const selectableOptions = levelOptions.flatMap(candidate => {
            // In the last level, filter only files or folders, based on the field type
            if (
                isLastLevel &&
                ((field.type === 'file' && !candidate.file) || (field.type === 'folder' && candidate.file))
            ) {
                return [];
            }

            // In non-last levels, filter out files, as we accept only folders there
            if (!isLastLevel && candidate.file) {
                return [];
            }

            return candidate;
        });

        const selectedOption = selectableOptions.find(candidate => candidate.value === levelSelectedValue);
        if (!selectedOption) {
            return {
                valid: false,
                errors: [
                    ...errors,
                    {
                        domain: context.domain,
                        path: context.path.join('.'),
                        message: `Path '${levelSelectedValue}' not found in options.`,
                    },
                ],
            };
        }
        selectedPath.push(selectedOption);
    }

    if (ids) {
        /** Add state of the field to the domain root */
        context.roots[context.domain]!.fieldStates.push({
            path: context.path,
            state: {
                mode: 'chose',
                path: selectedPath.map(({ label, value }) => (label ?? value) as string),
            },
        });
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

        if (item.label) {
            /** Add state of the field to the domain root */
            context.roots[context.domain]!.fieldStates.push({
                path: context.path,
                state: {
                    mode: isReferenceType(field.type) ? undefined : 'chose',
                    label: item.label,
                },
            });
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
        store = [store];
    }

    if (Array.isArray(store) && store.some(item => typeof item === 'string')) {
        const resolvedStore: FormanSchemaField[] = [];
        for (const item of store) {
            if (typeof item === 'string') {
                try {
                    resolvedStore.push(...((await context.resolveRemote(item, context)) as FormanSchemaField[]));
                } catch (error) {
                    return {
                        valid: false,
                        errors: [
                            ...errors,
                            {
                                domain: context.domain,
                                path: context.path.join('.'),
                                message: `Failed to resolve remote resource ${item}: ${error}`,
                            },
                        ],
                    };
                }
            } else {
                resolvedStore.push(item);
            }
        }
        store = resolvedStore;
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
