import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketCoinCard from '../../../src/ui/components/MarketCoinCard';

jest.mock('../../../src/ui/components/AssetLogo', () => ({
    __esModule: true,
    default: ({ src }: { src?: string }) => <div data-testid="asset-logo" data-src={src ?? ''} />,
}));

const baseCoin: any = {
    name: 'Bitcoin',
    symbol: 'BTC',
    logo: 'btc.png',
    rank: 1,
    latest: { price: 50000, percent_change_24h: 5.5 },
};

describe('MarketCoinCard', () => {
    it('renders coin name, symbol, rank, and price', () => {
        render(<MarketCoinCard coin={baseCoin} onClick={jest.fn()} />);
        expect(screen.getByText('Bitcoin')).toBeInTheDocument();
        expect(screen.getByText(/#1/)).toBeInTheDocument();
        expect(screen.getByText(/BTC/)).toBeInTheDocument();
        expect(screen.getByText(/5.50%/)).toBeInTheDocument();
    });

    it('shows green styling for positive change', () => {
        const { container } = render(<MarketCoinCard coin={baseCoin} onClick={jest.fn()} />);
        expect(container.querySelector('.text-green-500')).toBeInTheDocument();
    });

    it('shows red styling for negative change', () => {
        render(
            <MarketCoinCard
                coin={{
                    ...baseCoin,
                    latest: { price: 50000, percent_change_24h: -3.25 },
                }}
                onClick={jest.fn()}
            />,
        );
        expect(screen.getByText(/3.25%/)).toBeInTheDocument();
    });

    it('hides change icon when percent is zero', () => {
        render(
            <MarketCoinCard
                coin={{ ...baseCoin, latest: { price: 100, percent_change_24h: 0 } }}
                onClick={jest.fn()}
            />,
        );
        expect(screen.queryByText(/0.00%/)).toBeNull();
    });

    it('calls onClick with the coin', () => {
        const onClick = jest.fn();
        render(<MarketCoinCard coin={baseCoin} onClick={onClick} />);
        fireEvent.click(screen.getByText('Bitcoin'));
        expect(onClick).toHaveBeenCalledWith(baseCoin);
    });

    it('omits rank prefix when rank is missing', () => {
        render(
            <MarketCoinCard
                coin={{ ...baseCoin, rank: undefined }}
                onClick={jest.fn()}
            />,
        );
        expect(screen.queryByText(/^#/)).toBeNull();
    });
});
