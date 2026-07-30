import { DEFAULT_EMOJI, getRandomAvatar, getRandomColor } from '../../../src/shared/utils/avatar';

describe('avatar utils', () => {
    it('exports default emoji', () => {
        expect(DEFAULT_EMOJI).toBe('🦊');
    });

    it('getRandomAvatar returns a non-empty string', () => {
        const result = getRandomAvatar('hello');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('getRandomAvatar is deterministic for the same input', () => {
        expect(getRandomAvatar('alice')).toBe(getRandomAvatar('alice'));
    });

    it('getRandomAvatar handles empty / falsy strings', () => {
        const result = getRandomAvatar('');
        expect(typeof result).toBe('string');
    });

    it('getRandomColor returns a 7-char hex string', () => {
        const color = getRandomColor('abc');
        expect(color.startsWith('#')).toBe(true);
        expect(color).toHaveLength(7);
    });

    it('getRandomColor is deterministic', () => {
        expect(getRandomColor('xyz')).toBe(getRandomColor('xyz'));
    });
});
