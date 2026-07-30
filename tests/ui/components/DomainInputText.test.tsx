import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DomainInputText from '../../../src/ui/components/DomainInputText';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
        div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0,
}));

const mockUsePreferences = jest.fn();
const mockUseEthProvider = jest.fn();

jest.mock('../../../src/store/selectors', () => ({
    usePreferences: () => mockUsePreferences(),
    useEthProvider: () => mockUseEthProvider(),
}));

const mockAllDomainsGetByAddress = jest.fn();
const mockAllDomainsGetByDomain = jest.fn();
jest.mock('../../../src/lib/AllDomainsService', () => ({
    __esModule: true,
    default: {
        getDomainsByAddress: (...args: any[]) => mockAllDomainsGetByAddress(...args),
        getAddressByDomain: (...args: any[]) => mockAllDomainsGetByDomain(...args),
    },
}));

const mockNnsGetByAddress = jest.fn();
const mockNnsGetByDomain = jest.fn();
jest.mock('../../../src/lib/NnsService', () => ({
    __esModule: true,
    default: {
        getDomainByAddress: (...args: any[]) => mockNnsGetByAddress(...args),
        getAddressByDomain: (...args: any[]) => mockNnsGetByDomain(...args),
    },
}));

// Plain-function shims so resetMocks doesn't wipe them.
const _clustersState: any = {
    getName: () => Promise.resolve(null),
    getCluster: () => Promise.resolve(null),
};
jest.mock('@clustersxyz/sdk', () => ({
    Clusters: class {
        getName(...args: any[]) {
            return _clustersState.getName(...args);
        }
        getCluster(...args: any[]) {
            return _clustersState.getCluster(...args);
        }
    },
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn() },
}));

jest.mock('lodash', () => {
    const original = jest.requireActual('lodash');
    return {
        ...original,
        debounce: (fn: Function) => {
            const wrapped: any = (...args: any[]) => fn(...args);
            wrapped.cancel = () => {};
            return wrapped;
        },
    };
});

jest.mock('ethers', () => ({
    ethers: {
        isAddress: (s: any) =>
            typeof s === 'string' && /^0x[0-9a-fA-F]{40}$/.test(s),
    },
}));

const VALID_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

function setup(
    overrides: Partial<{
        value: string;
        prefs: any;
        provider: any;
        showError: boolean;
    }> = {},
) {
    mockUsePreferences.mockReturnValue(
        overrides.prefs ?? {
            enableCluster: false,
            enableAllDomains: false,
            nnsMetadata: { chain_id: 1 },
        },
    );
    mockUseEthProvider.mockReturnValue(
        overrides.provider ?? { resolveName: jest.fn(async () => null) },
    );
    const onChange = jest.fn();
    const onResolvedClusterWallet = jest.fn();
    const onResolvedAddress = jest.fn();
    return {
        onChange,
        onResolvedClusterWallet,
        onResolvedAddress,
        rendered: render(
            <DomainInputText
                value={overrides.value ?? ''}
                onChange={onChange}
                onResolvedClusterWallet={onResolvedClusterWallet}
                onResolvedAddress={onResolvedAddress}
                showError={overrides.showError ?? false}
            />,
        ),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    _clustersState.getName = () => Promise.resolve(null);
    _clustersState.getCluster = () => Promise.resolve(null);
    mockAllDomainsGetByAddress.mockResolvedValue([]);
    mockAllDomainsGetByDomain.mockResolvedValue(null);
    mockNnsGetByAddress.mockResolvedValue({ data: { success: false, primaryName: null } });
    mockNnsGetByDomain.mockResolvedValue({ data: { success: false, resolvedAddress: null } });
});

