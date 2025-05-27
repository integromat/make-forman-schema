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
