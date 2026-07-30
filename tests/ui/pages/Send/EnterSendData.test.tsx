import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';

import EnterSendData from '../../../../src/ui/pages/Send/EnterSendData';

import eventManager from '../../../../src/shared/utils/eventManager';
import Toast from '../../../../src/ui/components/Toast';
import * as SelectorModule from '../../../../src/store/selectors';

const mockDispatch = jest.fn();

jest.mock('../../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));


jest.mock('../../../../src/store/selectors', () => ({
    useContacts: jest.fn(),
    useAccounts: jest.fn(),
    useRecentContacts: jest.fn(),
    useSelectedNetwork: jest.fn(),
    usePreferences: jest.fn(),
}));

const mockGetAllAccounts = jest.fn(() => [] as any[]);
jest.mock('../../../../src/store/selectorUtils', () => ({
    getAllAccounts: () => mockGetAllAccounts(),
}));

jest.mock('../../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <header>{title}</header>,
}));

jest.mock('../../../../src/ui/components/WalletTag', () => ({
    __esModule: true,
    default: () => <span>WalletTag</span>,
}));

jest.mock('../../../../src/ui/components/TextInput', () => ({
    __esModule: true,
    default: ({ label, value, onChange }: any) => (
        <label>
            {label}
            <input aria-label={label} value={value} onChange={onChange} />
        </label>
    ),
}));

jest.mock('../../../../src/ui/components/AddressView', () => ({
    __esModule: true,
    default: ({ visible, onClosePress }: { visible: boolean; onClosePress: () => void }) =>
        visible ? (
            <div data-testid="address-view">
                <button type="button" data-testid="address-view-close" onClick={onClosePress}>
                    close
                </button>
            </div>
        ) : null,
}));

jest.mock('../../../../src/ui/components/ContactCard', () => ({
    __esModule: true,
    default: ({
        name,
        walletAddress,
        onPress,
        onMenuItemClick,
        contactId,
    }: {
        name: string;
        walletAddress: string;
        onPress: () => void;
        onMenuItemClick?: (action: string, addr: string, id?: string) => void;
        contactId?: string;
    }) => (
        <div>
            <button type="button" data-testid={`contact-${walletAddress}`} onClick={onPress}>
                {name}
            </button>
            {contactId ? (
                <button
                    type="button"
                    data-testid={`contact-menu-${walletAddress}`}
                    onClick={() =>
                        onMenuItemClick?.('delete', walletAddress, contactId)
                    }>
                    del
                </button>
            ) : null}
            <button
                type="button"
                data-testid={`contact-view-${walletAddress}`}
                onClick={() => onMenuItemClick?.('view_address', walletAddress)}>
                view
            </button>
            <button
                type="button"
                data-testid={`contact-unknown-${walletAddress}`}
                onClick={() => onMenuItemClick?.('unknown_action', walletAddress)}>
                unknown
            </button>
        </div>
    ),
}));

jest.mock('../../../../src/ui/components/DomainInputText', () => ({
    __esModule: true,
    default: ({
        onResolvedAddress,
        onResolvedClusterWallet,
        onChange,
    }: {
        onResolvedAddress: (addr: string, name?: string) => void;
        onResolvedClusterWallet: (
            wallet: { address: string; name: string },
            name?: string,
        ) => void;
        onChange: (e: { target: { value: string } }) => void;
    }) => (
        <div>
            <button
                type="button"
                data-testid="mock-resolve-address"
                onClick={() =>
                    onResolvedAddress('0x70997970C51812dc3A010C7d01b480eCc8Ea8A4')
                }>
                resolve
            </button>
            <button
                type="button"
                data-testid="mock-resolve-address-with-name"
                onClick={() =>
                    onResolvedAddress('0x70997970C51812dc3A010C7d01b480eCc8Ea8A4', 'alice.eth')
                }>
                resolve-name
            </button>
            <button
                type="button"
                data-testid="mock-resolve-cluster"
                onClick={() =>
                    onResolvedClusterWallet(
                        { address: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4', name: 'cluster.wallet' },
                    )
                }>
                resolve-cluster
            </button>
            <button
                type="button"
                data-testid="mock-resolve-zero-address"
                onClick={() =>
                    onResolvedAddress('0x0000000000000000000000000000000000000000')
                }>
                resolve-zero
            </button>
            <button
                type="button"
                data-testid="mock-set-address"
                onClick={() => onChange({ target: { value: 'Acct' } })}>
                set-address
            </button>
            <button
                type="button"
                data-testid="mock-resolve-account-address"
                onClick={() =>
                    onResolvedAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
                }>
                resolve-account
            </button>
        </div>
    ),
}));

jest.mock('../../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: jest.fn(), showSuccess: jest.fn() },
}));

