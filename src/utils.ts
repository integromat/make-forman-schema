import {
    FormanSchemaExtendedOptions,
    FormanSchemaField,
    FormanSchemaFieldState,
    FormanSchemaFieldType,
    FormanSchemaOption,
    FormanSchemaOptionGroup,
    FormanSchemaSelectOptionsStore,
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
export const FORMAN_REFERENCE_TYPES = [
    'account',
    'hook',
    'device',
    'keychain',
    'datastore',
    'aiagent',
    'udt',
    'scenario',
] as const;

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
    device: 'api://devices/{{kind}}',
    keychain: 'api://keys/{{kind}}',
    udt: 'api://data-structures',
    scenario: 'api://scenario-list',
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
 * Finds an option in the provided options and groups based on the given value.
 * Handles also the case of partially grouped selects, where some options can be on the top-level and some can be inside groups.
 * @param field The field for which to find the option
 * @param value The value to find in the options
 * @param optionsAndGroups The options and groups to search through
 */
export function findValueInSelectOptions(
    field: FormanSchemaField,
    value: unknown,
    optionsAndGroups?: FormanSchemaSelectOptionsStore,
): FormanSchemaOption | undefined {
    if (!optionsAndGroups) return undefined;
    if (field.grouped) {
        const found = optionsAndGroups
            .flatMap(group => ('options' in group ? group.options : []))
            .find(option => option.value === value);
        if (found) return found;
    }
    // The thing is, that Forman supports "partially-grouped" selects, so in case value is not found in the groups, it can still be sitting on the top-level.
    const found = optionsAndGroups.find(option => 'value' in option && option.value === value);
    return found as FormanSchemaOption | undefined; // If there was a value, then it has to be an option, because option groups don't have values
}

/**
 * Transforms a flat array of domain/path/state items into a nested object structure.
 * Intermediate path levels are placed in a 'nested' property.
 * @param items Array of items with domain, path, and state properties
 * @returns Nested object structure organized by domain
 */
export function buildRestoreStructure(
    items: Array<{
        domain: string;
        path: (string | number)[];
        state: Omit<FormanSchemaFieldState, 'nested' | 'items'>;
    }>,
): Record<string, FormanSchemaFieldState> {
    const result: Record<string, Record<string, FormanSchemaFieldState>> = {};

    for (const item of items) {
        const { domain, path, state } = item;

        // Ensure domain exists
        if (!result[domain]) {
            result[domain] = {};
        }

        let current: Record<string, FormanSchemaFieldState> | Record<string, FormanSchemaFieldState>[] = result[domain];

        // Navigate through the path
        for (const [index, key] of path.entries()) {
            const nextKey = path[index + 1];
            const isLastElement = index === path.length - 1;
            const nextIsNumber = typeof nextKey === 'number';

            if (Array.isArray(current)) {
                // We're in an array context
                if (typeof key !== 'number') {
                    throw new Error('Invalid path');
                }
                // Ensure the array item exists
                if (!current[key]) {
                    current[key] = {};
                }

                if (nextIsNumber) {
                    // Next level is also an array - create nested array structure
                    if (!current[key].value) {
                        current[key].value = {
                            mode: 'chose',
                            items: [],
                        };
                    }
                    if (!current[key].value.items) {
                        current[key].value.items = [];
                    }
                    current = current[key].value.items;
                } else if (isLastElement) {
                    // Last element - merge the state
                    Object.assign(current[key], state);
                } else {
                    // Move to the object at this array index
                    current = current[key];
                }
            } else {
                // We're in an object context
                if (typeof key !== 'string') {
                    throw new Error('Invalid path');
                }
                // Ensure the object item exists
                if (!current[key]) {
                    current[key] = {};
                }

                if (isLastElement) {
                    // Last element - merge the state
                    Object.assign(current[key], state);
                } else {
                    // Intermediate element - ensure it exists and navigate
                    if (nextIsNumber) {
                        // Next level is an array - create array structure
                        if (!current[key].items) {
                            current[key].items = [];
                            current[key].mode = 'chose';
                        }
                        current = current[key].items;
                    } else {
                        // Next level is an object - navigate to nested
                        if (!current[key].nested) {
                            current[key].nested = {};
                        }
                        current = current[key].nested;
                    }
                }
            }
        }
    }

    return result;
}

/**
 * Constants for IML filter entry types
 */
export const IML_FILTER_ENTRY_TYPES = ['null' as const, 'boolean' as const, 'number' as const, 'string' as const];

/**
 * Constants for unary IML filter operators
 */
export const IML_UNARY_FILTER_OPERATORS = ['exist' as const, 'notexist' as const];

/**
 * Constants for binary IML filter operators
 */
export const IML_BINARY_FILTER_OPERATORS = [
    'text:equal' as const,
    'text:equal:ci' as const,
    'text:notequal' as const,
    'text:notequal:ci' as const,
    'text:contain' as const,
    'text:contain:ci' as const,
    'text:notcontain' as const,
    'text:notcontain:ci' as const,
    'text:startwith' as const,
    'text:startwith:ci' as const,
    'text:notstartwith' as const,
    'text:notstartwith:ci' as const,
    'text:endwith' as const,
    'text:endwith:ci' as const,
    'text:notendwith' as const,
    'text:notendwith:ci' as const,
    'text:pattern' as const,
    'text:pattern:ci' as const,
    'text:notpattern' as const,
    'text:notpattern:ci' as const,
    'number:equal' as const,
    'number:notequal' as const,
    'number:greater' as const,
    'number:less' as const,
    'number:greaterorequal' as const,
    'number:lessorequal' as const,
    'date:equal' as const,
    'date:notequal' as const,
    'date:greater' as const,
    'date:less' as const,
    'date:greaterorequal' as const,
    'date:lessorequal' as const,
    'time:equal' as const,
    'time:notequal' as const,
    'time:greater' as const,
    'time:less' as const,
    'time:greaterorequal' as const,
    'time:lessorequal' as const,
    'semver:equal' as const,
    'semver:notequal' as const,
    'semver:greater' as const,
    'semver:less' as const,
    'semver:greaterorequal' as const,
    'semver:lessorequal' as const,
    'array:contain' as const,
    'array:contain:ci' as const,
    'array:notcontain' as const,
    'array:notcontain:ci' as const,
    'array:equal' as const,
    'array:notequal' as const,
    'array:greater' as const,
    'array:less' as const,
    'array:greaterorequal' as const,
    'array:lessorequal' as const,
    'boolean:equal' as const,
    'boolean:notequal' as const,
];
/**
 * Constants for all IML filter operators
 */
export const IML_FILTER_OPERATORS = [...IML_UNARY_FILTER_OPERATORS, ...IML_BINARY_FILTER_OPERATORS];
