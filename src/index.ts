import type { JSONSchema7 } from 'json-schema';
import { toJSONSchemaInternal } from './forman';
import type { FormanSchemaField } from './types';

export { toFormanSchema } from './json';
export type {
    FormanSchemaFieldType,
    FormanSchemaField,
    FormanSchemaValue,
    FormanSchemaOption,
    FormanSchemaNested,
    FormanSchemaExtendedOptions,
    FormanSchemaExtendedNested,
} from './types';

/**
 * Converts a Forman Schema field to its JSON Schema equivalent.
 * @param field The Forman Schema field to convert
 * @returns The equivalent JSON Schema field
 */
export function toJSONSchema(field: FormanSchemaField): JSONSchema7 {
    return toJSONSchemaInternal(field);
}
