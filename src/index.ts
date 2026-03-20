import type { JSONSchema7 } from 'json-schema';
import { toJSONSchemaInternal, createDefaultContext } from './forman';
import type { FormanSchemaField, FormanValidationResult, FormanValidationOptions } from './types';
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
} from './types';
export { toFormanSchema } from './json';

/**
 * Converts a Forman Schema field to its JSON Schema equivalent.
 * @param field The Forman Schema field to convert
 * @returns The equivalent JSON Schema field
 */
export function toJSONSchema(field: FormanSchemaField): JSONSchema7 {
    const context = createDefaultContext();
    const result = toJSONSchemaInternal(field, context);

    if (Object.keys(context.definitions ?? {}).length > 0) {
        Object.defineProperty(result, 'definitions', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: context.definitions,
        });
    }

    return result;
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
