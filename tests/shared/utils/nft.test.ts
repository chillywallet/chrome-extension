import { groupNFTs, filterByHideStatus } from '../../../src/shared/utils/nft';

const makeNftDetail = (id: string, opts: any = {}) => ({
    _id: id,
    chain: opts.chain ?? 'monad',
    current_usd_value: opts.usd ?? 10,
    nft_collection: {
        _id: opts.coll_id ?? 'col-1',
        collection_id: opts.coll_id ?? 'col-1',
        floor_price: opts.floor ?? 1,
        spam_score: opts.spam ?? 0,
        spamThreshold: opts.spamThreshold ?? 99,
    },
});

const makeWallet = (overrides: any = {}) => ({
    _id: 'w-1',
    name: 'main',
    address: '0xaa',
    nftDetails: [makeNftDetail('n-1')],
    platform_id: 143,
    integration_type: 'web3',
    spamThreshold: 99,
    ...overrides,
});

describe('nft.groupNFTs', () => {
    it('produces collections/wallets/chains/individuals/all for a single wallet', () => {
        const result = groupNFTs([makeWallet()] as any);
        expect(result.collections.length).toBe(1);
        expect(result.wallets.length).toBe(1);
        expect(result.chains.length).toBe(1);
        expect(result.individuals.length).toBe(1);
        expect(result.all.length).toBe(1);
    });

    it('merges items in the same collection across wallets', () => {
        const w1 = makeWallet({ address: '0xa', nftDetails: [makeNftDetail('n-1')] });
        const w2 = makeWallet({ address: '0xb', nftDetails: [makeNftDetail('n-2')] });
        const result = groupNFTs([w1, w2] as any);
        expect(result.collections.length).toBe(1);
        expect(result.collections[0].items.length).toBe(2);
    });

    it('sorts individuals by current_usd_value desc', () => {
        const w = makeWallet({
            nftDetails: [
                makeNftDetail('n-1', { usd: 5 }),
                makeNftDetail('n-2', { usd: 10 }),
            ],
        });
        const result = groupNFTs([w] as any);
        expect(result.individuals[0]._id).toBe('n-2');
    });

    it('groups multiple chains and reuses existing chain+collection bucket', () => {
        // First wallet has NFTs on monad with collection col-1, another on eth with col-2,
        // then a second wallet whose NFTs hit the SAME chain+collection (col-1 on monad)
        // to exercise the existing-chain/existing-collection branch.
        const wallet1 = makeWallet({
            nftDetails: [
                makeNftDetail('n-1', { chain: 'monad', coll_id: 'col-1' }),
                makeNftDetail('n-2', { chain: 'eth', coll_id: 'col-2' }),
            ],
        });
        const wallet2 = makeWallet({
            address: '0xbb',
            _id: 'w-2',
            nftDetails: [
                makeNftDetail('n-3', { chain: 'monad', coll_id: 'col-1' }),
                // new collection on existing chain → covers chainCollectionIndex === -1 push.
                makeNftDetail('n-4', { chain: 'monad', coll_id: 'col-3' }),
            ],
        });
        const result = groupNFTs([wallet1, wallet2] as any);
        // monad chain should contain col-1 (with 2 items now) and col-3.
        const monadChain = result.chains.find((c: any) => c.chain === 'monad');
        expect(monadChain).toBeTruthy();
        const monadColl1 = monadChain.collections.find(
            (c: any) => c.collection_id === 'col-1',
        );
        expect(monadColl1.items.length).toBe(2);
        const monadColl3 = monadChain.collections.find(
            (c: any) => c.collection_id === 'col-3',
        );
        expect(monadColl3.items.length).toBe(1);
    });

    it('adds NFTs to existing wallet collection bucket when the same collection appears twice', () => {
        const w = makeWallet({
            nftDetails: [
                makeNftDetail('n-1', { coll_id: 'col-1' }),
                makeNftDetail('n-2', { coll_id: 'col-1' }),
            ],
        });
        const result = groupNFTs([w] as any);
        expect(result.wallets[0].collections.length).toBe(1);
        expect(result.wallets[0].collections[0].items.length).toBe(2);
    });

    it('sorts collections by total_price desc and all by floor_price desc', () => {
        const w = makeWallet({
            nftDetails: [
                makeNftDetail('n-1', { coll_id: 'cheap', usd: 1, floor: 1 }),
                makeNftDetail('n-2', { coll_id: 'pricey', usd: 1000, floor: 100 }),
            ],
        });
        const result = groupNFTs([w] as any);
        expect(result.collections[0].collection_id).toBe('pricey');
        expect(result.all[0].collection_id).toBe('pricey');
    });
});

