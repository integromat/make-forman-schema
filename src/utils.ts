import {
    FormanSchemaExtendedOptions,
    FormanSchemaField,
    FormanSchemaFieldType,
    FormanSchemaOption,
    FormanSchemaOptionGroup,
} from './types';

/**
 * Visual types are not a real input fields, they are used to display information in the UI.
 */
export const FORMAN_VISUAL_TYPES = ['banner', 'markdown', 'html', 'separator'];

/**
 * Utility function to handle empty strings by converting them to undefined.
 * @param text The input text to check
 * @returns undefined if the input is falsy, otherwise returns the input text
 */
export function noEmpty(text: string | undefined): string | undefined {
    return text?.trim() || undefined;
}

/**
 * Utility function to check if a value is an object.
 * @param value The value to check
 * @returns true if the value is an object, false otherwise
 */
export function isObject<T = object>(value: unknown): value is T {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Utility function to check if a value is an option group.
 * @param value The value to check
 * @returns true if the value is an option group, false otherwise
 */
export function isOptionGroup(value: FormanSchemaOption | FormanSchemaOptionGroup): value is FormanSchemaOptionGroup {
    return 'options' in value && Array.isArray(value.options);
}

/**
 * Utility function to check if a value contains IML expression.
 */
export function containsIMLExpression(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return value.indexOf('{{') > -1 && value.indexOf('}}') > -1;
}

/**
 * Constants for API endpoints
 */
export const API_ENDPOINTS = {
    account: 'api://connections/{{kind}}',
    aiagent: 'api://ai-agents/v1/agents',
    datastore: 'api://data-stores',
    hook: 'api://hooks/{{kind}}',
    keychain: 'api://keys/{{kind}}',
    udt: 'api://data-structures',
} as const;

/**
 * Normalizes a field type by handling special types and prefixed types
 * @param field The field to normalize
 * @returns A normalized copy of the field
 */
export function normalizeFormanFieldType(field: FormanSchemaField): FormanSchemaField {
    const [type, kind] = field.type.split(':');
    if (!type) return field;
    if (!(type in API_ENDPOINTS)) return field;

    // If store is already defined, return the field as is
    let store = isObject<FormanSchemaExtendedOptions>(field.options) ? field.options.store : field.options;
    if (typeof store === 'string' || Array.isArray(store)) return field;

    store = API_ENDPOINTS[type as keyof typeof API_ENDPOINTS];
    store = store.replace('/{{kind}}', kind ? `/${kind}` : '');

    return {
        ...field,
        type: type! as FormanSchemaFieldType,
        options: {
            ...(field.options as FormanSchemaExtendedOptions),
            store,
        },
    };
}
