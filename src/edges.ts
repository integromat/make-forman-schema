import type {
    FormanFieldEdge,
    FormanSchemaBooleanNested,
    FormanSchemaExtendedNested,
    FormanSchemaExtendedOptions,
    FormanSchemaField,
    FormanSchemaNested,
    FormanSchemaOption,
    FormanSchemaSelectOptionsStore,
    FormanSchemaValue,
} from './types';
import { resolveFormanFieldType } from './forman';
import { isBooleanBranchNested, isObject, isOptionGroup, valuesMatch } from './utils';

function isBooleanField(field: FormanSchemaField): boolean {
    const type = resolveFormanFieldType(field.type);
    return type === 'boolean' || type === 'checkbox';
}

/** The nested definition the validator reads: the field's own `nested`, else `options.nested`. */
function fieldNested(
    field: FormanSchemaField,
): FormanSchemaNested | FormanSchemaExtendedNested | FormanSchemaBooleanNested | undefined {
    if (field.nested != null) return field.nested;
    return isObject<FormanSchemaExtendedOptions>(field.options) ? field.options.nested : undefined;
}

function optionValue(field: FormanSchemaField, option: FormanSchemaOption): FormanSchemaValue {
    const key =
        isObject<FormanSchemaExtendedOptions>(field.options) && field.options.value ? field.options.value : 'value';
    return (option as Record<string, FormanSchemaValue>)[key] as FormanSchemaValue;
}

/** One `nested` definition as edge parts; `undefined` when absent or in the boolean `{ true, false }` form, which the caller splits per branch. */
function nestedEdge(
    nested: FormanSchemaNested | FormanSchemaBooleanNested | undefined,
): Pick<FormanFieldEdge, 'children' | 'remote' | 'domain'> | undefined {
    if (nested == null || isBooleanBranchNested(nested)) return undefined;

    const store = isObject<FormanSchemaExtendedNested>(nested) ? nested.store : nested;
    const domain = isObject<FormanSchemaExtendedNested>(nested) ? nested.domain : undefined;
    const edge = typeof store === 'string' ? { remote: store } : Array.isArray(store) ? { children: store } : undefined;

    return edge && domain ? { ...edge, domain } : edge;
}

/**
 * Every way `field` can reveal child fields, as {@link FormanFieldEdge}s in declaration order: per-option
 * `nested`, `options.placeholder.nested` (gated on `''`, non-required selects only), then the field's own
 * `nested` or, failing that, `options.nested` (gated on the toggle value for booleans). Structural, so an
 * unconditional edge is listed alongside conditional ones; {@link activeFieldEdges} decides which a value
 * reveals. A nameless field cannot gate, so its option children are listed unconditionally.
 */
export function fieldEdges(field: FormanSchemaField): FormanFieldEdge[] {
    const edges: FormanFieldEdge[] = [];
    const gateOn = (value: FormanSchemaValue): Pick<FormanFieldEdge, 'gate'> =>
        field.name ? { gate: { name: field.name, value } } : {};

    const options = field.options;
    const store = isObject<FormanSchemaExtendedOptions>(options) ? options.store : options;
    if (Array.isArray(store)) {
        for (const entry of store as FormanSchemaSelectOptionsStore) {
            for (const option of isOptionGroup(entry) ? entry.options : [entry]) {
                const edge = nestedEdge(option.nested);
                if (edge) edges.push({ ...gateOn(optionValue(field, option)), ...edge });
            }
        }
    }

    if (field.type === 'select' && !field.required && isObject<FormanSchemaExtendedOptions>(options)) {
        const placeholder = options.placeholder;
        const placeholderEdge = isObject<{ nested?: FormanSchemaNested }>(placeholder)
            ? nestedEdge(placeholder.nested)
            : undefined;
        if (placeholderEdge) edges.push({ ...gateOn(''), ...placeholderEdge });
    }

    const nested = fieldNested(field);
    if (nested == null) return edges;

    if (isBooleanBranchNested(nested)) {
        for (const branch of [true, false] as const) {
            const edge = nestedEdge(nested[`${branch}`]);
            if (edge) edges.push({ ...gateOn(branch), ...edge });
        }
        return edges;
    }

    const ownEdge = nestedEdge(nested);
    if (!ownEdge) return edges;

    if (isBooleanField(field)) {
        edges.push({ ...gateOn(field.reversedNested !== true), ...ownEdge });
    } else {
        edges.push(ownEdge);
    }

    return edges;
}

/**
 * The edges `value` reveals, by the validator's rules: a matching gated edge replaces the unconditional
 * ones, an out-of-options value (custom, IML) falls back to them, and an empty value reveals only the
 * placeholder edge. A boolean holding a non-boolean value (IML) reveals its single-branch nested
 * regardless of the toggle, and nothing of the two-branch form.
 */
export function activeFieldEdges(field: FormanSchemaField, value: unknown): FormanFieldEdge[] {
    const edges = fieldEdges(field);

    if (value == null || value === '') return edges.filter(edge => edge.gate?.value === '');

    const gated = edges.filter(edge => edge.gate && valuesMatch(edge.gate.value, value));
    if (gated.length > 0) return gated;

    if (isBooleanField(field) && typeof value !== 'boolean') {
        return isBooleanBranchNested(fieldNested(field)) ? [] : edges.filter(edge => edge.gate);
    }

    return edges.filter(edge => !edge.gate);
}
