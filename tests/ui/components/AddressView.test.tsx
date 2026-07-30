import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AddressView from '../../../src/ui/components/AddressView';
import Toast from '../../../src/ui/components/Toast';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({
        visible,
        onClose,
        children,
    }: {
        visible: boolean;
        onClose: () => void;
        children: React.ReactNode;
    }) =>
        visible ? (
            <div data-testid="modal">
                <button onClick={onClose}>modal-close</button>
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: { title: string; onClosePress: () => void }) => (
        <div data-testid="header">
            <span>{title}</span>
            <button onClick={onClosePress}>header-close</button>
        </div>
    ),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn() },
}));

jest.mock('react-qr-code', () => ({
    __esModule: true,
    default: ({ value }: { value: string }) => <div data-testid="qr" data-value={value} />,
}));

const validAddr = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

describe('AddressView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn() },
        });
    });

    it('does not render Modal when visible is false', () => {
        render(<AddressView visible={false} onClosePress={jest.fn()} walletAddress={validAddr} />);
        expect(screen.queryByTestId('modal')).toBeNull();
    });

    it('renders the QR code with the checksummed walletAddress when provided', () => {
        render(<AddressView visible={true} onClosePress={jest.fn()} walletAddress={validAddr} />);
        expect(screen.getByTestId('qr')).toHaveAttribute('data-value', validAddr);
    });

    it('uses the account address when no walletAddress is supplied', () => {
        const account: any = {
            address: validAddr,
            metadata: { name: 'My Wallet' },
        };
        render(<AddressView visible={true} onClosePress={jest.fn()} account={account} />);
        expect(screen.getByTestId('qr')).toHaveAttribute('data-value', validAddr);
        expect(screen.getByText('My Wallet')).toBeInTheDocument();
    });

    it('uses smartAddress when isSmartWallet is true', () => {
        const smart = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
        const account: any = {
            address: validAddr,
            smartAddress: smart,
            metadata: { name: 'SmartW' },
        };
        render(
            <AddressView
                visible={true}
                onClosePress={jest.fn()}
                account={account}
                isSmartWallet={true}
            />,
        );
        expect(screen.getByTestId('qr')).toHaveAttribute('data-value', smart);
    });

    it('falls back to empty checksum when address is invalid', () => {
        render(<AddressView visible={true} onClosePress={jest.fn()} walletAddress="not-hex" />);
        expect(screen.getByTestId('qr')).toHaveAttribute('data-value', '');
    });

    it('copies address and shows toast when Copy is clicked', () => {
        render(<AddressView visible={true} onClosePress={jest.fn()} walletAddress={validAddr} />);
        fireEvent.click(screen.getByText('Copy'));
        expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith(validAddr);
        expect((Toast as any).showSuccess).toHaveBeenCalledWith('Address copied to clipboard');
    });

    it('calls onClosePress via the header close', () => {
        const onClosePress = jest.fn();
        render(<AddressView visible={true} onClosePress={onClosePress} walletAddress={validAddr} />);
        fireEvent.click(screen.getByText('header-close'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('calls onClosePress via the Modal onClose', () => {
        const onClosePress = jest.fn();
        render(<AddressView visible={true} onClosePress={onClosePress} walletAddress={validAddr} />);
        fireEvent.click(screen.getByText('modal-close'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('falls back to account.address when isSmartWallet=true but smartAddress is missing', () => {
        const account: any = {
            address: validAddr,
            metadata: { name: 'NoSmart' },
        };
        render(
            <AddressView
                visible={true}
                onClosePress={jest.fn()}
                account={account}
                isSmartWallet={true}
            />,
        );
        expect(screen.getByTestId('qr')).toHaveAttribute('data-value', validAddr);
    });

    it('renders empty name when account has no metadata.name', () => {
        const account: any = {
            address: validAddr,
            metadata: {},
        };
        render(<AddressView visible={true} onClosePress={jest.fn()} account={account} />);
        expect(screen.getByTestId('qr')).toHaveAttribute('data-value', validAddr);
    });

    it('renders with no account and no walletAddress (empty fallback)', () => {
        render(<AddressView visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByTestId('qr')).toHaveAttribute('data-value', '');
        fireEvent.click(screen.getByText('Copy'));
        expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith('');
    });
});
