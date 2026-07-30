import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CoinMenu from '../../../src/ui/components/CoinMenu';
import EventType from '../../../src/shared/types/EventType';

const mockDispatch = jest.fn();
const mockEmit = jest.fn();

jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => 'light',
}));

jest.mock('../../../src/lib/WalletUtils', () => ({
    isNativeCoinByPlatformIdAndTokenAddress: (_p: number, token: string) => token === 'native',
}));

jest.mock('../../../src/lib/customTokens', () => ({
    buildHiddenTokensPreference: jest.fn(),
}));
const { buildHiddenTokensPreference } = jest.requireMock('../../../src/lib/customTokens');

const mockSetPreferences = jest.fn(() => Promise.resolve());
jest.mock('../../../src/store/actions/uiActions', () => ({
    showLoadingIndicator: () => ({ type: 'SHOW_LOADING' }),
    hideLoadingIndicator: () => ({ type: 'HIDE_LOADING' }),
    setPreferences: (prefs: any) => mockSetPreferences(prefs),
}));

jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        emit: (...args: any[]) => mockEmit(...args),
        on: jest.fn(),
        off: jest.fn(),
    },
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: jest.fn(), showSuccess: jest.fn() },
}));

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    const ContextMenu = ({ menus, placeholder }: any) => (
        <div>
            {placeholder}
            {menus}
        </div>
    );
    const ContextMenuItem = ({ title, onClick }: any) => (
        <button onClick={onClick}>{title}</button>
    );
    return { __esModule: true, default: ContextMenu, ContextMenuItem };
});

beforeEach(() => {
    jest.clearAllMocks();
    mockSetPreferences.mockImplementation(() => Promise.resolve());
    buildHiddenTokensPreference.mockImplementation(
        (chainId: number, token: string, hidden: boolean) => ({
            [`${chainId}:${token}`]: hidden,
        }),
    );
    mockDispatch.mockImplementation((action: any) =>
        typeof action === 'function' ? action(mockDispatch) : action,
    );
    Object.assign(navigator, {
        clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
});

describe('CoinMenu (local hide/show)', () => {
    const renderMenu = (over: Partial<any> = {}) =>
        render(
            <CoinMenu
                platformId={143}
                tokenAddress="0xToken"
                walletAddress="0xWallet"
                isHidden={false}
                {...over}
            />,
        );

    it('shows Hide Coin and Copy Token Address for a visible non-native token', () => {
        renderMenu();
        expect(screen.getByText('Hide Coin')).toBeInTheDocument();
        expect(screen.getByText('Copy Token Address')).toBeInTheDocument();
    });

    it('shows Show Coin when the token is hidden', () => {
        renderMenu({ isHidden: true });
        expect(screen.getByText('Show Coin')).toBeInTheDocument();
    });

    it('renders no actions for the native coin', () => {
        renderMenu({ tokenAddress: 'native' });
        expect(screen.queryByText('Hide Coin')).not.toBeInTheDocument();
    });

    it('hide coin stores the hidden flag locally and emits refresh', async () => {
        renderMenu();
        await userEvent.click(screen.getByText('Hide Coin'));

        expect(mockSetPreferences).toHaveBeenCalledWith({
            hiddenTokens: { '143:0xToken': true },
        });
        expect(mockEmit).toHaveBeenCalledWith(EventType.REFRESH_WALLET);
    });

    it('show coin clears the hidden flag locally and emits refresh', async () => {
        renderMenu({ isHidden: true });
        await userEvent.click(screen.getByText('Show Coin'));

        expect(mockSetPreferences).toHaveBeenCalledWith({
            hiddenTokens: { '143:0xToken': false },
        });
        expect(mockEmit).toHaveBeenCalledWith(EventType.REFRESH_WALLET);
    });

    it('copy token address writes the clipboard', async () => {
        renderMenu();
        await userEvent.click(screen.getByText('Copy Token Address'));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0xToken');
    });
});