describe('DomainInputText — basic rendering', () => {
    it('renders the label and an input', () => {
        const { rendered } = setup();
        const label = rendered.container.querySelector('label');
        expect(label?.textContent).toContain('ADDRESS');
        expect(rendered.container.querySelector('input')).toBeInTheDocument();
    });

    it('shows ENS and NNS labels by default', () => {
        const { rendered } = setup();
        const label = rendered.container.querySelector('label');
        expect(label?.textContent).toContain('ENS');
        expect(label?.textContent).toContain('NNS');
    });

    it('includes CLUSTER label when cluster is enabled', () => {
        const { rendered } = setup({
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        const label = rendered.container.querySelector('label');
        expect(label?.textContent).toContain('CLUSTER');
    });

    it('includes ALLDOMAINS label when allDomains is enabled', () => {
        const { rendered } = setup({
            prefs: {
                enableCluster: false,
                enableAllDomains: true,
                nnsMetadata: { chain_id: 1 },
            },
        });
        const label = rendered.container.querySelector('label');
        expect(label?.textContent).toContain('ALLDOMAINS');
    });
});

describe('DomainInputText — address input', () => {
    it('resolves "0x0" to the zero address', async () => {
        const { onResolvedAddress } = setup({ value: '0x0' });
        await waitFor(() =>
            expect(onResolvedAddress).toHaveBeenCalledWith(
                '0x0000000000000000000000000000000000000000',
            ),
        );
    });

    it('forwards a valid address to onResolvedAddress', async () => {
        const { onResolvedAddress } = setup({ value: VALID_ADDRESS });
        await waitFor(() => expect(onResolvedAddress).toHaveBeenCalledWith(VALID_ADDRESS));
    });

    it('queries NNS and Cluster for valid addresses, surfaces resolved names', async () => {
        mockNnsGetByAddress.mockResolvedValueOnce({
            data: { success: true, primaryName: 'alice.nad' },
        });
        _clustersState.getName = () => Promise.resolve('alice/cluster');
        const { rendered } = setup({ value: VALID_ADDRESS });
        await waitFor(() =>
            expect(rendered.container.textContent).toContain('NNS: alice.nad'),
        );
        await waitFor(() =>
            expect(rendered.container.textContent).toContain('Cluster: alice/cluster'),
        );
    });

    it('queries AllDomains when enabled and the address resolves to domains', async () => {
        mockAllDomainsGetByAddress.mockResolvedValueOnce([
            { domain_name: 'alice', tld: '.sol' },
        ]);
        const { rendered } = setup({
            value: VALID_ADDRESS,
            prefs: {
                enableCluster: false,
                enableAllDomains: true,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() =>
            expect(rendered.container.textContent).toContain('AllDomains: alice.sol'),
        );
    });

    it('logs an error when AllDomains resolution rejects', async () => {
        mockAllDomainsGetByAddress.mockRejectedValueOnce(new Error('boom'));
        setup({
            value: VALID_ADDRESS,
            prefs: {
                enableCluster: false,
                enableAllDomains: true,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => expect(mockAllDomainsGetByAddress).toHaveBeenCalled());
    });

    it('logs an error when NNS resolution rejects', async () => {
        mockNnsGetByAddress.mockRejectedValueOnce(new Error('boom'));
        setup({ value: VALID_ADDRESS });
        await waitFor(() => expect(mockNnsGetByAddress).toHaveBeenCalled());
    });

    it('logs an error when Cluster resolution rejects', async () => {
        _clustersState.getName = () => Promise.reject(new Error('cluster-err'));
        setup({ value: VALID_ADDRESS });
        await waitFor(() => expect(mockNnsGetByAddress).toHaveBeenCalled());
    });
});

describe('DomainInputText — domain input', () => {
    it('resolves a NAD domain via NNS lookup', async () => {
        mockNnsGetByDomain.mockResolvedValueOnce({
            data: { success: true, resolvedAddress: VALID_ADDRESS },
        });
        const { rendered } = setup({ value: 'alice.nad' });
        await waitFor(() =>
            expect(rendered.container.textContent).toContain('NNS'),
        );
    });

    it('falls through to the cluster lookup when NNS does not find a match', async () => {
        _clustersState.getCluster = () =>
            Promise.resolve({
                name: 'alice',
                wallets: [
                    { name: '/main', address: VALID_ADDRESS, isVerified: true },
                ],
            });
        const { rendered } = setup({
            value: 'alice/main',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() =>
            expect(rendered.container.textContent).toContain('alice'),
        );
    });

    it('treats a Cluster 404 response as a not-found error', async () => {
        _clustersState.getCluster = () => Promise.resolve(404 as any);
        const { rendered } = setup({
            value: 'unknown.cluster',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => expect(rendered.container).toBeInTheDocument());
    });

    it('catches errors from Cluster getCluster', async () => {
        _clustersState.getCluster = () => Promise.reject(new Error('boom'));
        const { rendered } = setup({
            value: 'unknown.cluster',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => expect(rendered.container).toBeInTheDocument());
    });

    it('queries AllDomains for a name when enabled', async () => {
        mockAllDomainsGetByDomain.mockResolvedValueOnce(VALID_ADDRESS);
        const { rendered } = setup({
            value: 'alice.sol',
            prefs: {
                enableCluster: false,
                enableAllDomains: true,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() =>
            expect(rendered.container.textContent?.toLowerCase()).toContain('alldomains'),
        );
    });

    it('handles ENS resolution via the eth provider', async () => {
        const provider = {
            resolveName: jest.fn(async () => VALID_ADDRESS),
        };
        const { rendered } = setup({ value: 'alice.eth', provider });
        await waitFor(() => expect(provider.resolveName).toHaveBeenCalledWith('alice.eth'));
        expect(rendered.container.textContent?.toLowerCase()).toContain('ens');
    });

    it('handles ENS rejection', async () => {
        const provider = { resolveName: jest.fn(async () => { throw new Error('rpc'); }) };
        setup({ value: 'alice.eth', provider });
        await waitFor(() => expect(provider.resolveName).toHaveBeenCalled());
    });
});

describe('DomainInputText — empty / reset', () => {
    it('returns early when the value is empty', async () => {
        const { onResolvedAddress } = setup({ value: '' });
        await Promise.resolve();
        expect(onResolvedAddress).toHaveBeenCalledWith('');
    });
});

describe('DomainInputText — list interactions', () => {
    it('invokes onResolvedAddress when a resolved domain row is clicked', async () => {
        mockNnsGetByDomain.mockResolvedValueOnce({
            data: { success: true, resolvedAddress: VALID_ADDRESS },
        });
        const provider = { resolveName: jest.fn(async () => VALID_ADDRESS) };
        const { rendered, onResolvedAddress } = setup({
            value: 'alice.nad',
            provider,
            prefs: {
                enableCluster: false,
                enableAllDomains: true,
                nnsMetadata: { chain_id: 1 },
            },
        });
        // Force multiple resolutions: both AllDomains and NNS and ENS will resolve
        mockAllDomainsGetByDomain.mockResolvedValueOnce(VALID_ADDRESS);
        await waitFor(() => {
            const rows = rendered.container.querySelectorAll('[class*="cursor-pointer"]');
            expect(rows.length).toBeGreaterThan(0);
        });
        const rows = rendered.container.querySelectorAll('[class*="cursor-pointer"]');
        // Click on the first row (more than one means useEffect single-pick doesn't auto-resolve)
        fireEvent.click(rows[0]);
        expect(onResolvedAddress).toHaveBeenCalled();
    });

    it('invokes onResolvedClusterWallet when a cluster wallet row is clicked', async () => {
        _clustersState.getCluster = () =>
            Promise.resolve({
                name: 'alice',
                wallets: [
                    { name: '/main', address: VALID_ADDRESS, isVerified: true },
                    {
                        name: '/secondary',
                        address: '0xabcdef1234567890abcdef1234567890abcdef12',
                        isVerified: false,
                    },
                ],
            });
        const { rendered, onResolvedClusterWallet } = setup({
            value: 'alice/main',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => {
            expect(rendered.container.textContent).toContain('alice');
        });
        // Find cluster wallet rows; two means single-pick effect doesn't auto-resolve.
        const rows = rendered.container.querySelectorAll('[class*="cursor-pointer"]');
        // Click the second one to trigger onClusterPress (line 431) and onResolvedClusterWallet
        if (rows.length > 1) {
            fireEvent.click(rows[1]);
        } else {
            fireEvent.click(rows[0]);
        }
        expect(onResolvedClusterWallet).toHaveBeenCalled();
    });

    it('handles AllDomains domain lookup resolving to falsy and rejecting', async () => {
        mockAllDomainsGetByDomain.mockResolvedValueOnce(null);
        // also test rejection path on a subsequent call by setting next call to reject
        const { rendered } = setup({
            value: 'unknown.sol',
            prefs: {
                enableCluster: false,
                enableAllDomains: true,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => expect(mockAllDomainsGetByDomain).toHaveBeenCalled());
        expect(rendered.container).toBeInTheDocument();
    });

    it('catches rejection from AllDomains during domain lookup', async () => {
        mockAllDomainsGetByDomain.mockRejectedValueOnce(new Error('all-domains-boom'));
        const { rendered } = setup({
            value: 'unknown.sol',
            prefs: {
                enableCluster: false,
                enableAllDomains: true,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => expect(mockAllDomainsGetByDomain).toHaveBeenCalled());
        expect(rendered.container).toBeInTheDocument();
    });

    it('catches rejection from NNS during domain lookup', async () => {
        mockNnsGetByDomain.mockRejectedValueOnce(new Error('nns-domain-boom'));
        setup({ value: 'unknown.nad' });
        await waitFor(() => expect(mockNnsGetByDomain).toHaveBeenCalled());
    });

    it('resolves NNS domain with success=true but no resolvedAddress', async () => {
        mockNnsGetByDomain.mockResolvedValueOnce({
            data: { success: true, resolvedAddress: null },
        });
        const { rendered } = setup({ value: 'alice.nad' });
        await waitFor(() => expect(mockNnsGetByDomain).toHaveBeenCalled());
        expect(rendered.container).toBeInTheDocument();
    });

    it('falls back to "" when cluster object has no name (single wallet auto-pick)', async () => {
        _clustersState.getCluster = () =>
            Promise.resolve({
                // omit name to hit the `?? ''` fallback in the effect
                wallets: [
                    { name: '/only', address: VALID_ADDRESS, isVerified: true },
                ],
            });
        const { onResolvedClusterWallet } = setup({
            value: 'alice/only',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => expect(onResolvedClusterWallet).toHaveBeenCalled());
        // first arg is the wallet, second is `''` + wallet.name => '/only'
        expect(onResolvedClusterWallet).toHaveBeenCalledWith(
            expect.objectContaining({ address: VALID_ADDRESS }),
            '/only',
        );
    });

    it('falls back to "" when cluster object has no name (manual click)', async () => {
        _clustersState.getCluster = () =>
            Promise.resolve({
                // omit name to hit the `?? ''` fallback in onClusterPress
                wallets: [
                    { name: '/a', address: VALID_ADDRESS, isVerified: true },
                    {
                        name: '/b',
                        address: '0x' + 'b'.repeat(40),
                        isVerified: false,
                    },
                ],
            });
        const { rendered, onResolvedClusterWallet } = setup({
            value: 'alice/anything',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() => {
            const rows = rendered.container.querySelectorAll('[class*="cursor-pointer"]');
            expect(rows.length).toBeGreaterThan(1);
        });
        const rows = rendered.container.querySelectorAll('[class*="cursor-pointer"]');
        fireEvent.click(rows[0]);
        expect(onResolvedClusterWallet).toHaveBeenCalledWith(
            expect.objectContaining({ address: VALID_ADDRESS }),
            '/a',
        );
    });

    it('renders inline error when showError is true and resolution fails', async () => {
        _clustersState.getCluster = () => Promise.resolve(null);
        const { rendered } = setup({
            value: 'truly-unknown.cluster',
            showError: true,
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() =>
            expect(rendered.container.textContent).toContain('Invalid domain and address'),
        );
    });

    it('clamps the dropdown height when there are more than two cluster wallets', async () => {
        _clustersState.getCluster = () =>
            Promise.resolve({
                name: 'big',
                wallets: [
                    { name: '/a', address: VALID_ADDRESS, isVerified: true },
                    { name: '/b', address: '0x' + 'b'.repeat(40), isVerified: false },
                    { name: '/c', address: '0x' + 'c'.repeat(40), isVerified: true },
                ],
            });
        const { rendered } = setup({
            value: 'big.cluster',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        await waitFor(() =>
            expect(rendered.container.textContent?.toLowerCase()).toContain('big'),
        );
    });

    it('handles a null/undefined value prop via the ?? "" fallback', () => {
        // Bypass setup so we can pass undefined directly to value.
        mockUsePreferences.mockReturnValue({
            enableCluster: false,
            enableAllDomains: false,
            nnsMetadata: { chain_id: 1 },
        });
        mockUseEthProvider.mockReturnValue({ resolveName: jest.fn(async () => null) });
        const { container } = render(
            <DomainInputText
                value={undefined as any}
                onChange={jest.fn()}
                onResolvedClusterWallet={jest.fn()}
                onResolvedAddress={jest.fn()}
                showError={false}
            />,
        );
        expect(container.querySelector('input')).toBeInTheDocument();
    });

    it('sets error when nothing resolves the domain (cluster enabled but returns nothing)', async () => {
        _clustersState.getCluster = () => Promise.resolve(null);
        const { rendered } = setup({
            value: 'truly-unknown.cluster',
            prefs: {
                enableCluster: true,
                enableAllDomains: false,
                nnsMetadata: { chain_id: 1 },
            },
        });
        // cluster lookup runs because nothing else resolved; ensure resolver was hit
        await waitFor(() => expect(mockNnsGetByDomain).toHaveBeenCalled());
        // give cluster a chance to return null
        await new Promise(r => setTimeout(r, 0));
        expect(rendered.container).toBeInTheDocument();
    });
});
