import * as ethers from 'ethers';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { ChillyAccount } from '../../../src/shared/types/Wallet';
import AccountView from '../../../src/ui/components/AccountView';
import { useCurrentAccount } from '../../../src/store/selectors';

const emojiRenderProps: Record<string, unknown>[] = [];

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useCurrentAccount: jest.fn(),
}));

jest.mock('../../../src/ui/components/EmojiView', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        emojiRenderProps.push(props);
        return <span data-testid="emoji-view" />;
    },
}));

function accountFixture(overrides: Partial<ChillyAccount> = {}): ChillyAccount {
    const { metadata: metaOverrides, ...rest } = overrides;
    return {
        id: 'acc-1',
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        type: 'eip155:eoa',
        options: {},
        methods: [],
        metadata: {
            name: 'Primary',
            importTime: 1,
            keyring: { type: 'HD Key Tree' },
            ...metaOverrides,
        },
        ...rest,
    } as ChillyAccount;
}

describe('AccountView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        emojiRenderProps.length = 0;
        jest.mocked(useCurrentAccount).mockReturnValue(null as never);
    });

    it('renders nothing when there is no account from props or store', () => {
        const { container } = render(<AccountView />);
        expect(container.firstChild).toBeNull();
    });

    it('renders account from the store when the account prop is omitted', () => {
        jest.mocked(useCurrentAccount).mockReturnValue(
            accountFixture({
                metadata: {
                    name: 'From Store',
                    importTime: 1,
                    keyring: { type: 'HD Key Tree' },
                    smartAvatar: '🧪',
                },
            }),
        );

        render(<AccountView onPress={jest.fn()} />);

        expect(screen.getByText('From Store')).toBeInTheDocument();
        expect(screen.getByText('CHANGE')).toBeInTheDocument();
        expect(emojiRenderProps[0]).toMatchObject({
            emoji: '🧪',
            walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        });
    });

    it('prefers the explicit account prop over the current store account', () => {
        jest.mocked(useCurrentAccount).mockReturnValue(
            accountFixture({ id: 'store', metadata: { name: 'Store Name', importTime: 1, keyring: { type: 'HD Key Tree' } } }),
        );

        const fromProps = accountFixture({
            id: 'prop',
            metadata: { name: 'Prop Name', importTime: 2, keyring: { type: 'HD Key Tree' } },
        });

        render(<AccountView account={fromProps} onPress={jest.fn()} />);

        expect(screen.getByText('Prop Name')).toBeInTheDocument();
        expect(screen.queryByText('Store Name')).not.toBeInTheDocument();
    });

    it('invokes onPress with the active account and prevents default on click', () => {
        const onPress = jest.fn();
        const acc = accountFixture();
        render(<AccountView account={acc} onPress={onPress} />);

        const btn = screen.getByRole('button');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        const preventDefault = jest.spyOn(event, 'preventDefault');
        fireEvent(btn, event);

        expect(preventDefault).toHaveBeenCalled();
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(onPress).toHaveBeenCalledWith(acc);
    });

    it('disables the button and hides CHANGE when onPress is omitted', () => {
        render(<AccountView account={accountFixture()} />);

        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.queryByText('CHANGE')).not.toBeInTheDocument();
    });

    it('merges custom className onto the button', () => {
        render(<AccountView account={accountFixture()} onPress={jest.fn()} className="ring-1" />);

        expect(screen.getByRole('button')).toHaveClass('ring-1');
    });

    it('uses smart wallet address and metadata.avatar when isSmartWallet is true', () => {
        const smartAddr = '0x2222222222222222222222222222222222222222';
        render(
            <AccountView
                account={accountFixture({
                    smartAddress: smartAddr,
                    metadata: {
                        name: 'Smart',
                        importTime: 1,
                        keyring: { type: 'HD Key Tree' },
                        avatar: '🎯',
                    },
                })}
                isSmartWallet
                onPress={jest.fn()}
            />,
        );

        expect(screen.getByText('Smart')).toBeInTheDocument();
        expect(emojiRenderProps[0]).toMatchObject({
            emoji: '🎯',
            walletAddress: smartAddr,
        });
    });

    it('uses EOA address and metadata.smartAvatar when isSmartWallet is false', () => {
        render(
            <AccountView
                account={accountFixture({
                    metadata: {
                        name: 'EOA',
                        importTime: 1,
                        keyring: { type: 'HD Key Tree' },
                        smartAvatar: '🎨',
                    },
                })}
                isSmartWallet={false}
                onPress={jest.fn()}
            />,
        );

        expect(emojiRenderProps[0]).toMatchObject({
            emoji: '🎨',
            walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        });
    });

    it('passes undefined emoji when the relevant metadata field is absent', () => {
        render(
            <AccountView
                account={accountFixture({
                    metadata: {
                        name: 'No Emoji',
                        importTime: 1,
                        keyring: { type: 'HD Key Tree' },
                    },
                })}
                onPress={jest.fn()}
            />,
        );

        expect(emojiRenderProps[0]).toMatchObject({
            emoji: undefined,
            walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        });
    });

    it('uses an empty wallet address for smart wallet mode when smartAddress is missing', () => {
        const ethersActual = jest.requireActual<typeof import('ethers')>('ethers');
        const realGetAddress = ethersActual.getAddress.bind(ethersActual);
        const spy = jest.spyOn(ethers, 'getAddress').mockImplementation((addr: string) => {
            if (addr === '') {
                return realGetAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
            }
            return realGetAddress(addr);
        });

        try {
            render(
                <AccountView
                    account={accountFixture({ smartAddress: undefined })}
                    isSmartWallet
                    onPress={jest.fn()}
                />,
            );

            expect(emojiRenderProps[0]).toMatchObject({ walletAddress: '' });
        } finally {
            spy.mockRestore();
        }
    });
});
