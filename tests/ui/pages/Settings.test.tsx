import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Settings from '../../../src/ui/pages/Settings';
import {
    GAS_OPTIONS_ROUTE,
    ICON_SELECTOR_ROUTE,
} from '../../../src/shared/constants/routes';

const mockHistoryPush = jest.fn();
const mockPreferences: any = { enableChangeIcon: true };

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({ push: mockHistoryPush }),
}));

jest.mock('../../../src/store/selectors', () => ({
    usePreferences: () => mockPreferences,
    useActualTheme: () => 'light',
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <header>{title}</header>,
}));

jest.mock('../../../src/ui/components/ThemeModal', () => ({
    __esModule: true,
    default: ({ show }: { show: boolean }) =>
        show ? <div data-testid="theme-modal" /> : null,
}));

describe('Settings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPreferences.enableChangeIcon = true;
        process.env.BUILD_TYPE = 'Debug';
    });

    it('renders the main settings rows', () => {
        render(<Settings />);
        expect(screen.getByText('Theme Setting')).toBeInTheDocument();
        expect(screen.getByText('App Icon')).toBeInTheDocument();
        expect(screen.getByText('Network Fee Options')).toBeInTheDocument();
        expect(screen.getByText('Developer Settings')).toBeInTheDocument();
        expect(screen.queryByText('Smart Wallet (ERC-4337)')).not.toBeInTheDocument();
        expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
    });

    it('hides the app icon row when enableChangeIcon is off', () => {
        mockPreferences.enableChangeIcon = false;
        render(<Settings />);
        expect(screen.queryByText('App Icon')).not.toBeInTheDocument();
    });

    it('navigates to gas options and icon selector', async () => {
        render(<Settings />);
        await userEvent.click(screen.getByText('Network Fee Options'));
        expect(mockHistoryPush).toHaveBeenCalledWith(GAS_OPTIONS_ROUTE);

        await userEvent.click(screen.getByText('App Icon'));
        expect(mockHistoryPush).toHaveBeenCalledWith(ICON_SELECTOR_ROUTE);
    });

    it('opens the theme modal', async () => {
        render(<Settings />);
        await userEvent.click(screen.getByText('Theme Setting'));
        expect(screen.getByTestId('theme-modal')).toBeInTheDocument();
    });
});
