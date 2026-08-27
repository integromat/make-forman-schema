import type { JSONSchema7 } from 'json-schema';

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
    | 'filestorage'
    | 'folder'
    | 'hidden'
    | 'integer'
    | 'uinteger'
    | 'path'
    | 'pkey'
    | 'port'
    | 'list'
    | 'radio'
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
    /** JSON Schema for `json` typed fields */
    schema?: JSONSchema7;
    /** Hide field behind advanced toggle */
    advanced?: boolean;
    /** Human readable label for the field */
    label?: string;
    nested?: FormanSchemaNested | FormanSchemaBooleanNested;
    reversedNested?: boolean;
    /** Validation rules */
    validate?: FormanSchemaValidation;
    /** Whether the field is disabled (`false` by default) */
    disabled?: boolean;
    /** Whether the field is mappable */
    mappable?: boolean;
    /** Whether the field allows custom (typed-in) values even when dynamic values are not allowed in the domain */
    editable?: boolean;
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
    /** Definition of field operators, applicable on Filter fields. */
    operators?: FormanSchemaSelectOptionsStore;
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

export type FormanSchemaBooleanNested = {
    true?: (FormanSchemaField | string)[] | string;
    false?: (FormanSchemaField | string)[] | string;
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
    /** Warnings (do not affect validity) */
    warnings: {
        /** Field domain */
        domain: string;
        /** Field path */
        path: string;
        /** Warning message */
        message: string;
    }[];
    /** States of fields grouped by domain */
    states?: Record<string, FormanSchemaFieldState>;
    /** Resolved schema fields per domain. Requires `options.schemas`; only present when validation succeeded. */
    schemas?: Record<string, FormanSchemaField[]>;
    /**
     * Resolved schema fields per domain. Requires `options.schemas`, and unlike {@link schemas} is
     * present whether or not validation succeeded — including fields revealed by a remote-resolved
     * (`rpc://`) sub-form, which cannot be known from the static schema alone. Lets a caller report
     * which fields it rejected.
     */
    resolvedSchemas?: Record<string, FormanSchemaField[]>;
    /**
     * The input values with filled defaults applied, per domain. Always present on results
     * returned by `validateForman`/`validateFormanWithDomains` (see
     * {@link FormanNormalizedValidationResult}), whether or not validation succeeded, so a caller
     * can persist or repair the filled configuration alongside any remaining errors — and its
     * usage does not change with `options.fillDefaults`: with no fills (or the option off) it
     * passes the input values through as-is. The input `values` are never mutated; subtrees no
     * default was written into are shared with the input.
     */
    normalizedValues?: Record<string, Record<string, unknown>>;
    /** The defaults that were filled (`options.fillDefaults`), in walk order within each domain.
     *  Always present on results returned by `validateForman`/`validateFormanWithDomains`; empty
     *  when nothing was filled. */
    appliedDefaults?: {
        /** Field domain */
        domain: string;
        /** Field path */
        path: string;
        /** The default that was filled in. Loosely typed on purpose: `default` is declared as
         *  `FormanSchemaValue`, but schemas are JSON at source and may carry object or array
         *  defaults at runtime, which are filled as (cloned) values too. */
        value: unknown;
    }[];
};

/**
 * A {@link FormanValidationResult} whose `normalizedValues` and `appliedDefaults` are guaranteed
 * present — the type returned by `validateForman` and `validateFormanWithDomains`. The fields stay
 * optional on the base type because intermediate results assembled during the walk do not carry
 * them.
 */
export type FormanNormalizedValidationResult = FormanValidationResult &
    Required<Pick<FormanValidationResult, 'normalizedValues' | 'appliedDefaults'>>;

export type FormanSchemaFieldState = {
    mode?: 'chose' | 'edit';
    label?: string;
    path?: Array<string>;
    data?: Record<string, unknown>;
    extra?: Record<string, unknown>;
    /**
     * Child field states (record, built from field paths) or, on `chose` states of
     * select-like fields, the chosen option's nested field specification — the UI
     * persists that spec in `metadata.restore` to render the dependent fields.
     */
    nested?: Record<string, FormanSchemaFieldState> | FormanSchemaNested;
    items?: Record<string, FormanSchemaFieldState>[];
};

/**
 * Options for converting a Forman Schema to JSON Schema
 */
