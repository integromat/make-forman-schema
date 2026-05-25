import { describe, expect, it } from '@jest/globals';
import { toJSONSchema } from '../src';

describe('Redefine', () => {
    // This is nasty, but apparently some app configs have it like that...
    it('should survive redefinition of properties', () => {
        const field = {
            type: 'collection',
            spec: [
                {
                    name: 'name',
                    type: 'text',
                    label: 'Name',
                },
                {
                    name: 'age',
                    type: 'uinteger',
                    label: 'Age',
                },
                {
                    name: 'name',
                    type: 'text',
                    label: 'Full Name',
                },
            ],
        };
        const schema = toJSONSchema(field);
        expect(schema).toStrictEqual({
            description: undefined,
            properties: {
                age: {
                    description: undefined,
                    title: 'Age',
                    type: 'number',
                },
                name: {
                    description: undefined,
                    title: 'Name',
                    type: 'string',
                },
            },
            required: [],
            title: undefined,
            type: 'object',
        });
    });
});
