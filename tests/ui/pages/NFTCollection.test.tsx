import { configureStore } from '@reduxjs/toolkit';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import { DEFAULT_ROUTE } from '../../../src/shared/constants/routes';
import type { NFT } from '../../../src/shared/types/Wallet';
import NFTCollection from '../../../src/ui/pages/NFTCollection';
import type { RoutesContextType } from '../../../src/ui/pages/RoutesProvider';
import { RoutesContext } from '../../../src/ui/pages/RoutesProvider';

import { buildHomeReduxState, defaultRoutesValue } from './Home/fixtures/homeHarness';

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) => (
        <div>
            <div data-testid="header-title">{title}</div>
            {action && <div data-testid="header-action">{action}</div>}
        </div>
    ),
}));

jest.mock('../../../src/ui/components/ScrollWithButton', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll">{children}</div>,
}));

jest.mock('../../../src/ui/components/NFTCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: { data: { _id: string }; onPress: () => void }) => (
        <button type="button" data-testid={`nft-card-${data._id}`} onClick={onPress}>
            NFT
        </button>
    ),
}));

/** Real ContextMenu portals via eventManager; render `menus` so we can fire the link handler. */
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
            <button type="button" data-testid={`context-item-${title.replace(/\s+/g, '-')}`} onClick={() => onClick({})}>
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
        marketplace_pages: [],
        name: 'Inner Collection',
        spam_score: 0,
        spamThreshold: 100,
        ...overrides.nft_collection,
    };
    return {
        _id: 'nft-1',
        wallet_address: '0xabc',
        contract: { type: 'erc721', name: 'C' },
        contract_address: '0xContractAddr',
        current_usd_value: 0,
        image_url: '',
        token_id: '1',
        nft_collection: collDefaults,
        name: 'Token',
        previews: { blurhash: '', image_medium_url: '', image_small_url: '' },
        video_url: null,
        audio_url: null,
        chain: 'monad',
        ...overrides,
        nft_collection: { ...collDefaults, ...(overrides.nft_collection ?? {}) },
    } as NFT;
}

function buildNFTCollection(overrides: Partial<RoutesContextType['selectedNFTCollection']> = {}) {
    const nft = buildNFT();
    return {
        _id: 'collection-root',
        collection_id: 'root-cid',
        floor_price: 0,
        image_url: 'https://img.test/c.png',
        items: [nft],
        marketplace_pages: [],
        name: 'My Collection',
        platform_id: 1,
        spam_score: 0,
        total_price: 0,
        chain: 'monad',
        ...overrides,
        items: overrides.items ?? [nft],
    } as NonNullable<RoutesContextType['selectedNFTCollection']>;
}

describe('NFTCollection', () => {
    const replace = jest.fn();
    let history: MemoryHistory;
    let openLink: jest.Mock;

    beforeEach(() => {
        history = createMemoryHistory({ initialEntries: ['/nft-collection'] });
        jest.spyOn(history, 'replace').mockImplementation(replace);
        replace.mockClear();

        openLink = jest.fn();
        (global as unknown as { platform: { openLink: jest.Mock } }).platform = { openLink };
    });

    function renderPage(options: { routes?: Partial<RoutesContextType>; reduxState?: Record<string, unknown> } = {}) {
        const initialState = buildHomeReduxState(options.reduxState ?? {});
        const store = configureStore({
            reducer: (state = initialState) => state,
            middleware: getDefaultMiddleware =>
                getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
        });

        const routesPartial = options.routes ?? {};
        const routes: RoutesContextType = {
            ...defaultRoutesValue,
            dispatch: store.dispatch as RoutesContextType['dispatch'],
            selectedNFTCollection: buildNFTCollection(),
            ...routesPartial,
        };

        return render(
            <Provider store={store}>
                <Router history={history}>
                    <RoutesContext.Provider value={routes}>
                        <NFTCollection />
                    </RoutesContext.Provider>
                </Router>
            </Provider>,
        );
    }

    it('redirects home when no collection is selected', () => {
        renderPage({ routes: { selectedNFTCollection: null } });
        expect(replace).toHaveBeenCalledWith(DEFAULT_ROUTE);
    });

    it('renders collection name in the header', () => {
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ name: 'Doodles' }),
            },
        });
        expect(screen.getByTestId('header-title')).toHaveTextContent('Doodles');
    });

    it('uses fallback header title when name is missing', () => {
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ name: undefined as unknown as string }),
            },
        });
        expect(screen.getByTestId('header-title')).toHaveTextContent('NFT Collection');
    });

    it('renders NFT cards and invokes onAssetNFTPress with AA flag', async () => {
        const onAssetNFTPress = jest.fn();
        const n1 = buildNFT({ _id: 'a' });
        const n2 = buildNFT({ _id: 'b', nft_collection: { ...buildNFT().nft_collection, _id: 'coll-b' } });
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ items: [n1, n2] }),
                onAssetNFTPress,
                isAAWallet: true,
            },
        });

        await userEvent.click(screen.getByTestId('nft-card-a'));
        await userEvent.click(screen.getByTestId('nft-card-b'));
        expect(onAssetNFTPress).toHaveBeenCalledTimes(2);
        expect(onAssetNFTPress).toHaveBeenNthCalledWith(1, n1, true);
        expect(onAssetNFTPress).toHaveBeenNthCalledWith(2, n2, true);
    });

    it('shows empty state when all items are filtered out', () => {
        const spamNFT = buildNFT({
            _id: 'spam',
            nft_collection: {
                ...buildNFT().nft_collection,
                spam_score: 100,
                spamThreshold: 50,
            },
        });
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ items: [spamNFT] }),
                showHiddenNFTs: false,
            },
        });
        expect(screen.getByText('There are no NFTs')).toBeInTheDocument();
    });

    it('lists spam-marked NFTs when showHiddenNFTs is enabled', () => {
        const spamNFT = buildNFT({
            _id: 'spam',
            nft_collection: {
                ...buildNFT().nft_collection,
                spam_score: 100,
                spamThreshold: 50,
            },
        });
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ items: [spamNFT] }),
                showHiddenNFTs: true,
            },
        });
        expect(screen.getByTestId('nft-card-spam')).toBeInTheDocument();
    });

    it('respects nftCollectionsHideStatus from preferences', () => {
        const nft = buildNFT({ nft_collection: { ...buildNFT().nft_collection, _id: 'hid-coll' } });
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ items: [nft] }),
                showHiddenNFTs: false,
            },
            reduxState: {
                globalState: {
                    preferences: {
                        nftCollectionsHideStatus: { 'hid-coll': true },
                    },
                },
            },
        });
        expect(screen.getByText('There are no NFTs')).toBeInTheDocument();
    });

    it('respects nftsHideStatus from preferences', () => {
        const nft = buildNFT({ _id: 'hid-nft' });
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ items: [nft] }),
                showHiddenNFTs: false,
            },
            reduxState: {
                globalState: {
                    preferences: {
                        nftsHideStatus: { 'hid-nft': true },
                    },
                },
            },
        });
        expect(screen.getByText('There are no NFTs')).toBeInTheDocument();
    });

    it('opens explorer for the contract when using the header menu', async () => {
        renderPage();
        await userEvent.click(screen.getByTestId('context-item-View-Smart-Contract'));
        expect(openLink).toHaveBeenCalledWith(
            expect.stringMatching(/^https:\/\/.*\/address\/0xContractAddr$/),
            '_blank',
        );
    });

    it('omits header menu when there is no contract on items', () => {
        renderPage({
            routes: {
                selectedNFTCollection: buildNFTCollection({ items: [] }),
            },
        });
        expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });
});
