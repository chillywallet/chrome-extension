import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import HardwareWalletSignModal, {
    getHardwareWalletSignVariant,
} from '../../../src/ui/components/HardwareWalletSignModal';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, className, onClick }: any) => (
            <div className={className} onClick={onClick}>
                {children}
            </div>
        ),
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0.3,
}));

jest.mock('../../../src/shared/utils/Images', () => ({
    Images: {
        ledgerLogoOfficial: 'ledger.png',
        trezorLogoOfficial: 'trezor.png',
    },
}));

jest.mock('../../../src/controller/KeyringController', () => ({
    KeyringTypes: {
        ledger: 'Ledger Hardware',
        trezor: 'Trezor Hardware',
        hd: 'HD Key Tree',
        simple: 'Simple Key Pair',
    },
}));

describe('getHardwareWalletSignVariant', () => {
    it('returns "ledger" for the Ledger keyring type', () => {
        expect(getHardwareWalletSignVariant('Ledger Hardware')).toBe('ledger');
    });

    it('returns "trezor" for the Trezor keyring type', () => {
        expect(getHardwareWalletSignVariant('Trezor Hardware')).toBe('trezor');
    });

    it('returns null for HD/simple/null/undefined', () => {
        expect(getHardwareWalletSignVariant('HD Key Tree')).toBeNull();
        expect(getHardwareWalletSignVariant('Simple Key Pair')).toBeNull();
        expect(getHardwareWalletSignVariant(null)).toBeNull();
        expect(getHardwareWalletSignVariant(undefined)).toBeNull();
        expect(getHardwareWalletSignVariant('')).toBeNull();
    });
});

describe('HardwareWalletSignModal', () => {
    it('renders nothing when visible is false', () => {
        const { container } = render(
            <HardwareWalletSignModal visible={false} onClose={() => {}} variant="ledger" />,
        );
        expect(container.textContent).toBe('');
    });

    it('renders Ledger title and instructions when variant is ledger (transaction)', () => {
        render(
            <HardwareWalletSignModal
                visible={true}
                onClose={() => {}}
                variant="ledger"
                signingContext="transaction"
            />,
        );
        expect(screen.getByText('Approve on Ledger')).toBeInTheDocument();
        expect(screen.getByText(/Your transaction was submitted/)).toBeInTheDocument();
        expect(screen.getByText(/Review the transaction/)).toBeInTheDocument();
    });

    it('renders Ledger message subtitle when signingContext=message', () => {
        render(
            <HardwareWalletSignModal
                visible={true}
                onClose={() => {}}
                variant="ledger"
                signingContext="message"
            />,
        );
        expect(screen.getByText(/Your signature request was submitted/)).toBeInTheDocument();
        expect(screen.getByText(/Review the message/)).toBeInTheDocument();
    });

    it('renders Trezor title and Trezor-specific steps (transaction default)', () => {
        render(
            <HardwareWalletSignModal visible={true} onClose={() => {}} variant="trezor" />,
        );
        expect(screen.getByText('Approve on Trezor')).toBeInTheDocument();
        expect(screen.getByText(/Your transaction was submitted/)).toBeInTheDocument();
        expect(screen.getByText(/Trezor window appears/)).toBeInTheDocument();
        expect(screen.getByText(/Review the transaction/)).toBeInTheDocument();
    });

    it('renders Trezor message subtitle when signingContext=message', () => {
        render(
            <HardwareWalletSignModal
                visible={true}
                onClose={() => {}}
                variant="trezor"
                signingContext="message"
            />,
        );
        expect(screen.getByText(/Your signature request was submitted/)).toBeInTheDocument();
        expect(screen.getByText(/Review the message/)).toBeInTheDocument();
    });

    it('invokes onClose when the Close button is clicked', () => {
        const onClose = jest.fn();
        render(
            <HardwareWalletSignModal visible={true} onClose={onClose} variant="ledger" />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
    });
});
