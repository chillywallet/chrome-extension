import {
    DEFAULT_LAUNCHER_ICON_KEY,
    Images,
    LAUNCHER_ICONS,
} from '../../../src/shared/utils/Images';

describe('Images', () => {
    it('exposes a flat object of image references', () => {
        expect(typeof Images).toBe('object');
        expect(Object.keys(Images).length).toBeGreaterThan(0);
    });

    it('every value is defined', () => {
        for (const [, value] of Object.entries(Images)) {
            expect(value).toBeDefined();
        }
    });
});

describe('LAUNCHER_ICONS', () => {
    it('is a non-empty array of icon entries', () => {
        expect(Array.isArray(LAUNCHER_ICONS)).toBe(true);
        expect(LAUNCHER_ICONS.length).toBeGreaterThan(0);
    });

    it('each entry has key, name, path', () => {
        for (const icon of LAUNCHER_ICONS) {
            expect(typeof icon.key).toBe('string');
            expect(typeof icon.name).toBe('string');
            expect(icon.path).toBeDefined();
        }
    });

    it('offers the Chilly finishes, original mark first', () => {
        expect(LAUNCHER_ICONS.map(i => i.name)).toEqual([
            'Classic',
            'Frost',
            'Aurora',
            'Midnight',
        ]);
    });

    it('has unique keys', () => {
        const keys = LAUNCHER_ICONS.map(i => i.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    /** AppIconHandler falls back to this key, so it has to resolve to a real entry. */
    it('contains the default icon', () => {
        const def = LAUNCHER_ICONS.find(i => i.key === DEFAULT_LAUNCHER_ICON_KEY);
        expect(def?.name).toBe('Classic');
    });
});
