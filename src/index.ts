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
 * Converts a Forman Schema field to its JSON Schema equivalent.
 *
 * Advanced fields (those with `advanced: true`) are skipped by default; their paths are
 * collected in `skippedPaths.advanced`. Pass `{ includeAdvancedFields: true }` to include
 * them — included advanced fields are stamped with `x-advanced: true` on the JSON Schema.
 *
 * @param field The Forman Schema field to convert
 * @param options Conversion options
 * @returns The conversion result, including the JSON Schema and any skipped field paths
 */
export function toJSONSchema(field: FormanSchemaField, options?: FormanJsonSchemaOptions): FormanJsonSchemaResult {
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
