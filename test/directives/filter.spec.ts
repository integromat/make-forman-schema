import { describe, expect, it } from '@jest/globals';
import { type FormanSchemaField, toJSONSchema, validateForman } from '../../src/index.js';
import type { JSONSchema7 } from 'json-schema';

describe('Filter Type with Configurable Options and Operators', () => {
    describe('JSON Schema Conversion - Operand Options', () => {
        it('should convert plain filter with default operand types and operators', () => {
            const formanSchema: FormanSchemaField = {
                name: 'plainFilter',
                type: 'filter',
                label: 'Plain Filter',
            };
            const jsonSchema = toJSONSchema(formanSchema);

            expect(jsonSchema.type).toBe('array');
            expect('x-filter' in jsonSchema && jsonSchema['x-filter']).toBe('default');

            // Check nested structure: array -> array -> oneOf
            const innerArray = jsonSchema.items as JSONSchema7;
            expect(innerArray.type).toBe('array');

            const filterDefinition = innerArray.items as JSONSchema7;
            expect(filterDefinition.oneOf).toBeDefined();
            expect(filterDefinition.oneOf?.length).toBe(2); // binary + unary

            // Check binary definition (first in oneOf)
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            expect(binaryDef.type).toBe('object');
            expect(binaryDef.required).toEqual(['a', 'b', 'o']);

            // Operand A should have default types
            const operandA = binaryDef.properties!.a as JSONSchema7;
            expect(operandA.type).toEqual(['null', 'boolean', 'number', 'string']);

            // Operator should have binary operators
            const operator = binaryDef.properties!.o as JSONSchema7;
            expect(operator.enum).toBeDefined();
            expect(operator.enum?.length).toBe(56); // All binary operators

            // Check unary definition (second in oneOf)
            const unaryDef = filterDefinition.oneOf![1] as JSONSchema7;
            expect(unaryDef.type).toBe('object');
            expect(unaryDef.required).toEqual(['a', 'o']);

            const unaryOperator = unaryDef.properties!.o as JSONSchema7;
            expect(unaryOperator.enum).toEqual(['exist', 'notexist']);
        });

        it('should convert filter with static operand options', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterWithOptions',
                type: 'filter',
                options: [
                    { label: 'X', value: 'x' },
                    { label: 'Y', value: 'y' },
                ],
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            const operandA = binaryDef.properties!.a as JSONSchema7;

            expect(operandA.type).toBe('string');
            expect(operandA.oneOf).toBeDefined();
            expect(operandA.oneOf?.length).toBe(2);
            expect(operandA.oneOf).toEqual([
                { title: 'X', const: 'x' },
                { title: 'Y', const: 'y' },
            ]);

            // Should still have both binary and unary definitions
            expect(filterDefinition.oneOf?.length).toBe(2);
        });

        it('should convert filter with remote operand options (RPC string)', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterWithRemoteOptions',
                type: 'filter',
                options: {
                    store: 'rpc://dropdownExplorer',
                },
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            const operandA = binaryDef.properties!.a as JSONSchema7;

            expect(operandA.type).toBe('string');
            expect('x-fetch' in operandA && operandA['x-fetch']).toBe('rpc://dropdownExplorer');
            expect(operandA.oneOf).toBeUndefined();
        });

        it('should convert filter with grouped operand options', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterWithGroupedOptions',
                type: 'filter',
                options: [
                    { label: 'Top Level', value: 'topLevel' },
                    {
                        label: 'GROUP',
                        options: [
                            { label: 'A', value: 'a' },
                            { label: 'B', value: 'b' },
                        ],
                    },
                ],
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            const operandA = binaryDef.properties!.a as JSONSchema7;

            expect(operandA.oneOf).toEqual([
                { title: 'Top Level', const: 'topLevel' },
                { title: 'GROUP: A', const: 'a' },
                { title: 'GROUP: B', const: 'b' },
            ]);
        });
    });

    describe('JSON Schema Conversion - Custom Operators', () => {
        it('should convert filter with custom flat operators', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterWithCustomOperators',
                type: 'filter',
                options: {
                    store: [
                        { label: 'X', value: 'x' },
                        { label: 'Y', value: 'y' },
                    ],
                    operators: [{ label: 'TOP LEVEL', value: 'topLevel' }],
                },
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;

            // Critical: Only ONE definition when custom operators are provided (no unary fallback)
            expect(filterDefinition.oneOf?.length).toBe(1);

            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            expect(binaryDef.required).toEqual(['a', 'b', 'o']);

            const operator = binaryDef.properties!.o as JSONSchema7;
            expect(operator.type).toBe('string');
            expect(operator.oneOf).toEqual([{ title: 'TOP LEVEL', const: 'topLevel' }]);
        });

        it('should convert filter with grouped custom operators', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterWithGroupedOperators',
                type: 'filter',
                options: {
                    store: 'rpc://dropdownExplorer',
                    operators: [
                        { label: 'TOP LEVEL', value: 'topLevel' },
                        {
                            label: 'NESTED',
                            options: [
                                { label: 'A', value: 'a' },
                                { label: 'B', value: 'b' },
                            ],
                        },
                    ],
                },
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            const operator = binaryDef.properties!.o as JSONSchema7;

            // Flattened operators with group labels prepended
            expect(operator.oneOf).toEqual([
                { title: 'TOP LEVEL', const: 'topLevel' },
                { title: 'NESTED: A', const: 'a' },
                { title: 'NESTED: B', const: 'b' },
            ]);
        });

        it('should convert filter with both custom options and operators', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterWithBoth',
                type: 'filter',
                options: {
                    store: [
                        { label: 'X', value: 'x' },
                        { label: 'Y', value: 'y' },
                    ],
                    operators: [
                        { label: 'EQUALS', value: 'eq' },
                        { label: 'NOT EQUALS', value: 'neq' },
                    ],
                },
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;

            // Check custom operand options
            const operandA = binaryDef.properties!.a as JSONSchema7;
            expect(operandA.oneOf).toEqual([
                { title: 'X', const: 'x' },
                { title: 'Y', const: 'y' },
            ]);

            // Check custom operators
            const operator = binaryDef.properties!.o as JSONSchema7;
            expect(operator.oneOf).toEqual([
                { title: 'EQUALS', const: 'eq' },
                { title: 'NOT EQUALS', const: 'neq' },
            ]);

            // No unary definition
            expect(filterDefinition.oneOf?.length).toBe(1);
        });
    });

    describe('Validation', () => {
        it('should validate plain filter with default operators', async () => {
            const formanSchema: FormanSchemaField = {
                name: 'plainFilter',
                type: 'filter',
            };

            const value = {
                plainFilter: [[{ a: 'test', o: 'text:equal', b: 'value' }]],
            };

            const result = await validateForman(value, [formanSchema]);
            expect(result).toEqual({ valid: true, errors: [] });
        });

        it('should validate filter with unary operator', async () => {
            const formanSchema: FormanSchemaField = {
                name: 'plainFilter',
                type: 'filter',
            };

            const value = {
                plainFilter: [[{ a: 'test', o: 'exist' }]],
            };

            const result = await validateForman(value, [formanSchema]);
            expect(result).toEqual({ valid: true, errors: [] });
        });

        it('should validate filter with multiple conditions', async () => {
            const formanSchema: FormanSchemaField = {
                name: 'plainFilter',
                type: 'filter',
            };

            const value = {
                plainFilter: [
                    [
                        { a: 'field1', o: 'text:equal', b: 'value1' },
                        { a: 'field2', o: 'number:greater', b: 10 },
                    ],
                ],
            };

            const result = await validateForman(value, [formanSchema]);
            expect(result).toEqual({ valid: true, errors: [] });
        });
    });

    describe('Edge Cases', () => {
        it('should handle options without label property', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterNoLabels',
                type: 'filter',
                options: [{ value: 'x' }, { value: 'y' }],
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            const operandA = binaryDef.properties!.a as JSONSchema7;

            // Should use value as title
            expect(operandA.oneOf).toEqual([
                { title: 'x', const: 'x' },
                { title: 'y', const: 'y' },
            ]);
        });

        it('should handle empty options array', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterEmptyOptions',
                type: 'filter',
                options: [],
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            const operandA = binaryDef.properties!.a as JSONSchema7;

            // Should be empty array
            expect(operandA.oneOf).toEqual([]);
        });

        it('should handle operators without label property', () => {
            const formanSchema: FormanSchemaField = {
                name: 'filterNoOperatorLabels',
                type: 'filter',
                options: {
                    store: [{ label: 'X', value: 'x' }],
                    operators: [{ value: 'op1' }, { value: 'op2' }],
                },
            };
            const jsonSchema = toJSONSchema(formanSchema);

            const innerArray = jsonSchema.items as JSONSchema7;
            const filterDefinition = innerArray.items as JSONSchema7;
            const binaryDef = filterDefinition.oneOf![0] as JSONSchema7;
            const operator = binaryDef.properties!.o as JSONSchema7;

            // Should use value as title
            expect(operator.oneOf).toEqual([
                { title: 'op1', const: 'op1' },
                { title: 'op2', const: 'op2' },
            ]);
        });
    });
});
