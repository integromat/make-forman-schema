import { describe, expect, it } from '@jest/globals';
import { validateForman } from '../src/index.js';

describe('Select option badges', () => {
    it('preserves a neutral badge in the selected option restore state', async () => {
        const badge = { label: 'Legacy', variant: 'neutral' as const };
        const option = { value: 'apiKey', label: 'API key', badge };
        const result = await validateForman({ auth: 'apiKey' }, [{ name: 'auth', type: 'select', options: [option] }], {
            states: true,
        });

        expect(result.valid).toBe(true);
        expect(result.states).toEqual({
            default: { auth: { label: 'API key', mode: 'chose', badge } },
        });
    });

    it('leaves the selected state unchanged when the option has no badge', async () => {
        const result = await validateForman(
            { auth: 'apiKeyConnection' },
            [{ name: 'auth', type: 'select', options: [{ value: 'apiKeyConnection', label: 'API key' }] }],
            { states: true },
        );

        expect(result.valid).toBe(true);
        expect(result.states).toEqual({ default: { auth: { label: 'API key', mode: 'chose' } } });
    });
});
