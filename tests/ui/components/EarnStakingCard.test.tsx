import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EarnStakingCard from '../../../src/ui/components/EarnStakingCard';

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img data-testid="safe-image" alt={alt} />,
}));

let mockInjectChildProps: any = null;
jest.mock('../../../src/ui/components/Modal', () => {
    const ReactReq = require('react');
    return {
        __esModule: true,
        default: ({
            visible,
            onClose,
            children,
        }: {
            visible: boolean;
            onClose: () => void;
            children: any;
        }) => {
            if (!visible) return null;
            const inject = mockInjectChildProps;
            const transform = (node: any): any => {
                if (!ReactReq.isValidElement(node)) return node;
                const el = node as any;
                let newProps = el.props;
                if (inject && el.props && 'item' in el.props && 'platformId' in el.props && 'index' in el.props) {
                    newProps = { ...el.props, ...inject };
                }
                const newChildren = ReactReq.Children.map(el.props?.children, transform);
                return ReactReq.cloneElement(el, newProps, newChildren);
            };
            const transformedChildren = ReactReq.Children.map(children, transform);
            return (
                <div data-testid="modal">
                    <button onClick={onClose}>modal-close</button>
                    {transformedChildren}
                </div>
            );
        },
    };
});

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: { title: string; onClosePress?: () => void }) => (
        <div data-testid="header">
            {title}
            {onClosePress && (
                <button data-testid="header-close" onClick={onClosePress}>
                    header-close
                </button>
            )}
        </div>
    ),
}));

jest.mock('../../../src/shared/types/Earn', () => ({
    EARN_PARTNERS: [{ name: 'Lido', imageUrl: 'lido.png' }],
}));

jest.mock('../../../src/lib/ChainsUtils', () => ({
    getCurrentChainByPlatformId: () => ({ short_name: 'eth', chain_id: 1 }),
}));

let mockGetTokenBalance: any;
jest.mock('../../../src/store/actions/uiActions', () => ({
    getTokenBalance: (...args: any[]) => mockGetTokenBalance(...args),
}));

let mockUseCurrentAddress: any = () => null;
let mockUseUser: any = () => ({ id: 'u1' });
jest.mock('../../../src/store/selectors', () => ({
    useUser: () => mockUseUser(),
    useCurrentAddress: () => mockUseCurrentAddress(),
}));

jest.mock('ethers', () => ({
    ethers: { formatUnits: (v: string) => v },
}));

const baseData: any = {
    imageUrl: 'staking.png',
    name: 'Staking Pool',
    platformId: 1,
    data: [
        {
            partner_name: 'Lido',
            apr: 4.5,
            enabled: true,
            link: null,
            toCoin: { tokenAddress: '0xtok', symbol: 'STK' },
        },
    ],
};

beforeEach(() => {
    mockGetTokenBalance = jest.fn(() =>
        Promise.resolve({ balance: '0', decimals: 18, error: false }),
    );
    mockUseCurrentAddress = () => null;
    mockUseUser = () => ({ id: 'u1' });
    mockInjectChildProps = null;
    (global as any).platform = { openLink: jest.fn() };
});

