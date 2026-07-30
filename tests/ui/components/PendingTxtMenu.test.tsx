import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PendingTxtMenu from '../../../src/ui/components/PendingTxtMenu';

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ menus }: any) => <div data-testid="ctx-menu">{menus}</div>,
        ContextMenuItem: ({ title, onClick }: any) => (
            <button
                data-testid={`menu-${title.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={onClick}>
                {title}
            </button>
        ),
    };
});

jest.mock('../../../src/shared/types/Wallet', () => ({
    EthereumWalletType: { ledger: 'ledger', browser: 'browser' },
}));

jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { showAlertModal: jest.fn() },
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    removePendingTransactions: jest.fn(),
}));

let mockNetwork: any = {
    explorer_url: 'https://exp.test',
    explorer_name: 'Exp',
    platform_id: 1,
};
jest.mock('../../../src/store/selectors', () => ({
    useSelectedNetwork: () => mockNetwork,
}));

const baseData: any = {
    id: 't1',
    txHash: '0xtx',
    status: 'sending',
    walletType: 'browser',
    sender: '0x1',
};

describe('PendingTxtMenu', () => {
    beforeEach(() => {
        (global as any).platform = { openLink: jest.fn() };
        mockNetwork = {
            explorer_url: 'https://exp.test',
            explorer_name: 'Exp',
            platform_id: 1,
        };
    });

    it('renders Speed Up, Cancel, View, Delete items for sending tx', () => {
        render(<PendingTxtMenu data={baseData} onMenuPress={jest.fn()} />);
        expect(screen.getByTestId('menu-speed-up')).toBeInTheDocument();
        expect(screen.getByTestId('menu-cancel')).toBeInTheDocument();
        expect(screen.getByTestId('menu-view-on-exp')).toBeInTheDocument();
        expect(screen.getByTestId('menu-delete')).toBeInTheDocument();
    });

    it('clicking Speed Up dispatches via callback', () => {
        const onMenuPress = jest.fn();
        render(<PendingTxtMenu data={baseData} onMenuPress={onMenuPress} />);
        fireEvent.click(screen.getByTestId('menu-speed-up'));
        expect(onMenuPress).toHaveBeenCalledWith(baseData, 'speedup');
    });

    it('clicking Cancel emits cancel action', () => {
        const onMenuPress = jest.fn();
        render(<PendingTxtMenu data={baseData} onMenuPress={onMenuPress} />);
        fireEvent.click(screen.getByTestId('menu-cancel'));
        expect(onMenuPress).toHaveBeenCalledWith(baseData, 'cancel');
    });

    it('clicking view opens explorer link', () => {
        render(<PendingTxtMenu data={baseData} onMenuPress={jest.fn()} />);
        fireEvent.click(screen.getByTestId('menu-view-on-exp'));
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            'https://exp.test/tx/0xtx',
            '_blank',
        );
    });

    it('omits Delete when deletable is false', () => {
        render(
            <PendingTxtMenu data={baseData} onMenuPress={jest.fn()} deletable={false} />,
        );
        expect(screen.queryByTestId('menu-delete')).toBeNull();
    });

    it('clicking Delete opens alert modal and dispatches on confirm', () => {
        const eventManager = require('../../../src/shared/utils/eventManager').default;
        const removePendingTransactions = require('../../../src/store/actions/uiActions')
            .removePendingTransactions;
        render(<PendingTxtMenu data={baseData} onMenuPress={jest.fn()} />);
        fireEvent.click(screen.getByTestId('menu-delete'));
        expect(eventManager.showAlertModal).toHaveBeenCalled();
        const modalArgs = (eventManager.showAlertModal as jest.Mock).mock.calls[0][0];
        // invoke the Delete button onPress to exercise dispatch
        modalArgs.buttons[0].onPress();
        expect(removePendingTransactions).toHaveBeenCalledWith('0x1', 1, ['t1']);
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('does not open explorer when network is missing', () => {
        mockNetwork = null;
        render(<PendingTxtMenu data={baseData} onMenuPress={jest.fn()} />);
        // when network is null, explorer title is empty; ensure no view menu rendered
        expect(screen.queryByTestId('menu-view-on-exp')).toBeNull();
    });

    it('omits speed up/cancel for non-sending statuses', () => {
        render(
            <PendingTxtMenu
                data={{ ...baseData, status: 'confirmed' }}
                onMenuPress={jest.fn()}
            />,
        );
        expect(screen.queryByTestId('menu-speed-up')).toBeNull();
    });
});