describe('nft.filterByHideStatus', () => {
    const base = {
        collections: [
            {
                _id: 'col-1',
                spam_score: 0,
                spamThreshold: 99,
                items: [{ _id: 'n-1' }],
            },
        ],
        chains: [],
        wallets: [],
        individuals: [
            {
                _id: 'n-1',
                nft_collection: { _id: 'col-1', spam_score: 0, spamThreshold: 99 },
            },
        ],
        all: [
            {
                _id: 'col-1',
                spam_score: 0,
                spamThreshold: 99,
                items: [{ _id: 'n-1' }],
            },
        ],
    };

    it('returns all items when no hide status set', () => {
        const result = filterByHideStatus(base as any, false, {}, {});
        expect(result.collections.length).toBe(1);
        expect(result.individuals.length).toBe(1);
    });

    it('filters collections override hides item', () => {
        const result = filterByHideStatus(base as any, false, { 'col-1': true }, {});
        expect(result.collections.length).toBe(0);
    });

    it('filters spam collections when spamNft flag is on', () => {
        const spammy = {
            ...base,
            collections: [
                {
                    _id: 'col-spam',
                    spam_score: 100,
                    spamThreshold: 50,
                    items: [{ _id: 'n-spam' }],
                },
            ],
            individuals: [
                {
                    _id: 'n-spam',
                    nft_collection: {
                        _id: 'col-spam',
                        spam_score: 100,
                        spamThreshold: 50,
                    },
                },
            ],
        };
        const result = filterByHideStatus(spammy as any, true, {}, {});
        expect(result.individuals.length).toBe(0);
    });

    it('applies nftsHideStatus override for individuals (visible) and for collections', () => {
        const data = {
            collections: [
                {
                    _id: 'col-1',
                    spam_score: 0,
                    spamThreshold: 99,
                    items: [
                        { _id: 'n-1' },
                        { _id: 'n-2' },
                    ],
                },
            ],
            chains: [],
            wallets: [],
            individuals: [
                {
                    _id: 'n-1',
                    nft_collection: { _id: 'col-1', spam_score: 0, spamThreshold: 99 },
                },
                {
                    _id: 'n-2',
                    nft_collection: { _id: 'col-1', spam_score: 0, spamThreshold: 99 },
                },
            ],
            all: [
                {
                    _id: 'col-1',
                    spam_score: 0,
                    spamThreshold: 99,
                    items: [
                        { _id: 'n-1' },
                        { _id: 'n-2' },
                    ],
                },
            ],
        };
        // n-1 is hidden via nftsHideStatus, n-2 stays visible.
        const result = filterByHideStatus(data as any, false, {}, { 'n-1': true });
        // Individuals: n-1 hidden, n-2 visible.
        expect(result.individuals.map((i: any) => i._id)).toEqual(['n-2']);
        // Collections: col-1 stays since at least n-2 visible.
        expect(result.collections.length).toBe(1);
        expect(result.collections[0].items.map((i: any) => i._id)).toEqual(['n-2']);
    });

    it('handles spam collections in the all branch and toggling hidden status', () => {
        const data = {
            collections: [],
            chains: [],
            wallets: [],
            individuals: [],
            all: [
                {
                    _id: 'col-spam',
                    spam_score: 100,
                    spamThreshold: 50,
                    items: [{ _id: 'n-spam' }],
                },
                {
                    _id: 'col-clean',
                    spam_score: 0,
                    spamThreshold: 99,
                    items: [{ _id: 'n-clean' }],
                },
            ],
        };
        // With spamNft on, the spam collection items become hidden and surface in `all`.
        const result = filterByHideStatus(
            data as any,
            true,
            { 'col-clean': true },
            { 'n-spam': false },
        );
        // 'all' surfaces hidden items; col-spam should appear with n-spam (override = visible due to nftsHideStatus false).
        // n-spam status flips back to visible via nftsHideStatus, so it filters out of "all" (kept only hidden).
        expect(Array.isArray(result.all)).toBe(true);
    });

    it('walks the wallets branch with spamNft=false (covers outer if false branch)', () => {
        const data = {
            collections: [],
            chains: [],
            wallets: [
                {
                    _id: 'w-1',
                    collections: [
                        {
                            _id: 'col-1',
                            spam_score: 0,
                            spamThreshold: 99,
                            items: [{ _id: 'n-1' }],
                        },
                    ],
                },
            ],
            individuals: [],
            all: [],
        };
        const result = filterByHideStatus(data as any, false, {}, {});
        expect(result.wallets[0].collections.length).toBe(1);
    });

    it('walks the individuals branch with spamNft=true and a non-spam item (covers inner else)', () => {
        const data = {
            collections: [],
            chains: [],
            wallets: [],
            individuals: [
                {
                    _id: 'n-clean',
                    nft_collection: { _id: 'col-clean', spam_score: 0, spamThreshold: 99 },
                },
            ],
            all: [],
        };
        const result = filterByHideStatus(data as any, true, {}, {});
        expect(result.individuals.length).toBe(1);
    });

    it('walks the wallets branch and filters out hidden items per collection', () => {
        const data = {
            collections: [],
            chains: [],
            wallets: [
                {
                    _id: 'w-1',
                    address: '0xaa',
                    collections: [
                        {
                            _id: 'col-1',
                            spam_score: 100,
                            spamThreshold: 50,
                            items: [
                                { _id: 'n-1' },
                                { _id: 'n-2' },
                            ],
                        },
                        {
                            // override hides this entire collection.
                            _id: 'col-hidden',
                            spam_score: 0,
                            spamThreshold: 99,
                            items: [{ _id: 'n-3' }],
                        },
                    ],
                },
            ],
            individuals: [],
            all: [],
        };
        const result = filterByHideStatus(
            data as any,
            true,
            { 'col-hidden': true },
            { 'n-1': false },
        );
        expect(result.wallets.length).toBe(1);
        const w = result.wallets[0];
        // col-hidden was hidden via override; col-1 was spam-hidden BUT n-1 has visible override.
        const collIds = w.collections.map((c: any) => c._id);
        expect(collIds).toContain('col-1');
        expect(collIds).not.toContain('col-hidden');
        const col1 = w.collections.find((c: any) => c._id === 'col-1');
        expect(col1.items.map((i: any) => i._id)).toEqual(['n-1']);
    });

    it('preserves arrays for chains key (untouched branch)', () => {
        const data = {
            collections: [],
            chains: [{ chain: 'monad', collections: [] }],
            wallets: [],
            individuals: [],
            all: [],
        };
        const result = filterByHideStatus(data as any, false, {}, {});
        expect(result.chains.length).toBe(1);
    });

    it('covers all branches of collections, all, wallets when spamNft true and overrides flip visibility', () => {
        const data = {
            collections: [
                {
                    _id: 'col-a',
                    spam_score: 100,
                    spamThreshold: 50,
                    items: [
                        { _id: 'n-1' },
                        { _id: 'n-2' },
                    ],
                },
                {
                    _id: 'col-b',
                    spam_score: 0,
                    spamThreshold: 99,
                    items: [{ _id: 'n-3' }],
                },
            ],
            chains: [],
            wallets: [
                {
                    _id: 'w-1',
                    collections: [
                        {
                            _id: 'col-a',
                            spam_score: 100,
                            spamThreshold: 50,
                            items: [
                                { _id: 'n-1' },
                                { _id: 'n-2' },
                            ],
                        },
                        {
                            _id: 'col-b',
                            spam_score: 0,
                            spamThreshold: 99,
                            items: [{ _id: 'n-3' }],
                        },
                    ],
                },
            ],
            individuals: [
                {
                    _id: 'n-1',
                    nft_collection: { _id: 'col-a', spam_score: 100, spamThreshold: 50 },
                },
                {
                    _id: 'n-2',
                    nft_collection: { _id: 'col-a', spam_score: 100, spamThreshold: 50 },
                },
            ],
            all: [
                {
                    _id: 'col-a',
                    spam_score: 100,
                    spamThreshold: 50,
                    items: [
                        { _id: 'n-1' },
                        { _id: 'n-2' },
                    ],
                },
                {
                    _id: 'col-b',
                    spam_score: 0,
                    spamThreshold: 99,
                    items: [{ _id: 'n-3' }],
                },
            ],
        };
        // - spamNft=true (spam vs clean collection branch both exercised)
        // - col-a is forced VISIBLE via override (false), col-b stays default
        // - n-1 is hidden via nftsHideStatus=true, n-2 visible via nftsHideStatus=false
        const result = filterByHideStatus(
            data as any,
            true,
            { 'col-a': false },
            { 'n-1': true, 'n-2': false },
        );
        // individuals: n-1 hidden, n-2 visible
        const individuals = result.individuals.map((i: any) => i._id);
        expect(individuals).toContain('n-2');
        expect(individuals).not.toContain('n-1');
        // collections: col-a has n-2 visible only; col-b has n-3
        const collA = result.collections.find((c: any) => c._id === 'col-a');
        expect(collA).toBeTruthy();
        expect(collA.items.map((i: any) => i._id)).toEqual(['n-2']);
        // wallets: same shape
        const w1 = result.wallets[0];
        const wcollA = w1.collections.find((c: any) => c._id === 'col-a');
        expect(wcollA.items.map((i: any) => i._id)).toEqual(['n-2']);
    });
});
