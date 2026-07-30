import { configureStore } from '@reduxjs/toolkit';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import { DEFAULT_CHAIN } from '../../../src/lib/ChainsUtils';
import { DEFAULT_ROUTE } from '../../../src/shared/constants/routes';
import type { NFT, SingleNFTDetail } from '../../../src/shared/types/Wallet';
import NFTDetail from '../../../src/ui/pages/NFTDetail';
import type { RoutesContextType } from '../../../src/ui/pages/RoutesProvider';
import { RoutesContext } from '../../../src/ui/pages/RoutesProvider';

import { buildHomeReduxState, defaultRoutesValue } from './Home/fixtures/homeHarness';

const LG_MEDIA_QUERY = '(min-width: 1024px) and (max-width: 1279px)';

jest.mock('../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: { fetchNativeCoinPrice: jest.fn() },
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) => (
        <div>
            <div data-testid="header-title">{title}</div>
            {action && <div data-testid="header-action">{action}</div>}
        </div>
    ),
}));

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} data-testid="safe-image" />,
}));

jest.mock('../../../src/ui/components/WalletTag', () => ({
    __esModule: true,
    default: ({ isAAWallet }: { isAAWallet: boolean }) => (
        <span data-testid="wallet-tag">{isAAWallet ? 'aa' : 'eoa'}</span>
    ),
}));

jest.mock('../../../src/ui/components/Carousel', () => ({
    __esModule: true,
    default: ({ slides }: { slides: React.ReactNode[] }) => (
        <div data-testid="nft-carousel">slides:{slides.length}</div>
    ),
}));

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({
            placeholder,
            menus,
        }: {
            placeholder: React.ReactNode;
            menus: React.ReactNode;
        }) => (
            <div data-testid="context-menu">
                <span data-testid="context-menu-trigger">{placeholder}</span>
                {menus}
            </div>
        ),
        ContextMenuItem: ({ title, onClick }: { title: string; onClick: () => void }) => (
            <button type="button" data-testid={`context-item-${title.replace(/\s+/g, '-')}`} onClick={onClick}>
                {title}
            </button>
        ),
    };
});

function buildNFT(overrides: Partial<NFT> & { nft_collection?: Partial<NFT['nft_collection']> } = {}): NFT {
    const collDefaults = {
        _id: 'coll-1',
        collection_id: 'cid',
        floor_price: 0,
        image_url: '',
        marketplace_pages: [] as NFT['nft_collection']['marketplace_pages'],
        name: 'Inner Collection',
        spam_score: 0,
        ...overrides.nft_collection,
    };
    return {
        _id: 'nft-1',
        wallet_address: '0xabc',
        contract: { type: 'erc721', name: 'C' },
        contract_address: '0xContractAddr',
        current_usd_value: 0,
        image_url: 'https://img.test/nft.png',
        token_id: '1',
        nft_collection: collDefaults,
        name: 'Token Name',
        previews: { blurhash: '', image_medium_url: '', image_small_url: '' },
        video_url: null,
        audio_url: null,
        chain: 'monad',
        ...overrides,
        nft_collection: { ...collDefaults, ...(overrides.nft_collection ?? {}) },
    } as NFT;
}

function buildSingleNFTPayload(nftDetailsOverrides: Partial<NFT> = {}): SingleNFTDetail {
    const nftDetails = buildNFT(nftDetailsOverrides);
    return {
        _id: nftDetails._id,
        name: nftDetails.name,
        address: nftDetails.contract_address,
        platform_id: nftDetails.platform_id ?? DEFAULT_CHAIN.platform_id,
        integration_type: 'native',
        nftDetails,
    };
}

