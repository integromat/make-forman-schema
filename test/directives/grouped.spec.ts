import { describe, expect, it } from '@jest/globals';
import { toJSONSchema } from '../../src';

describe('Grouped', () => {
    it('should correctly convert various select groupings', () => {
        const formanSchema = {
            type: 'collection',
            spec: [
                {
                    name: 'select',
                    type: 'select',
                    label: 'Normal Select',
                    options: [
                        { label: 'Alpha', value: 'alpha' },
                        { label: 'Bravo', value: 'bravo' },
                    ],
                },
                {
                    name: 'groupedSelect',
                    type: 'select',
                    label: 'Grouped Select',
                    grouped: true,
                    options: [
                        {
                            label: 'Phonetic',
                            options: [
                                { label: 'Alpha', value: 'alpha' },
                                { label: 'Bravo', value: 'bravo' },
                            ],
                        },
                        {
                            label: 'Greek',
                            options: [
                                { label: 'Alpha', value: 'alpha' },
                                { label: 'Beta', value: 'beta' },
                            ],
                        },
                    ],
                },
                {
                    name: 'partiallyGroupedSelect',
                    type: 'select',
                    label: 'Partially Grouped Select',
                    grouped: true,
                    options: [
                        { label: 'Alpha', value: 'alpha' },
                        { label: 'Bravo', value: 'bravo' },
                        {
                            label: 'Greek',
                            options: [
                                {
                                    label: 'Alpha',
                                    value: 'alpha',
                                },
                                {
                                    label: 'Beta',
                                    value: 'beta',
                                },
                            ],
                        },
                    ],
                },
                {
                    name: 'wronglyPartiallyGroupedSelect',
                    type: 'select',
                    label: 'Wrongly Partially Grouped Select',
                    options: [
                        { label: 'Alpha', value: 'alpha' },
                        { label: 'Bravo', value: 'bravo' },
                        {
                            label: 'Greek',
                            options: [
                                {
                                    label: 'Alpha',
                                    value: 'alpha',
                                },
                                {
                                    label: 'Beta',
                                    value: 'beta',
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        const jsonSchema = toJSONSchema(formanSchema);
        expect(jsonSchema).toEqual({
            properties: {
                groupedSelect: {
                    oneOf: [
                        {
                            const: 'alpha',
                            title: 'Phonetic: Alpha',
                        },
                        {
                            const: 'bravo',
                            title: 'Phonetic: Bravo',
                        },
                        {
                            const: 'alpha',
                            title: 'Greek: Alpha',
                        },
                        {
                            const: 'beta',
                            title: 'Greek: Beta',
                        },
                    ],
                    title: 'Grouped Select',
                    type: 'string',
                },
                partiallyGroupedSelect: {
                    oneOf: [
                        {
                            const: 'alpha',
                            title: 'Alpha',
                        },
                        {
                            const: 'bravo',
                            title: 'Bravo',
                        },
                        {
                            const: 'alpha',
                            title: 'Greek: Alpha',
                        },
                        {
                            const: 'beta',
                            title: 'Greek: Beta',
                        },
                    ],
                    title: 'Partially Grouped Select',
                    type: 'string',
                },
                select: {
                    oneOf: [
                        {
                            const: 'alpha',
                            title: 'Alpha',
                        },
                        {
                            const: 'bravo',
                            title: 'Bravo',
                        },
                    ],
                    title: 'Normal Select',
                    type: 'string',
                },
                wronglyPartiallyGroupedSelect: {
                    oneOf: [
                        {
                            const: 'alpha',
                            title: 'Alpha',
                        },
                        {
                            const: 'bravo',
                            title: 'Bravo',
                        },
                        {
                            const: 'alpha',
                            title: 'Greek: Alpha',
                        },
                        {
                            const: 'beta',
                            title: 'Greek: Beta',
                        },
                    ],
                    title: 'Wrongly Partially Grouped Select',
                    type: 'string',
                },
            },
            required: [],
            type: 'object',
        });
    });
});
