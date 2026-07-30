import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NFTPortfolio from '../../../src/ui/components/NFTPortfolio';

jest.mock('../../../src/ui/components/NFTCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: any) => (
        <button data-testid={`nft-${data._id}`} onClick={() => onPress(data)}>
            {data.name ?? 'nft'}
        </button>
    ),
    Placeholder: () => <div data-testid="nft-placeholder" />,
}));

jest.mock('../../../src/ui/components/NFTCollectionCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: any) => (
        <button data-testid={`col-${data._id}`} onClick={() => onPress(data)}>
            {data.name}
        </button>
    ),
}));

jest.mock('../../../src/ui/components/LoadMore', () => ({
    __esModule: true,
    default: () => <div data-testid="load-more" />,
}));

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ placeholder, menus }: any) => (
            <div>
                {placeholder}
                {menus}
            </div>
        ),
        ContextMenuItem: ({ title, onClick }: any) => (
            <button onClick={onClick}>{title}</button>
        ),
    };
});

let mockNfts: any[] = [];
let mockPreferences: any = { nftCollectionsHideStatus: {}, nftsHideStatus: {} };
jest.mock('../../../src/store/selectors', () => ({
    usePortfolioNfts: () => mockNfts,
    usePreferences: () => mockPreferences,
}));

let mockLoadNfts = jest.fn();
let mockWalletData: any = {
    loadNfts: mockLoadNfts,
    nftPagination: null,
    loadingMoreNfts: false,
};
jest.mock('../../../src/ui/pages/Home/WalletProvider', () => ({
    useWalletData: () => mockWalletData,
}));

let mockSetSelectedNFTCollection = jest.fn();
let mockSetIsAAWallet = jest.fn();
let mockSetShowHiddenNFTs = jest.fn();
let mockRoutesData: any = {
    setSelectedNFTCollection: mockSetSelectedNFTCollection,
    setIsAAWallet: mockSetIsAAWallet,
    setShowHiddenNFTs: mockSetShowHiddenNFTs,
};
jest.mock('../../../src/ui/pages/RoutesProvider', () => ({
    useRoutesData: () => mockRoutesData,
}));

let mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
    useHistory: () => ({ push: (...args: any[]) => mockHistoryPush(...args) }),
}));

let mockEventManagerOnCb: ((status: boolean) => void) | null = null;
let mockOffCalled = false;
jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        on: (_event: string, cb: (status: boolean) => void) => {
            mockEventManagerOnCb = cb;
        },
        off: () => {
            mockOffCalled = true;
        },
    },
}));

jest.mock('../../../src/shared/utils/nft', () => ({
    groupNFTs: (nfts: any[]) => ({ collections: nfts, individuals: nfts, all: nfts }),
    filterByHideStatus: (handled: any) => handled,
}));

jest.mock('../../../src/shared/constants/routes', () => ({
    ASSET_NFT_COLLECTION_ROUTE: '/nft',
}));

