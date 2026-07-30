import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NFTCollectionCard, { Placeholder } from '../../../src/ui/components/NFTCollectionCard';

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ src }: { src?: string }) => <img data-testid="safe-image" data-src={src ?? ''} />,
}));

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ menus }: { menus: React.ReactNode }) => (
            <div data-testid="ctx-menu">{menus}</div>
        ),
        ContextMenuItem: ({ title, onClick }: { title: string; onClick: () => void }) => (
            <button data-testid={`ctx-${title.replace(/\s+/g, '-').toLowerCase()}`} onClick={onClick}>
                {title}
            </button>
        ),
    };
});

jest.mock('../../../src/lib/ChainsUtils', () => ({
    CURRENT_CHAINS: [{ chain_key: 'eth', testnet: false }],
}));

const mockDispatch = jest.fn(() => Promise.resolve());
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

let mockPreferences: any = { nftsHideStatus: {}, nftCollectionsHideStatus: {} };
jest.mock('../../../src/store/selectors', () => ({
    usePreferences: () => mockPreferences,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    setNftCollectionsHideStatus: (v: any) => ({ type: 'SET_COL_HIDE', payload: v }),
    setNftsHideStatus: (v: any) => ({ type: 'SET_NFT_HIDE', payload: v }),
}));

const baseCollection: any = {
    _id: 'col-1',
    name: 'My Collection',
    image_url: 'collection.png',
    platform_id: 1,
    items: [
        {
            _id: 'nft-1',
            chain: 'eth',
            image_url: 'item.png',
            previews: { image_small_url: 'small.png' },
            nft_collection: { _id: 'col-1', spam_score: 0, spamThreshold: 100 },
        },
    ],
};

