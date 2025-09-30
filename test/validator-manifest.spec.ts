import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { validateFormanWithDomains } from '../src/index.js';

describe('Forman Schema Manifest Validation', () => {
    it('should validate google-sheets manifest', async () => {
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
                    domain: 'default',
                    message: 'Field is mandatory.',
                    path: '__IMTCONN__',
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
                    domain: 'expect',
                    message: 'Field is mandatory.',
                    path: 'mode',
                },
                {
                    domain: 'expect',
                    message: 'Field is mandatory.',
                    path: 'insertUnformatted',
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