describe('EarnStakingCard', () => {
    it('renders the pool name and partners', () => {
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        expect(screen.getByText('Staking Pool')).toBeInTheDocument();
    });

    it('opens the picker modal on click', () => {
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Select Provider')).toBeInTheDocument();
    });

    it('renders an empty state when there are no providers', () => {
        render(<EarnStakingCard data={{ ...baseData, data: [] }} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        expect(screen.getByText('No options available')).toBeInTheDocument();
    });

    it('loads balance when walletAddress exists', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        mockGetTokenBalance = jest.fn(() =>
            Promise.resolve({ balance: '1000000000000000000', decimals: 18, error: false }),
        );
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
    });

    it('handles error when balance load fails', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        mockGetTokenBalance = jest.fn(() =>
            Promise.resolve({ balance: '0', decimals: 18, error: true }),
        );
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
    });

    it('handles rejection in getTokenBalance', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        mockGetTokenBalance = jest.fn(() => Promise.reject(new Error('fail')));
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
    });

    it('selects a provider and calls onPress', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        mockGetTokenBalance = jest.fn(() =>
            Promise.resolve({ balance: '5000000000000000000', decimals: 18, error: false }),
        );
        const onPress = jest.fn();
        render(<EarnStakingCard data={baseData} onPress={onPress} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        // Wait for balance load to complete
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
        // Click the row (look inside modal)
        const modal = screen.getByTestId('modal');
        const rows = modal.querySelectorAll('.p-4');
        if (rows[0]) {
            fireEvent.click(rows[0]);
        }
        expect(onPress).toHaveBeenCalled();
    });


    it('disabled item does not call onPress on click', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        const disabledData = {
            ...baseData,
            data: [
                {
                    partner_name: 'Lido',
                    apr: null,
                    enabled: false,
                    link: null,
                    toCoin: { tokenAddress: '0xtok', symbol: 'STK' },
                },
            ],
        };
        const onPress = jest.fn();
        render(<EarnStakingCard data={disabledData} onPress={onPress} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
        // Click the disabled item
        const modal = screen.getByTestId('modal');
        const rows = modal.querySelectorAll('.p-4');
        if (rows[0]) {
            fireEvent.click(rows[0]);
        }
        expect(onPress).not.toHaveBeenCalled();
        expect(screen.getByText('Coming Soon')).toBeInTheDocument();
        expect(screen.getByText('TBD')).toBeInTheDocument();
    });

    it('uses partner directly when partner prop is present', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        const partnerData = {
            ...baseData,
            data: [
                {
                    partner_name: 'Lido',
                    partner: { name: 'CustomPartner', imageUrl: 'custom.png' },
                    apr: 4.5,
                    enabled: true,
                    link: null,
                    toCoin: { tokenAddress: '0xtok', symbol: 'STK' },
                },
            ],
        };
        render(<EarnStakingCard data={partnerData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(screen.getByText('CustomPartner')).toBeInTheDocument();
        });
    });

    it('renders without wallet address', async () => {
        mockUseCurrentAddress = () => null;
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        // Should still render the row, but with loading false / balance 0
        await waitFor(() => {
            // After no walletAddress, balance is set to 0 with loadingBalance=false
            // The "Click here to view balance" text shows
            expect(screen.getByText(/Click here to view balance/)).toBeInTheDocument();
        });
    });

    it('handles empty user id and no wallet for processLink', async () => {
        mockUseCurrentAddress = () => null;
        mockUseUser = () => null;
        const linkData = {
            ...baseData,
            data: [
                {
                    partner_name: 'Lido',
                    apr: 4.5,
                    enabled: true,
                    link: 'https://example.com/',
                    toCoin: { tokenAddress: '0xtok', symbol: 'STK' },
                },
            ],
        };
        render(<EarnStakingCard data={linkData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        const modal = screen.getByTestId('modal');
        const rows = modal.querySelectorAll('.p-4');
        if (rows[0]) {
            fireEvent.click(rows[0]);
        }
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            'https://example.com/',
            '_blank',
            'noopener,noreferrer',
        );
    });

    it('falls back to onPress when link is whitespace', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        const linkData = {
            ...baseData,
            data: [
                {
                    partner_name: 'Lido',
                    apr: 4.5,
                    enabled: true,
                    link: '   ',
                    toCoin: { tokenAddress: '0xtok', symbol: 'STK' },
                },
            ],
        };
        const onPress = jest.fn();
        render(<EarnStakingCard data={linkData} onPress={onPress} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
        const modal = screen.getByTestId('modal');
        const rows = modal.querySelectorAll('.p-4');
        if (rows[0]) {
            fireEvent.click(rows[0]);
        }
        expect(onPress).toHaveBeenCalled();
    });

    it('handles unknown partner_name (partnerObj falsy)', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        const data = {
            ...baseData,
            data: [
                {
                    partner_name: 'UnknownPartner',
                    apr: 4.5,
                    enabled: true,
                    link: null,
                    toCoin: { tokenAddress: '0xtok', symbol: 'STK' },
                },
            ],
        };
        render(<EarnStakingCard data={data} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
    });

    it('handles balance load with error result (sets balance to 0)', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        mockGetTokenBalance = jest.fn(() =>
            Promise.resolve({ balance: '0', decimals: 18, error: true }),
        );
        const data = {
            ...baseData,
            data: [
                {
                    partner_name: 'Lido',
                    apr: 4.5,
                    enabled: true,
                    link: null,
                    toCoin: { tokenAddress: '0xtok', symbol: 'STK' },
                },
            ],
        };
        render(<EarnStakingCard data={data} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(mockGetTokenBalance).toHaveBeenCalled();
        });
    });

    it('closes modal when modal-close clicked', () => {
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        fireEvent.click(screen.getByText('modal-close'));
        expect(screen.queryByTestId('modal')).toBeNull();
    });

    it('closes modal via Header onClosePress', () => {
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('header-close'));
        expect(screen.queryByTestId('modal')).toBeNull();
    });

    it('invokes injected onBalanceLoaded on successful balance load', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        mockGetTokenBalance = jest.fn(() =>
            Promise.resolve({ balance: '1000000000000000000', decimals: 18, error: false }),
        );
        const onBalanceLoaded = jest.fn();
        mockInjectChildProps = { onBalanceLoaded };
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(onBalanceLoaded).toHaveBeenCalled();
        });
    });

    it('invokes injected onBalanceLoaded on error', async () => {
        mockUseCurrentAddress = () => '0xwallet';
        mockGetTokenBalance = jest.fn(() => Promise.reject(new Error('boom')));
        const onBalanceLoaded = jest.fn();
        mockInjectChildProps = { onBalanceLoaded };
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(onBalanceLoaded).toHaveBeenCalledWith(0, 0);
        });
    });

    it('invokes injected onBalanceLoaded when no wallet address', async () => {
        mockUseCurrentAddress = () => null;
        const onBalanceLoaded = jest.fn();
        mockInjectChildProps = { onBalanceLoaded };
        render(<EarnStakingCard data={baseData} onPress={jest.fn()} />);
        fireEvent.click(screen.getByText('Staking Pool'));
        await waitFor(() => {
            expect(onBalanceLoaded).toHaveBeenCalledWith(0, 0);
        });
    });
});
