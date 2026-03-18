import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { validateForman, validateFormanWithDomains } from '../src/index.js';

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
        warnings: [],
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
        warnings: [],
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
                        restoreExtras: {
                            sheetId: {
                                aiHelp: 'This is some extra help.',
                                aiInstruction: 'This is some extra instruction.',
                            },
                            spreadsheetId: {
                                aiHelp: 'This is some extra help for spreadsheet.',
                                aiInstruction: 'This is some extra instruction for spreadsheet.',
                            },
                        },
                    },
                },
                {
                    states: true,
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
                                    spreadsheetId: '/',
                                });
                                return [
                                    { label: 'SPREADSHEET1', value: 'spreadsheet-1', file: true },
                                    { label: 'SPREADSHEET2', value: 'spreadsheet-2', file: true },
                                ];
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
            warnings: [],
            states: {
                default: {
                    __IMTCONN__: {
                        label: 'Google Connection 1',
                        mode: undefined,
                    },
                },
                expect: {
                    from: {
                        label: 'My Drive',
                        mode: 'chose',
                    },
                    includesHeaders: {
                        label: 'Yes',
                        mode: 'chose',
                    },
                    insertDataOption: {
                        label: 'Insert rows',
                        mode: 'chose',
                    },
                    mode: {
                        label: 'Search by path',
                        mode: 'chose',
                    },
                    valueInputOption: {
                        label: 'User entered',
                        mode: 'chose',
                    },
                    spreadsheetId: {
                        mode: 'chose',
                        path: ['SPREADSHEET1'],
                        extra: {
                            aiHelp: 'This is some extra help for spreadsheet.',
                            aiInstruction: 'This is some extra instruction for spreadsheet.',
                        },
                    },
                    sheetId: {
                        extra: {
                            aiHelp: 'This is some extra help.',
                            aiInstruction: 'This is some extra instruction.',
                        },
                    },
                },
            },
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
        warnings: [],
        });
    });

    it('should validate ai-tools manifest', async () => {
        const aiToolsAnalyzeSentimentMock = JSON.parse(
            readFileSync('./test/mocks/ai-tools-analyze-sentiment.json').toString(),
        );

        expect(
            await validateFormanWithDomains(
                {
                    default: {
                        values: {
                            model: 'o4-mini',
                            makeConnectionId: 1,
                        },
                        schema: aiToolsAnalyzeSentimentMock.parameters,
                    },
                    expect: {
                        values: {
                            input: 'asdf',
                            shouldGenerateDescription: false,
                        },
                        schema: aiToolsAnalyzeSentimentMock.expect,
                    },
                },
                {
                    async resolveRemote(path: string, data: Record<string, unknown>) {
                        switch (path) {
                            case 'api://connections/ai-provider':
                                expect(data).toEqual({});
                                return [{ value: 1, label: 'Connection 1' }];
                            case 'rpc://RpcGetConnections?teamId={{teamId}}':
                                expect(data).toEqual({});
                                return [
                                    {
                                        name: 'makeConnectionId',
                                        type: 'account:ai-provider',
                                        label: 'Connection',
                                        required: true,
                                        nested: [
                                            {
                                                name: 'model',
                                                type: 'select',
                                                label: 'Model',
                                                required: true,
                                                mappable: true,
                                                options: {
                                                    store: 'rpc://RpcGetModels?connectionId={{makeConnectionId}}&teamId=1',
                                                },
                                            },
                                        ],
                                    },
                                ];
                            case 'rpc://RpcGetModels?connectionId={{makeConnectionId}}&teamId=1':
                                expect(data).toEqual({
                                    makeConnectionId: 1,
                                });
                                return [
                                    {
                                        value: 'o4-mini',
                                        label: 'o4-mini',
                                    },
                                ];
                        }
                        throw new Error(`Unknown remote resource: ${path}`);
                    },
                },
            ),
        ).toEqual({
            valid: true,
            errors: [],
        warnings: [],
        });
    });

    it('should add restore extras to nested fields', async () => {
        const formanSchema = [
            {
                name: 'topLevel',
                label: 'Top Level',
                type: 'select',
                options: [
                    {
                        label: 'A',
                        value: 'a',
                    },
                    {
                        label: 'B',
                        value: 'b',
                    },
                ],
                nested: [
                    {
                        name: 'middleLevel',
                        label: 'Middle Level',
                        type: 'collection',
                        spec: [
                            {
                                name: 'innerProperty',
                                label: 'Inner Property',
                                type: 'boolean',
                                nested: [
                                    {
                                        type: 'array',
                                        label: 'Array',
                                        name: 'array',
                                        spec: [
                                            {
                                                name: 'name',
                                                type: 'text',
                                                label: 'Name',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ];
        const result = await validateForman(
            {
                topLevel: 'a',
                middleLevel: {
                    innerProperty: true,
                    array: [
                        {
                            name: 'Alpha',
                        },
                        {
                            name: 'Bravo',
                        },
                    ],
                },
            },
            formanSchema,
            {
                states: true,
            },
            {
                'middleLevel.array[1].name': {
                    aiHelp: 'This is some extra help for Bravo.',
                    aiInstruction: 'This is some extra instruction for Bravo.',
                },
            },
        );
        expect(result).toEqual({
            valid: true,
            errors: [],
            warnings: [],
            states: {
                default: {
                    topLevel: {
                        label: 'A',
                        mode: 'chose',
                    },
                    middleLevel: {
                        nested: {
                            array: {
                                items: [
                                    undefined,
                                    {
                                        name: {
                                            extra: {
                                                aiHelp: 'This is some extra help for Bravo.',
                                                aiInstruction: 'This is some extra instruction for Bravo.',
                                            },
                                        },
                                    },
                                ],
                                mode: 'chose',
                            },
                        },
                    },
                },
            },
        });
    });
});
