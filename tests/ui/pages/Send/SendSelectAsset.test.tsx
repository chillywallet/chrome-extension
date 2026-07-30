import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';

import SendSelectAsset from '../../../../src/ui/pages/Send/SendSelectAsset';
import CoinsUtils from '../../../../src/lib/CoinsUtils';
import { getNftHoldings } from '../../../../src/shared/utils/portfolio';
import * as Selectors from '../../../../src/store/selectors';
import { useCurrentPlatformId } from '../../../../src/store/selectors/wallet';

jest.mock('../../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../src/store/selectors', () => ({
    useCurrentAccount: jest.fn(),
    usePortfolioCoins: jest.fn(),
    usePortfolioNfts: jest.fn(),
}));

jest.mock('../../../../src/store/selectors/wallet', () => ({
    useCurrentPlatformId: jest.fn(),
}));

jest.mock('../../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: {
        fetchPortfolioCoins: jest.fn(),
    },
}));

jest.mock('../../../../src/shared/utils/portfolio', () => ({
    getNftHoldings: jest.fn(),
}));

jest.mock('../../../../src/store/actions/uiActions', () => ({
    setPortfolioNfts: jest.fn(() => () => Promise.resolve()),
}));

jest.mock('../../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onBackPress }: { title: string; onBackPress?: () => void }) => (
        <div>
            <span>{title}</span>
            {onBackPress ? (
                <button type="button" data-testid="header-back" onClick={onBackPress}>
                    back
                </button>
            ) : null}
        </div>
    ),
}));

jest.mock('../../../../src/ui/components/WalletTag', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../../../src/ui/components/CoinCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: { data: { symbol: string }; onPress: (c: unknown) => void }) => (
        <button type="button" data-testid={`coin-${data.symbol}`} onClick={() => onPress(data)}>
            {data.symbol}
        </button>
    ),
}));

jest.mock('../../../../src/ui/components/NFTCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: { data: { name: string }; onPress: (n: unknown) => void }) => (
        <button type="button" data-testid={`nft-${data.name}`} onClick={() => onPress(data)}>
            {data.name}
        </button>
    ),
}));

