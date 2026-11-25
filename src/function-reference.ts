// Canonical positive int32 IDs; each alternative covers a digit of the API maximum, 2147483647 (AX-63).
const idPattern = [
    '[1-9][0-9]{0,8}',
    '1[0-9]{9}',
    '20[0-9]{8}',
    '21[0-3][0-9]{7}',
    '214[0-6][0-9]{6}',
    '2147[0-3][0-9]{5}',
    '21474[0-7][0-9]{4}',
    '214748[0-2][0-9]{3}',
    '2147483[0-5][0-9]{2}',
    '21474836[0-3][0-9]',
    '214748364[0-7]',
].join('|');

export const MAX_FUNCTION_REFERENCE_LENGTH = 'FN2_2147483647'.length;

export function functionReferencePattern(allowEmpty: boolean): string {
    return `^(?:FN2_(?:${idPattern}))${allowEmpty ? '?' : ''}(?![\\s\\S])`;
}

const referencePattern = new RegExp(functionReferencePattern(false));

export function isFunctionReference(value: unknown): value is string {
    return typeof value === 'string' && referencePattern.test(value);
}
