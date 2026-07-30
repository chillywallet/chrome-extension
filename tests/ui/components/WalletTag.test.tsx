import React from 'react';
import { render, screen } from '@testing-library/react';
import WalletTag from '../../../src/ui/components/WalletTag';

describe('WalletTag', () => {
    it('renders Smart Wallet text when isAAWallet is true', () => {
        render(<WalletTag isAAWallet={true} />);
        // HomeTabType.SmartWallet is the label rendered inside
        expect(screen.getByText(/.+/)).toBeInTheDocument();
    });

    it('renders nothing when isAAWallet is false', () => {
        const { container } = render(<WalletTag isAAWallet={false} />);
        expect(container.firstChild).toBeNull();
    });
});
