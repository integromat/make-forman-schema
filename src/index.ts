import type { JSONSchema7 } from 'json-schema';
import { toJSONSchemaInternal } from './forman';
import type { FormanSchemaField, FormanValidationResult, FormanValidationOptions } from './types';
import { validateFormanWithDomainsInternal } from './validator';

export { toFormanSchema } from './json';
export type {
    FormanSchemaFieldType,
    FormanSchemaField,
    FormanSchemaValue,
    FormanSchemaOption,
    FormanSchemaNested,
    FormanSchemaExtendedOptions,
    FormanSchemaExtendedNested,
    FormanSchemaOptionGroup,
    FormanSchemaRPCButton,
} from './types';

/**
 * Converts a Forman Schema field to its JSON Schema equivalent.
 * @param field The Forman Schema field to convert
 * @returns The equivalent JSON Schema field
 */
export function toJSONSchema(field: FormanSchemaField): JSONSchema7 {
    return toJSONSchemaInternal(field);
}

/**
 * Validates a Forman domains against schemas
 * @param domains The domains to validate
 * @param options The validation options
 * @returns The validation result
 */
export function validateFormanWithDomains(
    domains: Record<string, { values: Record<string, unknown>; schema: FormanSchemaField[] }>,
    options?: FormanValidationOptions,
): Promise<FormanValidationResult> {
    return validateFormanWithDomainsInternal(domains, options);
}

/**
 * Validates a simple Forman values against a schema
 * @param values The values to validate
 * @param schema The schema to validate against
 * @param options The validation options
 * @returns The validation result
 */
export function validateForman(
    values: Record<string, unknown>,
    schema: FormanSchemaField[],
    options?: FormanValidationOptions,
): Promise<FormanValidationResult> {
    return validateFormanWithDomains({ default: { values, schema } }, options);
}
