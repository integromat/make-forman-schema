---
name: add-composite-type
description: Guidelines for adding a new Composite Type.
---

# Context

Composite Types in Forman are types which could be represented by a different structure, compound of multiple other, more primitive building blocks.
For example, when having a field of type `udtspec`,

```json
{
	"type": "udtspec",
	"name": "customType"
}
```

it's a wrapper around a more primitive structure, which looks like this:

```json
{
	"type": "array",
	"name": "customType",
	"spec": [
		{
			"name": "name",
			"label": "Name",
			"placeholder": "Enter name",
			"type": "text",
			"required": true
		},
		{
			"name": "label",
			"label": "Label",
			"help": "Display name for better readability.",
			"type": "text",
			"advanced": true
		},
		{
			"name": "help",
			"label": "Description",
			"type": "text",
			"multiline": true,
			"required": false,
			"placeholder": "Enter description"
		},
		{
			"name": "type",
			"label": "Type",
			"type": "udttype",
			"required": true,
			"default": "text"
		}
	]
}
```

# Workflow

- Composite Types are defined in `src/composites`
- Each composite needs to be supported in:
	- conversion from FormanSchema to JSON Schema
	- conversion from JSON Schema to FormanSchema
	- validation of FormanSchema
- you need to know the composite structure (= the compound structure of the more primitive fields), associated with the composite type -- ask the operator to provide this.
- based on the top-level type of the expanded structure (in case of `udtspec` it's `array`), add this to the type conversion map in both, `validator` and `forman` files
- then add the handling of this composite type in the type-level switches
- for that, you need to implement functions in the corresponding file in `src/composites/${compositeType}.ts`. Each composite must export four functions:
	- `${compositeType}Expand` — morphs the composite field into its expanded primitive structure. Accepts and mutates the field definition, setting `spec`, `type`, etc. Returns the mutated field.
	- `${compositeType}ExtractInner` — extracts the inner structural fragment from the fully converted JSON Schema to store in `$defs`. This fragment must NOT contain field-specific title/description. (e.g. for udtspec: returns `schema.items`; for udttype: returns schema minus title/description)
	- `${compositeType}WrapRef` — builds a per-usage wrapper that references the `$defs` fragment via `$ref` and carries field-specific title/description/default. (e.g. for udtspec: `{ type: 'array', title, description, items: { $ref } }`; for udttype: `{ allOf: [{ $ref }], title, description, default }` — uses `allOf` for draft-07 compliance where siblings of `$ref` are ignored)
	- `${compositeType}Collapse` — reverse conversion from JSON Schema to Forman (see below)
- then register the composite in the `compositeHandlers` config in `src/forman.ts`:
	```typescript
	const compositeHandlers = {
	    mytype: { expand: mytypeExpand, extractInner: mytypeExtractInner, wrapRef: mytypeWrapRef },
	};
	```
- in the high-level flow:
	- when converting Forman to JSON Schema, the `compositeHandlers` block in `toJSONSchemaInternal` handles all composites uniformly:
		- `x-composite` marker is set via `Object.defineProperty` on both the inner fragment in `$defs` and on every wrapper — this is important for backward conversion
	- **How `$ref`/`$defs` recursion prevention works:**
		- The `ConversionContext` has a `defs?: Record<string, JSONSchema7>` property for collecting definitions
		- `$defs` stores only the **inner structural fragment** (no title/description). Title/description stay on each usage's wrapper.
		- On **first encounter**: register placeholder in `context.defs[type]`, expand (with label/help stripped), convert, extract inner via `extractInner`, store in `$defs`, then return wrapper via `wrapRef`
		- On **subsequent encounters**: skip expansion, just return wrapper via `wrapRef` — each usage retains its own field-specific metadata
		- Only add to `defs` when the composite is actually used (lazy) — don't pre-populate `$defs` with unused definitions
		- The `toJSONSchema` wrapper in `index.ts` attaches collected `context.defs` as `$defs` on the root output, but only if non-empty
	- **Validation**: no recursion protection needed — validation walks the actual data values, which are always finite. Just expand the composite and validate recursively; termination is guaranteed by the data depth.
- when validating Forman schema, morph the field, and then continue the validation recursively, as the morphed field is now in the structure of more primitive types
- when converting JSON Schema to Forman, check if the field has `x-composite` property, and if it's equal to the composite type you're adding, then morph the field back to the composite structure and don't expand it further
	- for this conversion, implement the function `${compositeType}Collapse`, which will accept the expanded field definition, and will return the composite one, by basically doing the opposite of what `${compositeType}Expand` does
	- notice that this one accepts JSONSchema Field and returns FormanSchema field
- once done with these steps, make sure to cover the new composite type with tests, both for conversion and validation, following the structure of existing tests
	- create the tests in the `test/composites` folder
