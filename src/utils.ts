import {
    FormanSchemaExtendedOptions,
    FormanSchemaField,
    FormanSchemaFieldType,
    FormanSchemaOption,
    FormanSchemaOptionGroup,
} from './types';

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
    CONNECTIONS: 'api://connections',
    HOOKS: 'api://hooks',
    KEYS: 'api://keys',
} as const;

/**
 * Normalizes a field type by handling prefixed types
 * @param field The field to normalize
 * @returns A normalized copy of the field
 */
export function normalizeFormanFieldType(field: FormanSchemaField): FormanSchemaField {
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
