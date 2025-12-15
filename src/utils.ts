import {
    FormanSchemaExtendedOptions,
    FormanSchemaField,
    FormanSchemaFieldState,
    FormanSchemaFieldType,
    FormanSchemaOption,
    FormanSchemaOptionGroup,
} from './types';

/**
 * Visual types are not a real input fields, they are used to display information in the UI.
 */
export const FORMAN_VISUAL_TYPES = ['banner', 'markdown', 'html', 'separator'] as const;

/**
 * Type guard to check if a field type is a visual type.
 * @param type The field type to check
 * @returns true if the type is a visual type
 */
export function isVisualType(type: FormanSchemaFieldType): type is (typeof FORMAN_VISUAL_TYPES)[number] {
    return (FORMAN_VISUAL_TYPES as readonly string[]).includes(type);
}

/**
 * Reference types are types of type select that reference external resources.
 */
export const FORMAN_REFERENCE_TYPES = ['account', 'hook', 'keychain', 'datastore', 'aiagent', 'udt'] as const;

/**
 * Type guard to check if a field type is a reference type.
 * @param type The field type to check
 * @returns true if the type is a reference type
 */
export function isReferenceType(type: FormanSchemaFieldType): type is (typeof FORMAN_REFERENCE_TYPES)[number] {
    return (FORMAN_REFERENCE_TYPES as readonly string[]).includes(type);
}

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
 * Utility function to check if a value is a primitive IML expression.
 * @param value
 */
export function isPrimitiveIMLExpression(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    // The last index of '{{' has to be at the start, meaning there's no following '{{' anywhere further, and the first closing '}}' has to be at the end
    return value.lastIndexOf('{{') === 0 && value.indexOf('}}') === value.length - 2;
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

/**
 * Transforms a flat array of domain/path/state items into a nested object structure.
 * Intermediate path levels are placed in a 'nested' property.
 * @param items Array of items with domain, path, and state properties
 * @returns Nested object structure organized by domain
 */
export function buildRestoreStructure(
    items: Array<{ domain: string; path: string[]; state: FormanSchemaFieldState }>,
): Record<string, FormanSchemaFieldState> {
    const result: Record<string, Record<string, FormanSchemaFieldState>> = {};

    for (const item of items) {
        const { domain, path, state } = item;

        // Ensure domain exists
        if (!result[domain]) {
            result[domain] = {};
        }

        let current = result[domain];

        // Navigate through the path
        for (let i = 0; i < path.length; i++) {
            const key = path[i];
            if (!key) continue;

            if (i === path.length - 1) {
                // Last element in path - merge state
                if (!current[key]) {
                    current[key] = {};
                }
                Object.assign(current[key], state);
            } else {
                // Not the last element - ensure it exists and navigate to nested
                if (!current[key]) {
                    current[key] = {};
                }
                if (!current[key].nested) {
                    current[key].nested = {};
                }
                current = current[key].nested;
            }
        }
    }

    return result;
}