describe('NFTCollectionCard', () => {
    beforeEach(() => {
        mockPreferences = { nftsHideStatus: {}, nftCollectionsHideStatus: {} };
        jest.clearAllMocks();
        mockDispatch.mockImplementation(() => Promise.resolve());
    });

    it('Placeholder renders', () => {
        const { container } = render(<Placeholder />);
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('renders the collection name and count', () => {
        render(<NFTCollectionCard data={baseCollection} onPress={jest.fn()} />);
        expect(screen.getByText('My Collection')).toBeInTheDocument();
        expect(screen.getByText(/Collected/)).toBeInTheDocument();
    });

    it('triggers onPress when card is clicked', () => {
        const onPress = jest.fn();
        render(<NFTCollectionCard data={baseCollection} onPress={onPress} />);
        fireEvent.click(screen.getByText('My Collection'));
        expect(onPress).toHaveBeenCalledWith(baseCollection);
    });

    it('renders Hide context menu when status is visible', () => {
        render(<NFTCollectionCard data={baseCollection} onPress={jest.fn()} />);
        expect(screen.getByTestId('ctx-hide-this-collection')).toBeInTheDocument();
    });

    it('renders Show context menu when hidden', () => {
        render(
            <NFTCollectionCard
                data={baseCollection}
                onPress={jest.fn()}
                hiddenStatus="hidden"
                showHiddenStatus
            />,
        );
        expect(screen.getByTestId('ctx-show-this-collection')).toBeInTheDocument();
        expect(screen.getByText('Hidden')).toBeInTheDocument();
    });

    it('clicking Hide dispatches setNftCollectionsHideStatus and setNftsHideStatus', async () => {
        mockPreferences = {
            nftsHideStatus: { 'nft-1': true },
            nftCollectionsHideStatus: {},
        };
        render(<NFTCollectionCard data={baseCollection} onPress={jest.fn()} />);
        await act(async () => {
            fireEvent.click(screen.getByTestId('ctx-hide-this-collection'));
        });
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'SET_COL_HIDE',
                payload: expect.objectContaining({ 'col-1': true }),
            }),
        );
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'SET_NFT_HIDE',
            }),
        );
    });

    it('clicking Show dispatches setNftCollectionsHideStatus false', async () => {
        mockPreferences = {
            nftsHideStatus: { 'nft-1': true },
            nftCollectionsHideStatus: { 'col-1': true },
        };
        render(
            <NFTCollectionCard
                data={baseCollection}
                onPress={jest.fn()}
                hiddenStatus="hidden"
                showHiddenStatus
            />,
        );
        await act(async () => {
            fireEvent.click(screen.getByTestId('ctx-show-this-collection'));
        });
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'SET_COL_HIDE',
                payload: expect.objectContaining({ 'col-1': false }),
            }),
        );
    });

    it('uses item.image_url for thumbnail when collection image_url is null', () => {
        const noImgCollection = { ...baseCollection, image_url: null };
        render(<NFTCollectionCard data={noImgCollection} onPress={jest.fn()} />);
        const img = screen.getByTestId('safe-image');
        expect(img).toHaveAttribute('data-src', 'item.png');
    });

    it('falls back to previews.image_small_url when item.image_url is missing', () => {
        const collection = {
            ...baseCollection,
            image_url: null,
            items: [
                {
                    _id: 'nft-1',
                    chain: 'eth',
                    image_url: null,
                    previews: { image_small_url: 'small.png' },
                    nft_collection: { _id: 'col-1', spam_score: 0, spamThreshold: 100 },
                },
            ],
        };
        render(<NFTCollectionCard data={collection} onPress={jest.fn()} />);
        const img = screen.getByTestId('safe-image');
        expect(img).toHaveAttribute('data-src', 'small.png');
    });

    it('filters items by spam_score threshold', () => {
        const spammyCollection = {
            ...baseCollection,
            items: [
                {
                    _id: 'nft-spam',
                    chain: 'eth',
                    image_url: 'spam.png',
                    previews: { image_small_url: 'spam-s.png' },
                    nft_collection: { _id: 'col-spam', spam_score: 200, spamThreshold: 100 },
                },
            ],
        };
        render(<NFTCollectionCard data={spammyCollection} onPress={jest.fn()} />);
        expect(screen.getByText('Collected 0')).toBeInTheDocument();
    });

    it('overrides spam filter via nftCollectionsHideStatus visible (false)', () => {
        mockPreferences = {
            nftsHideStatus: {},
            nftCollectionsHideStatus: { 'col-spam': false },
        };
        const collection = {
            ...baseCollection,
            items: [
                {
                    _id: 'nft-spam',
                    chain: 'eth',
                    image_url: 'spam.png',
                    previews: { image_small_url: 'spam-s.png' },
                    nft_collection: { _id: 'col-spam', spam_score: 200, spamThreshold: 100 },
                },
            ],
        };
        render(<NFTCollectionCard data={collection} onPress={jest.fn()} />);
        expect(screen.getByText('Collected 1')).toBeInTheDocument();
    });

    it('overrides item visibility via nftsHideStatus', () => {
        mockPreferences = {
            nftsHideStatus: { 'nft-1': true },
            nftCollectionsHideStatus: {},
        };
        render(<NFTCollectionCard data={baseCollection} onPress={jest.fn()} />);
        expect(screen.getByText('Collected 0')).toBeInTheDocument();
    });

    it('uses default empty objects when preferences returns no keys', () => {
        mockPreferences = {};
        render(<NFTCollectionCard data={baseCollection} onPress={jest.fn()} />);
        expect(screen.getByText('My Collection')).toBeInTheDocument();
    });

    it('renders default "NFT" thumbnail when no thumbnail is available', () => {
        const noThumb = {
            ...baseCollection,
            image_url: null,
            items: [
                {
                    _id: 'nft-1',
                    chain: 'eth',
                    image_url: null,
                    previews: { image_small_url: null },
                    nft_collection: { _id: 'col-1', spam_score: 0, spamThreshold: 100 },
                },
            ],
        };
        render(<NFTCollectionCard data={noThumb} onPress={jest.fn()} />);
        // No SafeImage rendered when thumbnail is null
        expect(screen.queryByTestId('safe-image')).toBeNull();
        // The "NFT" placeholder text appears in the thumbnail spot
        expect(screen.getAllByText('NFT').length).toBeGreaterThan(0);
    });

    it('in hidden mode, only shows items that are hidden', () => {
        mockPreferences = {
            nftsHideStatus: { 'nft-1': true },
            nftCollectionsHideStatus: {},
        };
        render(
            <NFTCollectionCard
                data={baseCollection}
                onPress={jest.fn()}
                hiddenStatus="hidden"
                showHiddenStatus
            />,
        );
        expect(screen.getByText('Collected 1')).toBeInTheDocument();
    });
});
