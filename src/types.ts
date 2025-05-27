/**
 * Valid Forman Schema field types
 */
export type FormanSchemaFieldType =
    | 'account'
    | 'hook'
    | 'keychain'
    | 'datastore'
    | 'aiagent'
    | 'array'
    | 'collection'
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'json'
    | 'buffer'
    | 'cert'
    | 'color'
    | 'email'
    | 'filename'
    | 'file'
    | 'folder'
    | 'hidden'
    | 'integer'
    | 'uinteger'
    | 'path'
    | 'pkey'
    | 'port'
    | 'select'
    | 'time'
    | 'timestamp'
    | 'timezone'
    | 'url'
    | 'uuid'
    | `account:${string}`
    | `hook:${string}`
    | `keychain:${string}`
    | string;

/**
 * Validation configuration for Forman Schema fields
 */
export interface FormanSchemaValidation {
    /** Pattern for string validation */
    pattern?: string;
    /** Minimum value */
    min?: number;
    /** Maximum value */
    max?: number;
    /** Minimum number of items */
    minItems?: number;
    /** Maximum number of items */
    maxItems?: number;
    /** Enumeration of allowed values */
    enum?: string[];
}

/**
 * Represents a field in Forman Schema format.
 */
export type FormanSchemaField = {
    /** Field name identifier */
    name?: string;
    /** The field type (e.g., 'text', 'number', 'boolean', 'collection', 'array', etc.) */
    type: FormanSchemaFieldType;
    /** Whether the field is required or not */
    required?: boolean;
    /** Default value for the field */
    default?: FormanSchemaValue;
    /** Available options for select type fields */
    options?: FormanSchemaOption[] | FormanSchemaExtendedOptions | string;
    /** Help text or description for the field */
    help?: string;
    /** Sub-fields specification for collection or array types */
    spec?: FormanSchemaField[] | FormanSchemaField;
    /** Hide field behind advanced toggle */
    advanced?: boolean;
    /** Human readable label for the field */
    label?: string;
    /** Nested fields */
    nested?: FormanSchemaNested;
    /** Validation rules */
    validate?: FormanSchemaValidation;
} & Record<`x-${string}`, unknown>;

export type FormanSchemaValue = string | number | boolean | null;

export type FormanSchemaOption = {
    /** Option value */
    value: FormanSchemaValue;
    /** Option label */
    label?: string;
    /** Nested fields for this option */
    nested?: FormanSchemaNested;
};

export type FormanSchemaExtendedOptions = {
    /** Store for the options */
    store: FormanSchemaOption[] | string;
    /** Nested fields for every option */
    nested?: FormanSchemaNested;
};

export type FormanSchemaNested = FormanSchemaField[] | string | FormanSchemaExtendedNested;

export type FormanSchemaExtendedNested = {
    store: FormanSchemaField[] | string;
    domain?: string;
};
