import type { JSONSchema7 } from 'json-schema';
import { toJSONSchemaInternal, createDefaultContext } from './forman';
import type {
    FormanSchemaField,
    FormanValidationResult,
    FormanValidationOptions,
    FormanJsonSchemaOptions,
    FormanJsonSchemaResult,
} from './types';
import { validateFormanWithDomainsInternal } from './validator';

export type {
    FormanSchemaFieldType,
    FormanSchemaField,
    FormanSchemaValue,
    FormanSchemaOption,
    FormanSchemaDirectoryOption,
    FormanSchemaNested,
    FormanSchemaExtendedOptions,
    FormanSchemaPathExtendedOptions,
    FormanSchemaExtendedNested,
    FormanSchemaOptionGroup,
    FormanSchemaRPCButton,
    FormanValidationOptions,
    FormanValidationResult,
    FormanJsonSchemaOptions,
    FormanJsonSchemaResult,
} from './types';
export { toFormanSchema } from './json';

/**
 * Converts a Forman Schema field to its JSON Schema equivalent and reports the paths of any
 * fields that were skipped during conversion.
 *
 * **Advanced fields** (`advanced: true`) are included by default and stamped with
 * `x-advanced: true` on the JSON Schema (the marker round-trips through `toFormanSchema`).
 * Pass `{ excludeAdvancedFields: true }` to omit them — when excluded, the affected
 * dot-notation paths are reported on `skippedPaths.advanced`. The filter applies to sub-fields
 * of a collection (main form, nested-by-option, array-of-collection items, composite
 * expansions, cross-domain buffered fields). It does NOT apply to the top-level field passed
 * here, nor to the item type of an array whose `spec` is a single primitive field. Mark the
 * parent as `advanced: true` to hide such structures.
 *
 * Known limitation: composite types (`udtspec`, `udttype`) are memoized in
 * `definitions[type]`; advanced fields inside a composite template are recorded with the
 * path of the FIRST usage only. See the comment near `compositeHandlers` in `src/forman.ts`.
 *
 * If you don't need `skippedPaths`, use {@link toJSONSchema} which returns just the schema.
 *
 * @param field The Forman Schema field to convert
 * @param options Conversion options
 * @returns The conversion result `{ schema, skippedPaths? }`. `skippedPaths` is omitted when nothing was skipped.
 */
export function toJSONSchemaAdvanced(
    field: FormanSchemaField,
    options?: FormanJsonSchemaOptions,
): FormanJsonSchemaResult {
    const context = createDefaultContext(options);
    const schema = toJSONSchemaInternal(field, context);

    if (Object.keys(context.definitions ?? {}).length > 0) {
        Object.defineProperty(schema, 'definitions', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: context.definitions,
        });
    }

    const skippedPaths: NonNullable<FormanJsonSchemaResult['skippedPaths']> = {};
    if (context.skippedPaths.advanced?.length) {
        skippedPaths.advanced = context.skippedPaths.advanced;
    }

    return {
        schema,
        ...(Object.keys(skippedPaths).length > 0 ? { skippedPaths } : {}),
    };
}

/**
 * Converts a Forman Schema field to its JSON Schema equivalent.
 *
 * Advanced fields (`advanced: true`) are included by default and stamped with `x-advanced: true`.
 * Pass `{ excludeAdvancedFields: true }` to omit them. If you need to know *which* advanced
 * fields were dropped (e.g. to render a "show advanced" toggle), use {@link toJSONSchemaAdvanced}
 * which returns `{ schema, skippedPaths? }`.
 *
 * @param field The Forman Schema field to convert
 * @param options Conversion options
 * @returns The equivalent JSON Schema
 */
export function toJSONSchema(field: FormanSchemaField, options?: FormanJsonSchemaOptions): JSONSchema7 {
    return toJSONSchemaAdvanced(field, options).schema;
}

/**
 * Validates a Forman domains against schemas
 * @param domains The domains to validate
 * @param options The validation options
 * @returns The validation result
 */
export function validateFormanWithDomains(
    domains: Record<
        string,
        {
            values: Record<string, unknown>;
            schema: FormanSchemaField[];
            /** Extra values injected into restore states, keyed by string path (dot notation, `[index]`, backtick-escaping). */
            restoreExtras?: Record<string, Record<string, unknown>>;
            /** Whether the domain allows dynamic values (IML expressions, unresolved RPC select options).
             *  Defaults to false. When false, IML expressions cause errors and unresolved RPC options are treated as errors. */
            allowDynamicValues?: boolean;
        }
    >,
    options?: FormanValidationOptions,
): Promise<FormanValidationResult> {
    return validateFormanWithDomainsInternal(domains, options);
}

/**
 * Validates a simple Forman values against a schema
 * @param values The values to validate
 * @param schema The schema to validate against
 * @param options The validation options
 * @param restoreExtras Values to be injected into restore objects of particular fields.
 *   Keyed by string path using dot notation for nested keys, `[index]` for array indices,
 *   and backtick-escaping for keys containing dots (e.g. `"a.b[0].c"`, `` "`dotted.key`.child" ``).
 * @returns The validation result
 */
export function validateForman(
    values: Record<string, unknown>,
    schema: FormanSchemaField[],
    options?: FormanValidationOptions,
    restoreExtras?: Record<string, Record<string, unknown>>,
): Promise<FormanValidationResult> {
    return validateFormanWithDomains(
        { default: { values, schema, restoreExtras, allowDynamicValues: options?.allowDynamicValues } },
        options,
    );
}
