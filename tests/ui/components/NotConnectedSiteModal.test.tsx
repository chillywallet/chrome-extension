import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NotConnectedSiteModal from '../../../src/ui/components/NotConnectedSiteModal';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: any) =>
        visible ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ src, alt }: any) => <img data-testid="safe-image" data-src={src ?? ''} alt={alt} />,
}));

jest.mock('../../../src/ui/components/EmojiView', () => ({
    __esModule: true,
    default: () => <div data-testid="emoji-view" />,
}));

jest.mock('../../../src/ui/components/TextTruncate', () => ({
    __esModule: true,
    default: ({ text }: any) => <span>{text}</span>,
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    addPermittedAccount: (...args: any[]) => ({ type: 'ADD_PERM', args }),
}));

let mockActiveTab: any = { origin: 'https://dapp.test' };
let mockSubjectMeta: any = { name: 'Dapp', iconUrl: 'icon.png' };
jest.mock('../../../src/store/selectors', () => ({
    useActiveTab: () => mockActiveTab,
    useSubjectMetadataByOrigin: () => mockSubjectMeta,
}));

let mockFindWalletResult: any = { id: 'wallet-1' };
jest.mock('../../../src/store/selectorUtils', () => ({
    findWalletForAddress: () => mockFindWalletResult,
}));

const account: any = {
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    metadata: { name: 'A1', avatar: null },
};

describe('NotConnectedSiteModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockActiveTab = { origin: 'https://dapp.test' };
        mockSubjectMeta = { name: 'Dapp', iconUrl: 'icon.png' };
        mockFindWalletResult = { id: 'wallet-1' };
    });

    it('renders the host', () => {
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.getByText('dapp.test')).toBeInTheDocument();
    });

    it('renders Connect button for current account and Close at bottom', () => {
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.getByText('Connect')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('Connect button dispatches permitted account', () => {
        const onClose = jest.fn();
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[]}
                onClose={onClose}
                onSwitchAccount={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByText('Connect'));
        expect(onClose).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('Close button calls onClose', () => {
        const onClose = jest.fn();
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[]}
                onClose={onClose}
                onSwitchAccount={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('does nothing on Connect when activeTab origin is missing', () => {
        mockActiveTab = null;
        const onClose = jest.fn();
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[]}
                onClose={onClose}
                onSwitchAccount={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByText('Connect'));
        expect(onClose).toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('returns null when account is missing', () => {
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={null}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.queryByText('Connect')).toBeNull();
    });

    it('falls back to raw address when getAddress throws', () => {
        const badAccount: any = {
            address: 'not-an-address',
            metadata: { name: 'X', avatar: null },
        };
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={badAccount}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.getByText('not-an-address')).toBeInTheDocument();
    });

    it('does not invoke onSwitchAccount when no wallet is found', () => {
        mockFindWalletResult = null;
        const onSwitchAccount = jest.fn();
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[account]}
                onClose={jest.fn()}
                onSwitchAccount={onSwitchAccount}
            />,
        );
        fireEvent.click(screen.getByText('Switch'));
        expect(onSwitchAccount).not.toHaveBeenCalled();
    });

    it('invokes onSwitchAccount when wallet exists', () => {
        const onSwitchAccount = jest.fn();
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[account]}
                onClose={jest.fn()}
                onSwitchAccount={onSwitchAccount}
            />,
        );
        fireEvent.click(screen.getByText('Switch'));
        expect(onSwitchAccount).toHaveBeenCalledWith(account, { id: 'wallet-1' });
    });

    it('falls back to origin when host cannot be parsed', () => {
        mockActiveTab = { origin: 'not-a-valid-url' };
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
    });

    it('renders empty address when account.address is empty', () => {
        const noAddr: any = {
            address: '',
            metadata: { name: 'NoAddr', avatar: null },
        };
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={noAddr}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.getByText('NoAddr')).toBeInTheDocument();
    });

    it('handles missing subjectMeta (no name/icon)', () => {
        mockSubjectMeta = null;
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={account}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.getByText('dapp.test')).toBeInTheDocument();
    });

    it('handles missing address on account (undefined)', () => {
        const noAddr: any = {
            address: undefined,
            metadata: { name: 'X', avatar: null },
        };
        render(
            <NotConnectedSiteModal
                visible={true}
                currentAccount={noAddr}
                connectedAccounts={[]}
                onClose={jest.fn()}
                onSwitchAccount={jest.fn()}
            />,
        );
        expect(screen.getByText('X')).toBeInTheDocument();
    });
});
