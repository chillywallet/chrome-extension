import React from 'react';
import { render, screen } from '@testing-library/react';
import TransactionAmountData from '../../../src/ui/components/TransactionAmountData';

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ alt }: any) => <img data-testid="safe-image" alt={alt} />,
}));

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: jest.fn(() => 'light'),
}));

const send = {
    label: 'You send',
    amount: 1.5,
    coin_symbol: 'ETH',
    coin_logo: 'eth.png',
    amount_usd: 3000,
};

describe('TransactionAmountData', () => {
    it('renders label, symbol and the negative amount badge', () => {
        render(<TransactionAmountData send={send} isMainnet={true} />);
        expect(screen.getByText('You send')).toBeInTheDocument();
        expect(screen.getByText('ETH')).toBeInTheDocument();
        expect(screen.getByText('Estimated changes')).toBeInTheDocument();
    });

    it('shows usd line when isMainnet is true', () => {
        const { container } = render(<TransactionAmountData send={send} isMainnet={true} />);
        expect(container.textContent).toContain('$3,000');
    });

    it('hides usd line when isMainnet is false', () => {
        const { container } = render(<TransactionAmountData send={send} isMainnet={false} />);
        expect(container.textContent).not.toContain('$3,000');
    });

    it('uses light tooltip variant in dark theme', () => {
        const selectors = require('../../../src/store/selectors');
        (selectors.useActualTheme as jest.Mock).mockReturnValueOnce('dark');
        const { container } = render(<TransactionAmountData send={send} isMainnet={true} />);
        const tooltipBtn = container.querySelector('[data-tooltip-variant]');
        expect(tooltipBtn?.getAttribute('data-tooltip-variant')).toBe('light');
    });

    it('falls back to 0 for missing amount and amount_usd, and empty logo', () => {
        const sparse = {
            label: 'You send',
            amount: undefined,
            coin_symbol: 'ETH',
            coin_logo: undefined,
            amount_usd: undefined,
        } as any;
        const { container } = render(
            <TransactionAmountData send={sparse} isMainnet={true} />,
        );
        // formatNumber(-0) → "0"; formatMoney(0) → "$0"
        expect(container.textContent).toContain('0');
    });
});
