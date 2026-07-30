import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LAUNCHER_ICONS } from '../../../src/shared/utils/Images';
import { setAppIcon } from '../../../src/store/actions/uiActions';
import Toast from '../../../src/ui/components/Toast';
import IconSelector from '../../../src/ui/pages/IconSelector';

const preferences = {
    appIcon: 'default' as string,
};

const mockDispatch = jest.fn();

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/selectors', () => ({
    usePreferences: () => preferences,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    setAppIcon: jest.fn(() => async () => {}),
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <header>{title}</header>,
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn() },
}));

describe('IconSelector page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        preferences.appIcon = 'default';

        mockDispatch.mockImplementation(async (action: unknown) =>
            typeof action === 'function' ? (action as (d: typeof mockDispatch) => unknown)(mockDispatch) : action,
        );
    });

    function setup() {
        return render(<IconSelector />);
    }

    /**
     * Image `alt` and the row label compose the button’s accessible name (e.g. "Aurora Aurora").
     */
    function launcherButton(iconName: string) {
        return screen.getByRole('button', { name: `${iconName} ${iconName}` });
    }

    it('renders the header title', () => {
        setup();

        expect(screen.getByRole('banner')).toHaveTextContent('Choose App Icon');
    });

    it('renders every launcher icon as a selectable button', () => {
        setup();

        for (const icon of LAUNCHER_ICONS) {
            expect(launcherButton(icon.name)).toBeInTheDocument();
        }

        expect(screen.getAllByRole('button')).toHaveLength(LAUNCHER_ICONS.length);
    });

    it('marks the preferred icon row with selection styling', () => {
        preferences.appIcon = 'aurora';

        setup();

        const auroraBtn = launcherButton('Aurora');
        expect(auroraBtn.className).toContain(' bg-primary/10 dark:bg-accent/10');
        expect(auroraBtn).toHaveAttribute('aria-pressed', 'true');

        const frostBtn = launcherButton('Frost');
        expect(frostBtn.className).not.toContain(' bg-primary/10 dark:bg-accent/10');
        expect(frostBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('dispatches setAppIcon and shows a toast when picking a different icon', async () => {
        preferences.appIcon = 'default';
        setup();

        const other = LAUNCHER_ICONS.find((i) => i.key !== 'default')!;
        await userEvent.click(launcherButton(other.name));

        await waitFor(() => expect(setAppIcon).toHaveBeenCalledWith(other.key));
        await waitFor(() => expect(Toast.showSuccess).toHaveBeenCalledWith('App icon changed successfully'));
    });

    it('does not dispatch or toast when confirming the icon that is already active', async () => {
        preferences.appIcon = 'aurora';

        setup();

        await userEvent.click(launcherButton('Aurora'));

        expect(mockDispatch).not.toHaveBeenCalled();
        expect(setAppIcon).not.toHaveBeenCalled();
        expect(Toast.showSuccess).not.toHaveBeenCalled();
    });
});
