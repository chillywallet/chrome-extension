import React from 'react';
import { render, screen } from '@testing-library/react';
import TransactionHexData from '../../../src/ui/components/TransactionHexData';

describe('TransactionHexData', () => {
    it('renders the title', () => {
        render(<TransactionHexData title="Tx Hex" data="0x" />);
        expect(screen.getByText('Tx Hex')).toBeInTheDocument();
    });

    it('shows hex data length and value when data is provided', () => {
        render(<TransactionHexData title="Tx Hex" data="0x1234" />);
        expect(screen.getByText(/Hex Data: \d+ bytes/)).toBeInTheDocument();
        expect(screen.getByText('0x1234')).toBeInTheDocument();
    });

    it('renders empty container when data is undefined', () => {
        render(<TransactionHexData title="Empty" data={undefined} />);
        expect(screen.queryByText(/Hex Data:/)).not.toBeInTheDocument();
    });
});