describe('NFTDetail', () => {
    const replace = jest.fn();
    let history: MemoryHistory;
    let openLink: jest.Mock;

    const onNFTSendPress = jest.fn();

    beforeEach(() => {
        window.matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: query === LG_MEDIA_QUERY,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));

        history = createMemoryHistory({ initialEntries: ['/nft-detail'] });
        jest.spyOn(history, 'replace').mockImplementation(replace);
        replace.mockClear();

        openLink = jest.fn();
        (global as unknown as { platform: { openLink: jest.Mock } }).platform = { openLink };

        onNFTSendPress.mockClear();

    });

    function renderPage(
        options: {
            routes?: Partial<RoutesContextType>;
            redux?: Record<string, unknown>;
            listNft?: NFT | null;
        } = {},
    ) {
        const listNft = options.listNft === undefined ? buildNFT() : options.listNft;
        const initialState = buildHomeReduxState({
            globalState: {
                nativeCoinPrices: { [DEFAULT_CHAIN.platform_id]: 2000 },
                ...((options.redux?.globalState as object) ?? {}),
            },
            ...(options.redux ?? {}),
        });
        const store = configureStore({
            reducer: (state = initialState) => state,
            middleware: getDefaultMiddleware =>
                getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
        });

        const routes: RoutesContextType = {
            ...defaultRoutesValue,
            dispatch: store.dispatch as RoutesContextType['dispatch'],
            onNFTSendPress,
            sendAssetViewData:
                listNft === null
                    ? undefined
                    : {
                          nftToSend: listNft,
                          isAAWallet: false,
                      },
            ...options.routes,
        };

        return render(
            <Provider store={store}>
                <Router history={history}>
                    <RoutesContext.Provider value={routes}>
                        <NFTDetail />
                    </RoutesContext.Provider>
                </Router>
            </Provider>,
        );
    }

    it('redirects home when no NFT is in send context', () => {
        renderPage({ listNft: null });
        expect(replace).toHaveBeenCalledWith(DEFAULT_ROUTE);
    });

    it('renders header title from the list NFT payload', async () => {
        renderPage();
        expect(await screen.findByTestId('header-title')).toHaveTextContent('Token Name');
    });



    it('shows high spam warning when collection spam score exceeds threshold from list NFT', async () => {
        const listNft = buildNFT({
            spamThreshold: 10,
            nft_collection: { ...buildNFT().nft_collection, spam_score: 50 },
        });
        const overrideNft = buildNFT({
                        nft_collection: {
                            ...buildNFT().nft_collection,
                            spam_score: 50,
                        },
                    });
        renderPage({ listNft });
        expect(
            await screen.findByText('This NFT has a high spam score. Please be cautious.'),
        ).toBeInTheDocument();
    });

    it('invokes onNFTSendPress with list NFT and AA flag when Send is pressed', async () => {
        const listNft = buildNFT({ _id: 'send-me' });
        const overrideNft = buildNFT({ _id: 'send-me' });
        renderPage({ listNft: overrideNft,
            listNft,
            routes: { sendAssetViewData: { nftToSend: listNft, isAAWallet: true } },
        });
        await userEvent.click(await screen.findByRole('button', { name: /Send This NFT/i }));
        expect(onNFTSendPress).toHaveBeenCalledWith(listNft, true);
    });

    it('shows AA wallet tag when context says AA', async () => {
        const listNft = buildNFT();
        renderPage({
            routes: { sendAssetViewData: { nftToSend: listNft, isAAWallet: true } },
        });
        expect(await screen.findByTestId('wallet-tag')).toHaveTextContent('aa');
    });

    it('opens explorer from header context menu', async () => {
        renderPage();
        // Derived from the default chain rather than hardcoded, so changing
        // DEFAULT_CHAIN_ID doesn't break this test.
        const explorerItem = `context-item-View-on-${DEFAULT_CHAIN.explorer_name.replace(
            /\s+/g,
            '-',
        )}`;
        await userEvent.click(await screen.findByTestId(explorerItem));
        expect(openLink).toHaveBeenCalledWith(
            `${DEFAULT_CHAIN.explorer_url}/address/0xContractAddr`,
            '_blank',
        );
    });

    it('opens contract link when a linked detail row is clicked', async () => {
        renderPage();
        await userEvent.click(await screen.findByText('0xContractAddr'));
        expect(openLink).toHaveBeenCalledWith(
            `${DEFAULT_CHAIN.explorer_url}/address/0xContractAddr`,
            '_blank',
        );
    });

    it('renders floor price from marketplace list and cycles on tap', async () => {
        const overrideNft = buildNFT({
                        nft_collection: {
                            ...buildNFT().nft_collection,
                            floor_prices: [
                                { marketplace_id: 'a', marketplace_name: 'M1', value: 7 },
                                { marketplace_id: 'b', marketplace_name: 'M2', value: 8 },
                            ],
                            floor_price: 0,
                        },
                    });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByText('7')).toBeInTheDocument();
        const floorCard = screen.getByText('Floor Price').closest('div[class*="cursor-pointer"]')!;
        await userEvent.click(floorCard);
        await waitFor(() => {
            expect(screen.getByText('8')).toBeInTheDocument();
        });
        await userEvent.click(floorCard);
        await waitFor(() => {
            expect(screen.getByText('7')).toBeInTheDocument();
        });
    });

    it('renders estimated price and fiat conversion on mainnet with native price', async () => {
        const overrideNft = buildNFT({ estimate_eth_price: 1.5 });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByText('Estimated Price')).toBeInTheDocument();
        expect(screen.getByText(/3,?000/)).toBeInTheDocument();
    });

    it('shows N/A when both name and token_id are missing', async () => {
        const overrideNft = buildNFT({
                        name: undefined as any,
                        token_id: undefined as any,
                    });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByText('N/A')).toBeInTheDocument();
    });

    it('uses Carousel when both video and image URLs exist', async () => {
        const overrideNft = buildNFT({
                        video_url: 'https://video.test/v.mp4',
                        image_url: 'https://img.test/nft.png',
                        audio_url: null,
                    });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByTestId('nft-carousel')).toHaveTextContent('slides:2');
    });

    it('renders audio when audio_url is set (replaces video/image slides)', async () => {
        const overrideNft = buildNFT({
                        audio_url: 'https://audio.test/a.mp3',
                        video_url: 'https://video.test/v.mp4',
                        image_url: 'https://img.test/nft.png',
                    });
        const { container } = renderPage({ listNft: overrideNft });
        expect(await screen.findByRole('button', { name: /Send This NFT/i })).toBeInTheDocument();
        const audio = container.querySelector('audio[src="https://audio.test/a.mp3"]');
        expect(audio).toBeInTheDocument();
        expect(screen.queryByTestId('nft-carousel')).not.toBeInTheDocument();
    });

    it('renders properties from extra metadata attributes', async () => {
        const overrideNft = buildNFT({
                        extra_metadata: {
                            attributes: [{ trait_type: 'color', value: 'blue' }],
                            image_original_url: '',
                            animation_original_url: '',
                        },
                    });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByText('Properties')).toBeInTheDocument();
        expect(screen.getByText('Color')).toBeInTheDocument();
        expect(screen.getByText('blue')).toBeInTheDocument();
    });

    it('falls back to token id in title when name is missing', async () => {
        const overrideNft = buildNFT({
                        name: '',
                        token_id: '42',
                    });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByText('42')).toBeInTheDocument();
    });

    it('includes marketplace page rows in details', async () => {
        const overrideNft = buildNFT({
                        nft_collection: {
                            ...buildNFT().nft_collection,
                            marketplace_pages: [{ marketplace_name: 'MagicEden', collection_url: 'https://me.test/c' }],
                        },
                    });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByText('MagicEden')).toBeInTheDocument();
    });

    it('opens collection website from details when external_url is set', async () => {
        const overrideNft = buildNFT({
                        nft_collection: {
                            ...buildNFT().nft_collection,
                            external_url: 'https://coll.example',
                        },
                    });
        renderPage({ listNft: overrideNft });
        await userEvent.click(await screen.findByText('https://coll.example'));
        expect(openLink).toHaveBeenCalledWith('https://coll.example', '_blank');
    });

    it('renders description and collection copy when present', async () => {
        const overrideNft = buildNFT({
                        description: 'About this token',
                        nft_collection: {
                            ...buildNFT().nft_collection,
                            description: 'Collection blurb',
                            image_url: 'https://img.test/coll.png',
                        },
                    });
        renderPage({ listNft: overrideNft });
        expect(await screen.findByText('About this token')).toBeInTheDocument();
        expect(screen.getByText('Collection blurb')).toBeInTheDocument();
        expect(screen.getAllByTestId('safe-image').length).toBeGreaterThanOrEqual(1);
    });
});
