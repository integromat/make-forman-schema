import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';

describe('Forman Schema', () => {
    it('Forman Validation #1', async () => {
        const formanValue = {
            array: [1, 2, 3],
            text: 'hello',
        };

        const formanSchema = [
            {
                name: 'array',
                type: 'array',
                spec: {
                    type: 'number',
                },
            },
            {
                name: 'text',
                type: 'text',
            },
        ];

        expect(await validateForman(formanValue, formanSchema)).toEqual({
            valid: true,
            errors: [],
        });
    });

    it('Forman Validation #2', async () => {
        const formanValue = {
            array: ['a', false],
            text: 15,
            unknown: true,
        };

        const formanSchema = [
            {
                name: 'array',
                type: 'array',
                spec: {
                    type: 'number',
                },
            },
            {
                name: 'text',
                type: 'text',
            },
        ];

        expect(await validateForman(formanValue, formanSchema, { strict: true })).toEqual({
            valid: false,
            errors: [
                {
                    path: 'default.array.0',
                    message: "Expected type 'number', got type 'string'.",
                },
                {
                    path: 'default.array.1',
                    message: "Expected type 'number', got type 'boolean'.",
                },
                {
                    path: 'default.text',
                    message: "Expected type 'string', got type 'number'.",
                },
                {
                    message: "Unknown field 'unknown'.",
                    path: 'default',
                },
            ],
        });
    });

    it('Forman Validation #3 (select)', async () => {
        const formanValue = {
            sheet_ok: 'sheet 1',
            row_ok: 1,
            sheet_error: 'sheet 3',
            sheet_multi_ok: ['sheet 10', 'sheet 11'],
            sheet_multi_error: ['sheet 15'],
        };

        const formanSchema = [
            {
                name: 'sheet_ok',
                type: 'select',
                options: [
                    {
                        value: 'sheet 1',
                        nested: [
                            {
                                name: 'row_ok',
                                type: 'number',
                                required: true,
                            },
                        ],
                    },
                    {
                        value: 'sheet 2',
                    },
                ],
            },
            {
                name: 'sheet_error',
                type: 'select',
                options: [
                    {
                        value: 'sheet 1',
                    },
                    {
                        value: 'sheet 2',
                    },
                ],
            },
            {
                name: 'sheet_multi_ok',
                type: 'select',
                multiple: true,
                options: [
                    {
                        value: 'sheet 10',
                    },
                    {
                        value: 'sheet 11',
                    },
                ],
            },
            {
                name: 'sheet_multi_error',
                type: 'select',
                multiple: true,
                options: [
                    {
                        value: 'sheet 1',
                    },
                ],
            },
        ];

        expect(await validateForman(formanValue, formanSchema)).toEqual({
            valid: false,
            errors: [
                {
                    message: "Value 'sheet 3' not found in options.",
                    path: 'default.sheet_error',
                },
                {
                    message: "Value 'sheet 15' not found in options.",
                    path: 'default.sheet_multi_error',
                },
            ],
        });
    });

    it('Forman Validation #4 (remote)', async () => {
        const formanValue = {
            sheet: 'sheet 1',
            column: 'A1',
        };

        const formanSchema = [
            {
                name: 'sheet',
                type: 'select',
                options: {
                    store: 'rpc://sheets',
                    nested: [
                        {
                            name: 'column',
                            type: 'select',
                            options: 'rpc://columns',
                        },
                    ],
                },
            },
        ];

        expect(
            await validateForman(formanValue, formanSchema, {
                async resolveRemote(path, data) {
                    switch (path) {
                        case 'rpc://sheets':
                            expect(data).toEqual({});
                            return [{ value: 'sheet 1' }, { value: 'sheet 2' }];
                        case 'rpc://columns':
                            expect(data).toEqual({
                                sheet: 'sheet 1',
                            });
                            return [{ value: 'A1' }, { value: 'B1' }];
                    }
                    throw new Error(`Unknown remote resource: ${path}`);
                },
            }),
        ).toEqual({
            valid: true,
            errors: [],
        });
    });

    it('Forman Validation #5 (error: domain not found)', async () => {
        const formanValue = {
            sheet: 'sheet 1',
        };

        const formanSchema = [
            {
                name: 'sheet',
                type: 'select',
                options: {
                    store: [{ value: 'sheet 1' }, { value: 'sheet 2' }],
                    nested: {
                        domain: 'expect',
                        store: [
                            {
                                name: 'column',
                                type: 'select',
                                options: [],
                            },
                        ],
                    },
                },
            },
        ];

        expect(await validateForman(formanValue, formanSchema)).toEqual({
            valid: false,
            errors: [
                {
                    message: "Unable to process nested fields: Domain 'expect' not found.",
                    path: 'default.sheet',
                },
            ],
        });
    });

    it('Forman Validation #6 (complex schema: google-sheets)', async () => {
        const googleSheetsAddRowMock = JSON.parse(readFileSync('./test/mocks/google-sheets-add-row.json').toString());

        expect(
            await validateFormanWithDomains({
                default: {
                    values: {},
                    schema: googleSheetsAddRowMock.parameters,
                },
                expect: {
                    values: {},
                    schema: googleSheetsAddRowMock.expect,
                },
            }),
        ).toEqual({
            valid: false,
            errors: [
                {
                    message: 'Field is mandatory.',
                    path: 'default.__IMTCONN__',
                },
            ],
        });

        expect(
            await validateFormanWithDomains(
                {
                    default: {
                        values: { __IMTCONN__: 1 },
                        schema: googleSheetsAddRowMock.parameters,
                    },
                    expect: {
                        values: {},
                        schema: googleSheetsAddRowMock.expect,
                    },
                },
                {
                    async resolveRemote(path: string, data: Record<string, unknown>) {
                        switch (path) {
                            case 'api://connections/google':
                                expect(data).toEqual({});
                                return [{ value: 1, label: 'Google Connection 1' }];
                        }
                        throw new Error(`Unknown remote resource: ${path}`);
                    },
                },
            ),
        ).toEqual({
            valid: false,
            errors: [
                {
                    message: 'Field is mandatory.',
                    path: 'expect.mode',
                },
                {
                    message: 'Field is mandatory.',
                    path: 'expect.insertUnformatted',
                },
                {
                    message: "Value 'undefined' not found in options.",
                    path: 'expect.valueInputOption',
                },
                {
                    message: "Value 'undefined' not found in options.",
                    path: 'expect.insertDataOption',
                },
            ],
        });

        // Nested fields in select type
        expect(
            await validateFormanWithDomains(
                {
                    default: {
                        values: {
                            __IMTCONN__: 1,
                        },
                        schema: googleSheetsAddRowMock.parameters,
                    },
                    expect: {
                        values: {
                            mode: 'select',
                            from: 'drive',
                            spreadsheetId: 'spreadsheet-1',
                            sheetId: 'sheet-1',
                            insertUnformatted: true,
                            valueInputOption: 'USER_ENTERED',
                            insertDataOption: 'INSERT_ROWS',
                            includesHeaders: true,
                        },
                        schema: googleSheetsAddRowMock.expect,
                    },
                },
                {
                    async resolveRemote(path: string, data: Record<string, unknown>) {
                        switch (path) {
                            case 'api://connections/google':
                                expect(data).toEqual({});
                                return [{ value: 1, label: 'Google Connection 1' }];
                            case 'rpc://google-sheets@2/listSpreadsheets':
                                expect(data).toEqual({
                                    __IMTCONN__: 1,
                                    mode: 'select',
                                    from: 'drive',
                                });
                                return [{ value: 'spreadsheet-1' }, { value: 'spreadsheet-2' }];
                            case 'rpc://google-sheets@2/rpcSheet':
                                expect(data).toEqual({
                                    __IMTCONN__: 1,
                                    mode: 'select',
                                    from: 'drive',
                                    spreadsheetId: 'spreadsheet-1',
                                });
                                return [{ value: 'sheet-1' }, { value: 'sheet-2' }];
                            case 'rpc://google-sheets@2/rpcSheetInput':
                                expect(data).toEqual({
                                    __IMTCONN__: 1,
                                    mode: 'select',
                                    from: 'drive',
                                    spreadsheetId: 'spreadsheet-1',
                                    sheetId: 'sheet-1',
                                    includesHeaders: true,
                                });
                                return [
                                    { name: 'A1', type: 'text' },
                                    { name: 'B1', type: 'text' },
                                ];
                        }
                        throw new Error(`Unknown remote resource: ${path}`);
                    },
                },
            ),
        ).toEqual({
            valid: true,
            errors: [],
        });

        // Nested fields in primitive type
        expect(
            await validateFormanWithDomains(
                {
                    default: {
                        values: {
                            __IMTCONN__: 2,
                        },
                        schema: googleSheetsAddRowMock.parameters,
                    },
                    expect: {
                        values: {
                            mode: 'fromAll',
                            spreadsheetId: 'spreadsheet-2',
                            sheetId: 'sheet-2',
                            insertUnformatted: true,
                            valueInputOption: 'USER_ENTERED',
                            insertDataOption: 'INSERT_ROWS',
                            includesHeaders: false,
                            tableFirstRow: 'A1:Z1',
                        },
                        schema: googleSheetsAddRowMock.expect,
                    },
                },
                {
                    strict: true,
                    async resolveRemote(path: string, data: Record<string, unknown>) {
                        switch (path) {
                            case 'api://connections/google':
                                expect(data).toEqual({});
                                return [{ value: 2, label: 'Google Connection 2' }];
                            case 'rpc://google-sheets@2/rpcSheet':
                                expect(data).toEqual({
                                    __IMTCONN__: 2,
                                    mode: 'fromAll',
                                    spreadsheetId: 'spreadsheet-2',
                                });
                                return [{ value: 'sheet-2' }];
                            case 'rpc://google-sheets@2/rpcSheetInput':
                                expect(data).toEqual({
                                    __IMTCONN__: 2,
                                    mode: 'fromAll',
                                    spreadsheetId: 'spreadsheet-2',
                                    sheetId: 'sheet-2',
                                    includesHeaders: false,
                                    tableFirstRow: 'A1:Z1',
                                });
                                return [
                                    { name: 'A1', type: 'text' },
                                    { name: 'B1', type: 'text' },
                                ];
                        }
                        throw new Error(`Unknown remote resource: ${path}`);
                    },
                },
            ),
        ).toEqual({
            valid: true,
            errors: [],
        });
    });
});
