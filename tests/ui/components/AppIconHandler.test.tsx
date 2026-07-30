import React from 'react';
import { render } from '@testing-library/react';

import { LAUNCHER_ICONS } from '../../../src/shared/utils/Images';
import { usePreferences } from '../../../src/store/selectors';
import AppIconHandler from '../../../src/ui/components/AppIconHandler';

jest.mock('../../../src/store/selectors', () => ({
    usePreferences: jest.fn(),
}));

describe('AppIconHandler', () => {
    const setIconMock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(globalThis as { chrome?: { action: { setIcon: jest.Mock } } }, {
            chrome: {
                action: { setIcon: setIconMock },
            },
        });
        document.querySelectorAll('link').forEach(link => {
            const rel = link.getAttribute('rel') ?? '';
            if (/\bicon\b/i.test(rel)) link.remove();
        });
    });

    function mockPrefs(appIcon: string) {
        jest.mocked(usePreferences).mockReturnValue({
            appIcon,
        } as ReturnType<typeof usePreferences>);
    }

    it('does nothing when appIcon is empty', () => {
        mockPrefs('');
        render(<AppIconHandler />);
        expect(setIconMock).not.toHaveBeenCalled();
        expect(document.querySelectorAll('link')).toHaveLength(0);
    });

    it('falls back to the default icon when appIcon names a launcher icon that is gone', () => {
        // Icons chosen before the rebrand (e.g. 'molandak') no longer exist.
        const def = LAUNCHER_ICONS.find(i => i.key === 'default')!;
        mockPrefs('not-a-real-launcher-icon-key');
        render(<AppIconHandler />);
        expect(setIconMock).toHaveBeenCalledWith({ path: def.path });
    });

    it('calls chrome.action.setIcon and updates favicon when appIcon matches', () => {
        const aurora = LAUNCHER_ICONS.find(i => i.key === 'aurora')!;
        mockPrefs('aurora');
        render(<AppIconHandler />);
        expect(setIconMock).toHaveBeenCalledTimes(1);
        expect(setIconMock).toHaveBeenCalledWith({ path: aurora.path });
        const link = document.querySelector('link[rel="icon"]');
        expect(link).not.toBeNull();
        expect(link).toHaveAttribute('href', aurora.path);
    });

    it('reuses an existing favicon link instead of adding another', () => {
        const existing = document.createElement('link');
        existing.rel = 'icon';
        existing.href = 'data:,old';
        document.head.appendChild(existing);

        mockPrefs('default');
        render(<AppIconHandler />);

        expect(document.querySelectorAll('link')).toHaveLength(1);
        expect(document.querySelector('link[rel="icon"]')).toBe(existing);

        const def = LAUNCHER_ICONS.find(i => i.key === 'default')!;
        expect(existing.getAttribute('href')).toBe(def.path);
        expect(setIconMock).toHaveBeenCalledWith({ path: def.path });
    });

    it('updates icon when appIcon preference changes (remount)', () => {
        const def = LAUNCHER_ICONS.find(i => i.key === 'default')!;
        const midnight = LAUNCHER_ICONS.find(i => i.key === 'midnight')!;
        mockPrefs('default');
        // Props are always `{}`; React.memo would skip re-render on plain rerender — use key to remount.
        const { rerender } = render(<AppIconHandler key="default" />);
        expect(setIconMock).toHaveBeenLastCalledWith({ path: def.path });

        mockPrefs('midnight');
        rerender(<AppIconHandler key="midnight" />);
        expect(setIconMock).toHaveBeenLastCalledWith({ path: midnight.path });
        expect(setIconMock).toHaveBeenCalledTimes(2);
    });
});
