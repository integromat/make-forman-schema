/**
 * Valid Forman Schema field types
 */
export type FormanSchemaFieldType =
    | 'aiagent'
    | 'account'
    | 'hook'
    | 'device'
    | 'keychain'
    | 'datastore'
    | 'udt'
    | 'scenario'
    | 'array'
    | 'collection'
    | 'text'
    | 'number'
    | 'boolean'
    | 'checkbox'
    | 'date'
    | 'json'
    | 'buffer'
    | 'cert'
    | 'color'
    | 'email'
    | 'filename'
    | 'file'
    | 'filter'
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
    | `device:${string}`
    | 'banner'
    | 'markdown'
    | 'html'
    | 'separator'
    | string;

/**
 * Validation configuration for Forman Schema fields
 */
export interface FormanSchemaValidation {
    /** Pattern for string validation */
    pattern?: string | { regexp: string };
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
    /** Available options for fields which support them */
    options?:
        | (FormanSchemaOption | FormanSchemaOptionGroup)[]
        | FormanSchemaDirectoryOption[]
        | FormanSchemaPathExtendedOptions
        | FormanSchemaExtendedOptions
        | string;
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
    /** Whether the field is disabled (`false` by default) */
    disabled?: boolean;
    /** Whether the field is mappable */
    mappable?: boolean;
    /** Whether the user will be able to insert new lines in GUI (a textarea will be displayed instead of the text field) */
    multiline?: boolean;
    /** Whether the select field allows multiple values */
    multiple?: boolean;
    /** Specifies how to treat HTML tags in the field (text only) */
    tags?: 'strip' | 'stripall' | 'escape';
    /** Allowed extension or array of allowed extensions. (filename only) */
    extension?: string | string[];
    /** Semantic type for the field */
    semantic?: string;
    /** Whether to allow time selection (date only, `true` by default) */
    time?: boolean;
    /** Whether the properties of the object will be in the same order as they are defined in the spec (collection only) */
    sequence?: boolean;
    /** Codepage for the field (buffer only) */
    codepage?: string;
    /** Whether the field is grouped (select only) */
    grouped?: boolean;
    /** Whether a mapped value in the select should be validated against the option values. If true, the value is treated as a dynamic and validation is disabled. The value is set to `true` automatically if select options are generated using RPC. */
    dynamic?: boolean;
    /** Mode for the field (select only) */
    mode?: 'edit' | 'choose';
    /** Sort order for the field (select only) */
    sort?: string;
    /** Adds an extra button to the field which opens an extra form. When the form is submitted, a specified RPC is called and the result is set as a new value of the parameter. */
    rpc?: FormanSchemaRPCButton;
    /** Definition of boolean logic to apply (filter only) */
    logic?: 'and' | 'or' | 'reverse';
} & Record<`x-${string}`, unknown>;

/**
 * RPC button allows for dynamic value retrieval from an external source
 */
export type FormanSchemaRPCButton = {
    /** RPC button label */
    label?: string;
    /** RPC button URL */
    url: string;
    /** RPC button parameters */
    parameters: FormanSchemaField[] | string;
};

/**
 * Valid Forman Schema values
 */
export type FormanSchemaValue = string | number | boolean | null;

/**
 * Extended options for file and folder path selector fields
 */
export type FormanSchemaPathExtendedOptions = {
    /** Store for the options */
    store: FormanSchemaDirectoryOption[] | string;
    /** Nested fields for every option */
    nested?: FormanSchemaNested;
    /** When set to true, all paths start with '/' */
    showRoot?: boolean;
    /** Used when the directory entries have labels available, and these are different from their actual IDs */
    ids?: boolean;
    /** When set to true, only the entries from the root level are shown, without their children */
    singleLevel?: boolean;
};

/**
 * Directory entry option for file and folder path selectors
 */
export type FormanSchemaDirectoryOption = {
    /** Option value */
    value: FormanSchemaValue;
    /** Option label */
    label?: string;
    /** Set to true when the entry is a file in combined select mode */
    file?: boolean;
};

/**
 * Option for a select field
 */
export type FormanSchemaOption = {
    /** Option value */
    value: FormanSchemaValue;
    /** Option label */
    label?: string;
    /** Whether the option is the default */
    default?: boolean;
    /** Nested fields for this option */
    nested?: FormanSchemaNested;
};

/**
 * Option group for a select field
 */
export type FormanSchemaOptionGroup = {
    /** Group label */
    label: string;
    /** Group options */
    options: FormanSchemaOption[];
};

/**
 * Helper type for store of select, where options can be either plain options, or groups
 */
export type FormanSchemaSelectOptionsStore = (FormanSchemaOption | FormanSchemaOptionGroup)[];

/**
 * Extended options for a select field
 */
export type FormanSchemaExtendedOptions = {
    /** Store for the options */
    store: FormanSchemaOption[] | FormanSchemaOptionGroup[] | string;
    /** Nested fields for every option */
    nested?: FormanSchemaNested;
    /** Name of the property as the label of an option */
    label?: string;
    /** Name of the property as the value of an option */
    value?: string;
    /** Label to display when no value is selected */
    placeholder?:
        | string
        | {
              label: string;
              nested?: FormanSchemaNested;
          };
};

/**
 * Nested fields
 */
export type FormanSchemaNested = (FormanSchemaField | string)[] | string | FormanSchemaExtendedNested;

/**
 * Extended nested fields
 */
export type FormanSchemaExtendedNested = {
    /** Store for the nested fields */
    store: (FormanSchemaField | string)[] | string;
    /** Domain for the nested fields */
    domain?: string;
};

/**
 * Validation result
 */
export type FormanValidationResult = {
    /** Whether the object is valid */
    valid: boolean;
    /** Errors */
    errors: {
        /** Field domain */
        domain: string;
        /** Field path */
        path: string;
        /** Error message */
        message: string;
    }[];
    /** States of fields grouped by domain */
    states?: Record<string, FormanSchemaFieldState>;
};

export type FormanSchemaFieldState = {
    mode?: 'chose' | 'edit';
    label?: string;
    path?: Array<string>;
    data?: Record<string, unknown>;
    nested?: Record<string, FormanSchemaFieldState>;
    items?: Record<string, FormanSchemaFieldState>[];
};

export type FormanValidationOptions = {
    /** Unknown fields are not allowed when strict is true */
    strict?: boolean;
    /** Whether to generate states for fields */
    states?: boolean;
    /** Remote resource resolver */
    resolveRemote?(path: string, data: Record<string, unknown>): Promise<unknown>;
};