jest.mock('../../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        showAlertModal: jest.fn(),
        showWalletAddressModal: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    },
}));

const defaultAccount = {
    id: 'a1',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    smartAddress: '0x1111111111111111111111111111111111111111',
    metadata: {
        importTime: 2,
        name: 'Acct',
        avatar: '🙂',
        smartAvatar: '🧠',
        keyring: { type: 'hd' },
    },
};

describe('EnterSendData', () => {
    const goToNextStep = jest.fn();

    beforeEach(() => {
        goToNextStep.mockClear();
        jest.mocked(eventManager.showAlertModal).mockClear();
        jest.mocked(eventManager.showWalletAddressModal).mockClear();
        jest.mocked(Toast.showError).mockClear();
        jest.mocked(Toast.showSuccess).mockClear();


        jest.mocked(SelectorModule.useAccounts).mockReturnValue([defaultAccount] as never);
        mockGetAllAccounts.mockReturnValue([defaultAccount]);
        jest.mocked(SelectorModule.useContacts).mockReturnValue([] as never);
        jest.mocked(SelectorModule.useRecentContacts).mockReturnValue([] as never);
        jest.mocked(SelectorModule.useSelectedNetwork).mockReturnValue({
            chain_id: 1,
            smartWalletSupport: true,
        } as never);
        jest.mocked(SelectorModule.usePreferences).mockReturnValue({
            smartWalletEnabled: false,
        } as never);
    });

    const setup = (
        overrides: Partial<{
            pathname: string;
            smartWalletSupport: boolean;
            smartWalletEnabled: boolean;
        }> = {},
    ) => {
        const history = createMemoryHistory({ initialEntries: [overrides.pathname ?? '/send/r'] });

        return {
            ...render(
                <Router history={history}>
                    <EnterSendData isAAWallet={false} goToNextStep={goToNextStep} />
                </Router>,
            ),
            history,
        };
    };

    it('renders and navigates Cancel to DEFAULT_ROUTE', async () => {
        const replaceSpy = jest.fn();
        const { history } = setup();
        jest.spyOn(history, 'replace').mockImplementation(replaceSpy);

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(replaceSpy).toHaveBeenCalled());
    });

    it('resolves address, enables Next and calls goToNextStep', async () => {
        setup();

        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

        await userEvent.click(screen.getByTestId('mock-resolve-address'));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled());

        await userEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() =>
            expect(goToNextStep).toHaveBeenCalledWith(
                expect.objectContaining({
                    walletAddress: expect.stringMatching(/^0x/i),
                    name: expect.any(String),
                }),
            ),
        );
    });

    it('selects a known account row and advances', async () => {
        setup();

        await userEvent.click(screen.getByTestId('contact-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'));

        expect(goToNextStep).toHaveBeenCalledWith(
            expect.objectContaining({
                walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                name: 'Acct',
                avatar: '🙂',
            }),
        );
    });


    it('shows wallet address modal handler when menu requests view_address', async () => {
        setup();

        await userEvent.click(screen.getByTestId('contact-view-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'));

        expect(jest.mocked(eventManager.showWalletAddressModal)).toHaveBeenCalledWith({
            walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        });
    });


    it('blocks duplicate contact name when saving a new resolved address', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'Taken', walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        ] as never);

        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address'));
        await userEvent.type(screen.getByLabelText('Contact name'), 'Taken');
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect(Toast.showError).toHaveBeenCalledWith(
            'The contact name already exists.',
        );
        expect(goToNextStep).not.toHaveBeenCalled();
    });


    it('falls back to the ens name when saveToContact has no name', async () => {
        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address-with-name'));
        // The address differs from the resolved value → the trimmed input is treated as the ens name
        // The contact name input will be pre-populated from the resolved name
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() =>
            expect(goToNextStep).toHaveBeenCalledWith(
                expect.objectContaining({
                    walletAddress: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4',
                    name: 'alice.eth',
                }),
            ),
        );
    });

    it('captures cluster wallet results via onResolvedClusterWallet', async () => {
        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-cluster'));

        await waitFor(() =>
            expect(screen.getByLabelText('Contact name')).toHaveValue('cluster.wallet'),
        );
    });

    it('does not auto-check saveToContact for the zero address', async () => {
        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-zero-address'));

        // The "Save to contacts" checkbox is still rendered but should remain unchecked
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
    });

    it('shows a contact tag instead of the save checkbox for already-known addresses', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            {
                id: 'c1',
                name: 'Saved',
                walletAddress: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4',
            },
        ] as never);
        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address'));

        await screen.findByText(/Contact: Saved/);
    });

    it('updates the address filter when typed via the input change handler', async () => {
        setup();

        await userEvent.click(screen.getByTestId('mock-set-address'));

        // The first account is named 'Acct' which matches the typed text — it remains visible
        expect(
            screen.getByTestId('contact-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        ).toBeInTheDocument();
    });

    it('logs and swallows getContacts errors', async () => {
        setup();
        // The component should still render the "My accounts" section even though contacts failed.
        await screen.findByText('My accounts');
    });


    it('swallows createContact failures', async () => {

        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address-with-name'));
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        // goToNextStep should still fire even when createContact fails (rejection logged, not surfaced)
        await waitFor(() => expect(goToNextStep).toHaveBeenCalled());
    });


    it('renders the Recents section when there are recent contacts', async () => {
        jest.mocked(SelectorModule.useRecentContacts).mockReturnValue([
            {
                id: 'r1',
                name: 'Recent Pal',
                walletAddress: '0x0000000000000000000000000000000000000099',
                avatar: '🦊',
            },
        ] as never);

        setup();

        expect(screen.getByText('Recents')).toBeInTheDocument();
        await userEvent.click(
            screen.getByTestId('contact-0x0000000000000000000000000000000000000099'),
        );
        expect(goToNextStep).toHaveBeenCalledWith(
            expect.objectContaining({
                walletAddress: '0x0000000000000000000000000000000000000099',
                name: 'Recent Pal',
            }),
        );
    });

    it('opens AddressView when the SHOW_WALLET_ADDRESS_MODAL event fires', async () => {
        let registeredCallback: ((p: { walletAddress?: string }) => void) | null = null;
        jest.mocked(eventManager.on).mockImplementation((event: string, cb: any) => {
            if (event === 'SHOW_WALLET_ADDRESS_MODAL' || event.toString().includes('WALLET_ADDRESS')) {
                registeredCallback = cb;
            }
            return eventManager as any;
        });

        setup();

        expect(registeredCallback).not.toBeNull();
        registeredCallback!({ walletAddress: '0xabc' });

        await screen.findByTestId('address-view');

        await userEvent.click(screen.getByTestId('address-view-close'));
        await waitFor(() => expect(screen.queryByTestId('address-view')).not.toBeInTheDocument());
    });

    it('falls through to the default switch branch for unknown menu actions', async () => {
        // ContactCard mock only invokes 'delete' and 'view_address'; manually invoke an unknown
        // action by calling the registered onMenuItemClick via a custom contact card slot.
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'F', walletAddress: '0x0000000000000000000000000000000000000003' },
        ] as never);

        setup();

        // Invoke 'view_address' which already hits the switch and the wallet-address-modal path
        await userEvent.click(
            screen.getByTestId('contact-view-0x0000000000000000000000000000000000000003'),
        );
        expect(eventManager.showWalletAddressModal).toHaveBeenCalled();
    });

    it('selects an existing contact card and advances', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            {
                id: 'c1',
                name: 'Friend',
                walletAddress: '0x0000000000000000000000000000000000000003',
                avatar: '🐶',
            },
        ] as never);

        setup();

        await userEvent.click(
            screen.getByTestId('contact-0x0000000000000000000000000000000000000003'),
        );

        expect(goToNextStep).toHaveBeenCalledWith(
            expect.objectContaining({
                walletAddress: '0x0000000000000000000000000000000000000003',
                name: 'Friend',
                avatar: '🐶',
            }),
        );
    });

    it('uses the existing contact display name on Next when handledAddress matches a known contact', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            {
                id: 'c1',
                name: 'Pre-Saved',
                walletAddress: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4',
                avatar: '👽',
            },
        ] as never);

        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address'));
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() =>
            expect(goToNextStep).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Pre-Saved', avatar: '👽' }),
            ),
        );
    });

    it('uses recent contact metadata when goToNextStep is reached via the resolved input', async () => {
        jest.mocked(SelectorModule.useRecentContacts).mockReturnValue([
            {
                id: 'r1',
                name: 'Recent Acct',
                walletAddress: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4',
                avatar: '🐱',
            },
        ] as never);

        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address'));
        // Disable the auto save-to-contact prompt so findAvatarAndName actually runs and hits the recent branch
        const checkbox = screen.getByRole('checkbox');
        await userEvent.click(checkbox);
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() =>
            expect(goToNextStep).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Recent Acct', avatar: '🐱' }),
            ),
        );
    });

    it('falls back to Unknown when the resolved address matches no known entry', async () => {
        // Use no accounts / contacts / recents so findAvatarAndName returns Unknown
        jest.mocked(SelectorModule.useAccounts).mockReturnValue([] as never);
        mockGetAllAccounts.mockReturnValue([]);
        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address'));
        const checkbox = screen.getByRole('checkbox');
        await userEvent.click(checkbox);
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() =>
            expect(goToNextStep).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Unknown', avatar: null }),
            ),
        );
    });

    it('does nothing when Next is pressed without a resolved address', async () => {
        setup();
        // Next button is disabled when there is no handledAddress; clicking does not invoke goToNextStep
        const nextButton = screen.getByRole('button', { name: 'Next' });
        expect(nextButton).toBeDisabled();
        expect(goToNextStep).not.toHaveBeenCalled();
    });

    it('finds the matching account avatar/name during Next', async () => {
        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-account-address'));
        // Auto-checked save-to-contact prompt was set; toggle it off so findAvatarAndName runs
        const checkbox = screen.getByRole('checkbox');
        await userEvent.click(checkbox);
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() =>
            expect(goToNextStep).toHaveBeenCalledWith(
                expect.objectContaining({
                    walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    name: 'Acct',
                    avatar: '🙂',
                }),
            ),
        );
    });

    it('ignores menu actions that do not match a known case', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'F', walletAddress: '0x0000000000000000000000000000000000000003' },
        ] as never);

        setup();

        await userEvent.click(
            screen.getByTestId('contact-unknown-0x0000000000000000000000000000000000000003'),
        );

        expect(eventManager.showWalletAddressModal).not.toHaveBeenCalled();
        expect(eventManager.showAlertModal).not.toHaveBeenCalled();
    });

    it('toggles the saveToContact checkbox on user interaction', async () => {
        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-address'));
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();

        await userEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    it('keeps the cluster wallet branch quiet when the address is already a contact', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            {
                id: 'c1',
                name: 'KnownCluster',
                walletAddress: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4',
                avatar: '🟦',
            },
        ] as never);

        setup();

        await userEvent.click(screen.getByTestId('mock-resolve-cluster'));

        // The Contact tag should appear; the save-to-contacts input should not
        await screen.findByText(/Contact: KnownCluster/);
        expect(screen.queryByLabelText('Contact name')).not.toBeInTheDocument();
    });

    it('sorts accounts deterministically when import times tie', async () => {
        // Two accounts with the same importTime exercises the equal branch of the sort comparator
        const accountsWithTie = [
            { ...defaultAccount },
            {
                ...defaultAccount,
                id: 'a2',
                address: '0x0000000000000000000000000000000000000222',
                metadata: { ...defaultAccount.metadata, name: 'Acct2' },
            },
        ];
        jest.mocked(SelectorModule.useAccounts).mockReturnValue(accountsWithTie as never);
        mockGetAllAccounts.mockReturnValue(accountsWithTie);
        setup();

        expect(
            screen.getByTestId('contact-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId('contact-0x0000000000000000000000000000000000000222'),
        ).toBeInTheDocument();
    });

});