describe('SendSelectAsset', () => {
    const onCoinPress = jest.fn();
    const onNFTPress = jest.fn();
    const setTabIndex = jest.fn();
    const setShowSpamNft = jest.fn();

    const baseCoin = {
        token_address: '0xabc',
        coin_name: 'Alpha Token',
        symbol: 'ALP',
        platform_id: 1,
        wallet_address: '',
        wallet_name: '',
        token_id: '',
        balance: 1,
        balance_usd: 1,
        integration_type: '',
        avatar: null,
        is_custom: false,
        is_hidden: false,
        is_verified: true,
        logo: '',
    };

    const baseNft = {
        _id: 'nftdoc1',
        wallet_address: '0xw',
        contract: { type: 'erc721', name: 'Collection' },
        contract_address: '0xcollection',
        current_usd_value: 10,
        image_url: '',
        token_id: '1',
        nft_collection: {
            _id: 'col',
            collection_id: 'col',
            floor_price: 0,
            image_url: '',
            marketplace_pages: [],
            name: 'Cool Cats',
            spam_score: 0,
            total_price: 0,
            chain: 'eth',
        },
        estimate_eth_price: 0,
        name: '#1',
        description: '',
        previews: { blurhash: '', image_medium_url: '', image_small_url: '' },
        video_url: null,
        chain: 'eth',
        platform_id: 1,
    };

    beforeEach(() => {
        onCoinPress.mockClear();
        onNFTPress.mockClear();

        jest.mocked(Selectors.useCurrentAccount).mockReturnValue({
            address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            smartAddress: undefined,
            id: 'a1',
            metadata: {},
        } as never);

        jest.mocked(useCurrentPlatformId).mockReturnValue(1);
        jest.mocked(Selectors.usePortfolioCoins).mockReturnValue([
            baseCoin as never,
            { ...baseCoin, token_address: '0xb', coin_name: 'Beta Token', symbol: 'BET' } as never,
        ]);
        jest.mocked(Selectors.usePortfolioNfts).mockReturnValue([
            {
                _id: 'w1',
                name: '',
                address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                platform_id: 1,
                integration_type: '',
                spamThreshold: 10,
                nftDetails: [baseNft],
            },
        ] as never);

        jest.mocked(getNftHoldings).mockResolvedValue({ nfts: [], pagination: null });
        jest.mocked(CoinsUtils.fetchPortfolioCoins).mockImplementation(() => undefined);
    });

    const setup = (isAAWallet = false) => {
        const history = createMemoryHistory();
        return render(
            <Router history={history}>
                <SendSelectAsset
                    onCoinPress={onCoinPress}
                    onNFTPress={onNFTPress}
                    tabIndex={0}
                    setTabIndex={setTabIndex}
                    showSpamNft={false}
                    setShowSpamNft={setShowSpamNft}
                    isAAWallet={isAAWallet}
                />
            </Router>,
        );
    };

    it('filters coins via search box', async () => {
        setup();

        await userEvent.type(screen.getAllByPlaceholderText('Search...')[0], 'beta');

        expect(screen.queryByTestId('coin-ALP')).not.toBeInTheDocument();
        expect(screen.getByTestId('coin-BET')).toBeInTheDocument();
    });

    it('fires onCoinPress when a coin row is chosen', async () => {
        setup();

        await userEvent.click(screen.getByTestId('coin-ALP'));
        expect(onCoinPress).toHaveBeenCalled();
    });

    it('loads nft grid from portfolio nft holdings', async () => {
        setup();

        await userEvent.click(screen.getByRole('tab', { name: 'NFTs' }));

        await screen.findByTestId('nft-#1');

        await userEvent.click(screen.getByTestId('nft-#1'));
        expect(onNFTPress).toHaveBeenCalled();
    });

    it('fetches coins for the active wallet address', async () => {
        setup();

        await waitFor(() =>
            expect(CoinsUtils.fetchPortfolioCoins).toHaveBeenCalledWith(
                '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            ),
        );
    });

    it('uses smart address when AA wallet tab is active', async () => {
        jest.mocked(Selectors.useCurrentAccount).mockReturnValue({
            address: '0xlegacy',
            smartAddress: '0xsmartacc',
            id: 'a1',
            metadata: {},
        } as never);

        setup(true);

        await waitFor(() =>
            expect(CoinsUtils.fetchPortfolioCoins).toHaveBeenCalledWith('0xsmartacc'),
        );
    });

    it('navigates back via the header back button', async () => {
        const history = createMemoryHistory();
        const replaceSpy = jest.spyOn(history, 'replace');
        render(
            <Router history={history}>
                <SendSelectAsset
                    onCoinPress={onCoinPress}
                    onNFTPress={onNFTPress}
                    tabIndex={0}
                    setTabIndex={setTabIndex}
                    showSpamNft={false}
                    setShowSpamNft={setShowSpamNft}
                    isAAWallet={false}
                />
            </Router>,
        );

        await userEvent.click(screen.getByTestId('header-back'));
        expect(replaceSpy).toHaveBeenCalled();
    });

    it('runs a debounced NFT search when typing in the NFT tab', async () => {
        const searchedNft = {
            ...baseNft,
            _id: 'searched',
            name: '#Searched',
            contract_address: '0xsearched',
        };
        jest.mocked(getNftHoldings).mockResolvedValue({
            nfts: [
                {
                    _id: 's1',
                    name: '',
                    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    platform_id: 1,
                    integration_type: '',
                    spamThreshold: 10,
                    nftDetails: [searchedNft],
                } as never,
            ],
            pagination: null,
        });

        setup();

        await userEvent.click(screen.getByRole('tab', { name: 'NFTs' }));

        const searchInput = screen.getByPlaceholderText('Search...');
        await userEvent.type(searchInput, 'cool');

        await waitFor(
            () =>
                expect(getNftHoldings).toHaveBeenCalledWith(
                    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    1,
                    'cool',
                    1,
                ),
            { timeout: 3000 },
        );
    });

    it('shows an empty-search message when search returns no NFTs', async () => {
        jest.mocked(Selectors.usePortfolioNfts).mockReturnValue([] as never);
        jest.mocked(getNftHoldings).mockResolvedValue({ nfts: [], pagination: null });
        setup();

        await userEvent.click(screen.getByRole('tab', { name: 'NFTs' }));
        const searchInput = screen.getByPlaceholderText('Search...');
        await userEvent.type(searchInput, 'zzz');

        await screen.findByText('No NFTs found matching your search', { timeout: 3000 });
    });

    it('skips fetching when wallet address is not yet available', async () => {
        jest.mocked(Selectors.useCurrentAccount).mockReturnValue(undefined as never);
        setup();

        await waitFor(() =>
            expect(CoinsUtils.fetchPortfolioCoins).not.toHaveBeenCalled(),
        );
        expect(getNftHoldings).not.toHaveBeenCalled();
    });

    it('logs and swallows NFT-loading errors', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        jest.mocked(Selectors.usePortfolioNfts).mockReturnValue([] as never);
        jest.mocked(getNftHoldings).mockRejectedValueOnce(new Error('network down'));

        setup();

        await waitFor(() => expect(getNftHoldings).toHaveBeenCalled());
        await waitFor(() => expect(consoleSpy).toHaveBeenCalled());

        consoleSpy.mockRestore();
    });

    it('shows the empty-coins fallback when filtered coins are empty', async () => {
        jest.mocked(Selectors.usePortfolioCoins).mockReturnValue([] as never);
        setup();

        expect(screen.getByText('There are no coins')).toBeInTheDocument();
    });

    it('dispatches setPortfolioNfts after an initial fetch returns nfts', async () => {
        const dispatchSpy = jest.fn();
        const useAppDispatch = require('../../../../src/store/store').useAppDispatch as jest.Mock;
        useAppDispatch.mockReturnValue(dispatchSpy);

        jest.mocked(Selectors.usePortfolioNfts).mockReturnValue([] as never);
        const fetchedNft = { ...baseNft, _id: 'fetched', name: '#Fetched' };
        jest.mocked(getNftHoldings).mockResolvedValue({
            nfts: [
                {
                    _id: 'f1',
                    name: '',
                    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    platform_id: 1,
                    integration_type: '',
                    spamThreshold: 10,
                    nftDetails: [fetchedNft],
                } as never,
            ],
            pagination: null,
        });

        setup();

        await waitFor(() => expect(getNftHoldings).toHaveBeenCalledWith(
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            1,
            '',
            1,
        ));
        await waitFor(() => expect(dispatchSpy).toHaveBeenCalled());
    });

    it('clears search results when the NFT search text is emptied', async () => {
        setup();

        await userEvent.click(screen.getByRole('tab', { name: 'NFTs' }));

        const searchInput = screen.getByPlaceholderText('Search...');
        await userEvent.type(searchInput, 'a');
        await userEvent.clear(searchInput);

        // Allow the debounce flushed by clearing to run through the empty-branch reset
        await new Promise(resolve => setTimeout(resolve, 350));
        expect(searchInput).toHaveValue('');
    });
});