describe('NFTPortfolio', () => {
    beforeEach(() => {
        mockNfts = [];
        mockPreferences = { nftCollectionsHideStatus: {}, nftsHideStatus: {} };
        mockLoadNfts = jest.fn();
        mockSetSelectedNFTCollection = jest.fn();
        mockSetIsAAWallet = jest.fn();
        mockSetShowHiddenNFTs = jest.fn();
        mockHistoryPush = jest.fn();
        mockWalletData = {
            loadNfts: mockLoadNfts,
            nftPagination: null,
            loadingMoreNfts: false,
        };
        mockRoutesData = {
            setSelectedNFTCollection: mockSetSelectedNFTCollection,
            setIsAAWallet: mockSetIsAAWallet,
            setShowHiddenNFTs: mockSetShowHiddenNFTs,
        };
        mockEventManagerOnCb = null;
        mockOffCalled = false;
    });

    it('renders empty state when no NFTs', () => {
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        expect(screen.getByText('There are no NFTs')).toBeInTheDocument();
    });

    it('renders NFT collection cards when data exists', () => {
        mockNfts = [{ _id: 'c1', name: 'Col 1', items: [] }];
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        expect(screen.getByTestId('col-c1')).toBeInTheDocument();
    });

    it('switches to By NFT filter and renders NFTCards', () => {
        mockNfts = [{ _id: 'n1', name: 'NFT 1', items: [] }];
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        fireEvent.click(screen.getByText('By NFT'));
        expect(screen.getByTestId('nft-n1')).toBeInTheDocument();
    });

    it('switches to Show Hidden NFTs filter and renders collection cards', () => {
        mockNfts = [{ _id: 'h1', name: 'Hidden 1', items: [] }];
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        fireEvent.click(screen.getByText('Show Hidden NFTs'));
        expect(screen.getByTestId('col-h1')).toBeInTheDocument();
    });

    it('clicking collection card triggers routes data updates and history push', () => {
        mockNfts = [{ _id: 'c1', name: 'Col 1', items: [], hiddenStatus: 'visible' }];
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
                isAAWallet
            />,
        );
        fireEvent.click(screen.getByText('Col 1'));
        expect(mockSetIsAAWallet).toHaveBeenCalledWith(true);
        expect(mockSetSelectedNFTCollection).toHaveBeenCalled();
        expect(mockSetShowHiddenNFTs).toHaveBeenCalledWith(false);
        expect(mockHistoryPush).toHaveBeenCalledWith('/nft');
    });

    it('clicking NFTCard in by_nft view calls onNftPress with isAAWallet', () => {
        mockNfts = [{ _id: 'n1', name: 'NFT 1', items: [] }];
        const onNftPress = jest.fn();
        render(
            <NFTPortfolio
                onNftPress={onNftPress}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
                isAAWallet
            />,
        );
        fireEvent.click(screen.getByText('By NFT'));
        fireEvent.click(screen.getByTestId('nft-n1'));
        expect(onNftPress).toHaveBeenCalledWith(mockNfts[0], true);
    });

    it('loading status from eventManager renders placeholders', () => {
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        act(() => {
            mockEventManagerOnCb?.(true);
        });
        expect(screen.getAllByTestId('nft-placeholder').length).toBeGreaterThan(0);
    });

    it('unsubscribes from eventManager on unmount', () => {
        const { unmount } = render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        unmount();
        expect(mockOffCalled).toBe(true);
    });

    it('renders LoadMore when loadingMoreNfts is true', () => {
        mockNfts = [{ _id: 'c1', name: 'Col 1', items: [] }];
        mockWalletData = {
            loadNfts: mockLoadNfts,
            nftPagination: { hasNextPage: false, page: 1 },
            loadingMoreNfts: true,
        };
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        expect(screen.getByTestId('load-more')).toBeInTheDocument();
    });

    it('renders Load More NFTs button when hasNextPage and triggers loadNfts', () => {
        mockNfts = [{ _id: 'c1', name: 'Col 1', items: [] }];
        mockWalletData = {
            loadNfts: mockLoadNfts,
            nftPagination: { hasNextPage: true, page: 1 },
            loadingMoreNfts: false,
        };
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        const btn = screen.getByText('Load More NFTs');
        fireEvent.click(btn);
        expect(mockLoadNfts).toHaveBeenCalledWith(2);
    });

    it('handleLoadMore does nothing when no next page', () => {
        mockNfts = [{ _id: 'c1', name: 'Col 1', items: [] }];
        mockWalletData = {
            loadNfts: mockLoadNfts,
            nftPagination: { hasNextPage: false, page: 1 },
            loadingMoreNfts: false,
        };
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        expect(screen.queryByText('Load More NFTs')).toBeNull();
    });

    it('uses defaults when preferences returns empty object', () => {
        mockPreferences = {};
        mockNfts = [{ _id: 'c1', name: 'Col 1', items: [] }];
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        expect(screen.getByText('Col 1')).toBeInTheDocument();
    });

    it('Load More NFTs button uses page 1 when no current page', () => {
        mockNfts = [{ _id: 'c1', name: 'Col 1', items: [] }];
        mockWalletData = {
            loadNfts: mockLoadNfts,
            nftPagination: { hasNextPage: true },
            loadingMoreNfts: false,
        };
        render(
            <NFTPortfolio
                onNftPress={jest.fn()}
                setShowSpamNft={jest.fn()}
                showSpamNft={false}
                walletAddress="0x1"
                containerClass=""
            />,
        );
        fireEvent.click(screen.getByText('Load More NFTs'));
        expect(mockLoadNfts).toHaveBeenCalledWith(1);
    });
});