export type FormanJsonSchemaOptions = {
    /**
     * Exclude fields marked `advanced: true` from the rendered schema. Defaults to `false`
     * (advanced fields are included and stamped with `x-advanced: true`). When `true`,
     * advanced fields are omitted; their dot-notation paths are reported on
     * `toJSONSchemaAdvanced`'s `skippedPaths.advanced` so the caller can re-request them.
     */
    excludeAdvancedFields?: boolean;
    /**
     * Throw a `SchemaConversionError` when a field's type cannot be resolved, instead of degrading
     * it to a permissive typeless schema. Defaults to `false` — by default, unresolvable fields are
     * degraded and their dot-notation paths reported on `toJSONSchemaAdvanced`'s
     * `skippedPaths.unconvertible`, so one unrecognized field can no longer abort the whole
     * conversion. Set `true` only when a caller genuinely wants fail-fast behaviour.
     */
    strictFieldTypes?: boolean;
};

/**
 * Result of converting a Forman Schema to JSON Schema
 */
export type FormanJsonSchemaResult = {
    /** The converted JSON Schema */
    schema: JSONSchema7;
    /** Paths to fields that were skipped during conversion. Present only when at least one field was skipped. */
    skippedPaths?: {
        /** Dot-notation paths of advanced fields that were skipped. Present only when at least one advanced field was skipped. */
        advanced?: string[];
        /**
         * Dot-notation paths of fields whose type could not be resolved and were therefore degraded
         * to a permissive typeless schema. Each entry is suffixed with the reason —
         * `(unknown type: X)` or `(missing type)`. Present only when at least one field was degraded.
         */
        unconvertible?: string[];
    };
};

/**
 * Verdict fragment returned by an external validation callback (e.g. `validateJson`) that the
 * library cannot perform itself. Spliced into the overall validation result: `errors`/`warnings`
 * are stamped with the field's domain and path.
 */
export type FormanExternalValidationResult = {
    /** Whether the value is valid. A `false` verdict always fails validation, even with no messages. */
    valid: boolean;
    /** Error messages (cause validation to fail) */
    errors?: string[];
    /** Warning messages (do not affect validity) */
    warnings?: string[];
};

export type FormanValidationOptions = {
    /** Unknown fields are not allowed when strict is true */
    strict?: boolean;
    /** Whether to generate states for fields */
    states?: boolean;
    /** Whether to collect resolved schema fields per domain */
    schemas?: boolean;
    /** Remote resource resolver */
    resolveRemote?(path: string, data: Record<string, unknown>): Promise<unknown>;
    /** Validator for `json` typed fields. Receives the field's JSON Schema and the value, and
     *  returns (or resolves to) a result fragment that is spliced into the overall validation
     *  result. When omitted, `json` fields with a `schema` pass without schema validation. */
    validateJson?(
        schema: JSONSchema7,
        value: unknown,
    ): FormanExternalValidationResult | Promise<FormanExternalValidationResult>;
    /** Fill declared defaults for fields the caller omitted, mirroring BlueprintValidator's
     *  `useDefaults` modes. `'requiredOnly'` fills only required fields (instead of failing them
     *  as mandatory); `'always'` also fills omitted optional fields. A field is fillable when its
     *  value is `undefined` or `''` and its schema declares a default that is not `null` or `''`
     *  (a default that could not satisfy a required check) — the same fillable predicate as
     *  BlueprintValidator and the builder UI. The filled value flows through the rest of the
     *  walk, so a filled boolean arms its own nested branch and defaults nested under it fill
     *  recursively, in the same single pass. Fills are reported on `normalizedValues` and
     *  `appliedDefaults`. Real values the caller provided are never overwritten, an explicit
     *  `null` still fails as mandatory, and inactive branches are never filled. */
    fillDefaults?: 'requiredOnly' | 'always';
    /** Maps domain names used in nested.domain to actual domain keys passed to validateFormanWithDomains */
    domainAliases?: Record<string, string>;
    /** Whether to allow dynamic values (IML expressions, unresolved RPC options).
     *  When false (default), IML expressions cause errors and unresolved RPC options are treated as errors.
     *  Applies as a global default; can be overridden per-domain in validateFormanWithDomains(). */
    allowDynamicValues?: boolean;
};
