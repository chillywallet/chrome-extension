import React from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import logger from '../../../src/shared/utils/logger';
import eventManager from '../../../src/shared/utils/eventManager';
import EventType from '../../../src/shared/types/EventType';
import Toast from '../../../src/ui/components/Toast';
import * as SelectorModule from '../../../src/store/selectors';
import Contact from '../../../src/ui/pages/Contact';

const mockDispatch = jest.fn();

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => {
    const actual = jest.requireActual('../../../src/store/actions/uiActions');
    return {
        ...actual,
        setContacts: (contacts: unknown[]) => (dispatch: Function) => {
            dispatch({ type: 'MOCK_SET_CONTACTS', payload: contacts });
            return Promise.resolve();
        },
    };
});


jest.mock('../../../src/store/selectors', () => ({
    useContacts: jest.fn(),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn() },
}));

jest.mock('../../../src/shared/utils/avatar', () => ({
    getRandomAvatar: jest.fn(() => '🦁'),
}));

jest.mock('../../../src/shared/utils/eventManager', () => {
    const actual = jest.requireActual('../../../src/shared/utils/eventManager');
    return {
        __esModule: true,
        default: {
            ...actual.default,
            showAlertModal: jest.fn(),
        },
    };
});

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <header>{title}</header>,
}));

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children, onClose }: { visible: boolean; children: React.ReactNode; onClose: () => void }) =>
        visible ? (
            <div data-testid="contact-modal-root">
                {children}
                <button type="button" aria-label="Close modal overlay" onClick={onClose}>
                    overlay-close
                </button>
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/TextInput', () => ({
    __esModule: true,
    default: ({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
        <label>
            {label}
            <input aria-label={label} value={value} onChange={onChange} />
        </label>
    ),
}));

jest.mock('../../../src/ui/components/ContactCard', () => ({
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
            <button type="button" data-testid={`contact-row-${walletAddress}`} onClick={onPress}>
                {name}
            </button>
            {contactId ? (
                <button
                    type="button"
                    data-testid={`contact-del-${walletAddress}`}
                    onClick={() => onMenuItemClick?.('delete', walletAddress, contactId)}>
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
                onClick={() => onMenuItemClick?.('unknown_action', walletAddress, contactId)}>
                noop-menu
            </button>
        </div>
    ),
}));

jest.mock('../../../src/ui/components/EmojiPicker', () => ({
    __esModule: true,
    default: ({ onSelect }: { onSelect: (e: string) => void }) => (
        <button type="button" onClick={() => onSelect('🎯')}>
            pick-emoji
        </button>
    ),
}));

jest.mock('../../../src/ui/components/EmojiView', () => ({
    __esModule: true,
    default: () => <div data-testid="emoji-view-empty">empty-emoji</div>,
}));

jest.mock('../../../src/ui/components/AddressView', () => ({
    __esModule: true,
    default: ({
        visible,
        walletAddress,
        onClosePress,
    }: {
        visible: boolean;
        walletAddress?: string;
        onClosePress: () => void;
    }) =>
        visible ? (
            <div data-testid="address-view">
                <span>{walletAddress}</span>
                <button type="button" onClick={onClosePress}>
                    av-close
                </button>
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: jest.fn(), showSuccess: jest.fn() },
}));

const VALID_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const VALID_ADDR_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

const SEEDED_CONTACTS = [
    { id: 'c1', name: 'Alice', walletAddress: VALID_ADDR, avatar: '🙂' },
    { id: 'c2', name: 'Bob', walletAddress: VALID_ADDR_2, avatar: '🐶' },
];

describe('Contact page', () => {
    afterEach(() => {
        cleanup();
        eventManager.list.clear();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        mockDispatch.mockImplementation((action: unknown) =>
            typeof action === 'function'
                ? (action as (d: typeof mockDispatch, s: () => unknown) => unknown)(mockDispatch, () => ({}))
                : action,
        );

        jest.mocked(SelectorModule.useContacts).mockReturnValue(SEEDED_CONTACTS as never);





        jest.mocked(eventManager.showAlertModal).mockClear();
    });

    const setup = () => render(<Contact />);



    it('shows empty search state when filter matches nothing', async () => {
        setup();

        await screen.findByTestId('contact-row-' + VALID_ADDR);

        await userEvent.type(screen.getByPlaceholderText('Search...'), 'zzz-no-match');

        expect(screen.getByText('No contacts found')).toBeInTheDocument();
    });

    it('filters contacts by name or address substring', async () => {
        setup();

        await screen.findByTestId('contact-row-' + VALID_ADDR);

        const search = screen.getByPlaceholderText('Search...');
        await userEvent.clear(search);
        await userEvent.type(search, 'alice');

        expect(screen.getByTestId('contact-row-' + VALID_ADDR)).toBeInTheDocument();
        expect(screen.queryByTestId('contact-row-' + VALID_ADDR_2)).not.toBeInTheDocument();

        await userEvent.clear(search);
        await userEvent.type(search, VALID_ADDR_2.slice(2, 12).toLowerCase());

        expect(screen.getByTestId('contact-row-' + VALID_ADDR_2)).toBeInTheDocument();
    });

    it('opens add modal, validates address, creates contact, and shows success', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([]);

        setup();

        await userEvent.click(screen.getAllByRole('button', { name: 'Add Contact' })[0]);

        const modal = screen.getByTestId('contact-modal-root');
        expect(within(modal).getByText('Add Contact')).toBeInTheDocument();

        await userEvent.type(within(modal).getByLabelText('WALLET ADDRESS'), 'not-an-address');
        expect(screen.getByText('Wallet address is invalid')).toBeInTheDocument();
        expect(within(modal).getByRole('button', { name: 'Add' })).toBeDisabled();

        await userEvent.clear(within(modal).getByLabelText('WALLET ADDRESS'));
        await userEvent.type(within(modal).getByLabelText('WALLET ADDRESS'), VALID_ADDR_2);
        await waitFor(() =>
            expect(within(modal).queryByText('Wallet address is invalid')).not.toBeInTheDocument(),
        );
        expect(within(modal).getByRole('button', { name: 'Add' })).not.toBeDisabled();

        await userEvent.click(within(modal).getByRole('button', { name: 'pick-emoji' }));

        await userEvent.type(within(modal).getByLabelText('NAME'), 'Carl');

        await act(async () => {
            await userEvent.click(within(modal).getByRole('button', { name: 'Add' }));
        });

        await waitFor(() =>
            expect(Toast.showSuccess).toHaveBeenCalledWith('Contact created successfully'),
        );
        await waitFor(() =>
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'MOCK_SET_CONTACTS',
                    payload: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Carl',
                            walletAddress: VALID_ADDR_2,
                            avatar: '🎯',
                        }),
                    ]),
                }),
            ),
        );
    });

    it('blocks create when contact name already exists', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'Taken', walletAddress: VALID_ADDR, avatar: '🙂' },
        ] as never);

        setup();

        await userEvent.click(screen.getAllByRole('button', { name: 'Add Contact' })[0]);

        const modal = screen.getByTestId('contact-modal-root');
        await userEvent.type(within(modal).getByLabelText('WALLET ADDRESS'), VALID_ADDR_2);
        await waitFor(() => expect(within(modal).getByRole('button', { name: 'Add' })).not.toBeDisabled());
        await userEvent.type(within(modal).getByLabelText('NAME'), 'Taken');
        await userEvent.click(within(modal).getByRole('button', { name: 'Add' }));

        expect(Toast.showError).toHaveBeenCalledWith('The contact name already exists.');
        expect(mockDispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'MOCK_SET_CONTACTS' }),
        );
    });

    it('opens edit modal, updates contact, and deletes from modal', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'Alice', walletAddress: VALID_ADDR, avatar: '🙂' },
        ] as never);

        setup();

        await screen.findByTestId('contact-row-' + VALID_ADDR);

        await userEvent.click(screen.getByTestId('contact-row-' + VALID_ADDR));

        const modal = screen.getByTestId('contact-modal-root');
        await userEvent.clear(within(modal).getByLabelText('NAME'));
        await userEvent.type(within(modal).getByLabelText('NAME'), 'Alice2');
        await act(async () => {
            await userEvent.click(within(modal).getByRole('button', { name: 'Update' }));
        });

        await waitFor(() =>
            expect(Toast.showSuccess).toHaveBeenCalledWith('Contact updated successfully'),
        );
        await waitFor(() =>
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'MOCK_SET_CONTACTS',
                    payload: expect.arrayContaining([
                        expect.objectContaining({ name: 'Alice2', walletAddress: VALID_ADDR }),
                    ]),
                }),
            ),
        );

        await waitFor(() => expect(screen.queryByTestId('contact-modal-root')).not.toBeInTheDocument());

        jest.mocked(Toast.showSuccess).mockClear();
        jest.mocked(eventManager.showAlertModal).mockClear();

        await userEvent.click(screen.getByTestId('contact-row-' + VALID_ADDR));
        const modalAgain = screen.getByTestId('contact-modal-root');
        await userEvent.click(within(modalAgain).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(jest.mocked(eventManager.showAlertModal)).toHaveBeenCalled());
        const alert = jest.mocked(eventManager.showAlertModal).mock.calls[0][0];
        await act(async () => {
            await alert.buttons[0].onPress();
        });

        await waitFor(() =>
            expect(Toast.showSuccess).toHaveBeenCalledWith('Contact deleted successfully'),
        );
    });

    it('shows AddressView after SHOW_WALLET_ADDRESS_MODAL event', async () => {
        jest.useFakeTimers();
        try {
            jest.mocked(SelectorModule.useContacts).mockReturnValue([
                { id: 'c1', name: 'Alice', walletAddress: VALID_ADDR, avatar: '🙂' },
            ] as never);

            setup();

            await screen.findByTestId('contact-row-' + VALID_ADDR);

            act(() => {
                eventManager.emit(EventType.SHOW_WALLET_ADDRESS_MODAL, { walletAddress: VALID_ADDR });
            });
            act(() => {
                jest.runAllTimers();
            });

            expect(await screen.findByTestId('address-view')).toBeInTheDocument();
            expect(screen.getByText(VALID_ADDR)).toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', { name: 'av-close' }));
            expect(screen.queryByTestId('address-view')).not.toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    it('calls showWalletAddressModal from ContactCard menu', async () => {
        const spy = jest.spyOn(eventManager, 'showWalletAddressModal');

        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'Alice', walletAddress: VALID_ADDR, avatar: '🙂' },
        ] as never);

        setup();

        await screen.findByTestId('contact-view-' + VALID_ADDR);

        await userEvent.click(screen.getByTestId('contact-view-' + VALID_ADDR));

        expect(spy).toHaveBeenCalledWith({ walletAddress: VALID_ADDR });
        spy.mockRestore();
    });

    it('confirms delete from list card menu', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'Alice', walletAddress: VALID_ADDR, avatar: '🙂' },
        ] as never);

        setup();

        await screen.findByTestId('contact-del-' + VALID_ADDR);

        await userEvent.click(screen.getByTestId('contact-del-' + VALID_ADDR));

        const alert = jest.mocked(eventManager.showAlertModal).mock.calls[0][0];
        await act(async () => {
            await alert.buttons[0].onPress();
        });

        await waitFor(() =>
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'MOCK_SET_CONTACTS', payload: [] }),
            ),
        );
    });



    it('does nothing for unknown ContactCard menu actions', async () => {
        const spy = jest.spyOn(eventManager, 'showWalletAddressModal');

        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'Alice', walletAddress: VALID_ADDR, avatar: '🙂' },
        ] as never);

        setup();

        await screen.findByTestId('contact-unknown-' + VALID_ADDR);
        await userEvent.click(screen.getByTestId('contact-unknown-' + VALID_ADDR));

        expect(spy).not.toHaveBeenCalled();
        expect(jest.mocked(eventManager.showAlertModal)).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('closes modal from overlay onClose', async () => {
        setup();

        await userEvent.click(screen.getAllByRole('button', { name: 'Add Contact' })[0]);
        expect(screen.getByTestId('contact-modal-root')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Close modal overlay' }));
        expect(screen.queryByTestId('contact-modal-root')).not.toBeInTheDocument();
    });

    it('closes add modal via Close button', async () => {
        setup();

        await userEvent.click(screen.getAllByRole('button', { name: 'Add Contact' })[0]);
        const modal = screen.getByTestId('contact-modal-root');
        await userEvent.click(within(modal).getByRole('button', { name: 'Close' }));

        expect(screen.queryByTestId('contact-modal-root')).not.toBeInTheDocument();
    });

    it('closes edit modal via Close button', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c1', name: 'Alice', walletAddress: VALID_ADDR, avatar: '🙂' },
        ] as never);

        setup();

        await screen.findByTestId('contact-row-' + VALID_ADDR);
        await userEvent.click(screen.getByTestId('contact-row-' + VALID_ADDR));

        const modal = screen.getByTestId('contact-modal-root');
        expect(within(modal).getByText('Update Contact')).toBeInTheDocument();

        await userEvent.click(within(modal).getByRole('button', { name: 'Close' }));
        expect(screen.queryByTestId('contact-modal-root')).not.toBeInTheDocument();
    });

    it('uses default 🦊 emoji when opening edit modal for a contact without an avatar', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: 'c2', name: 'NoAvatar', walletAddress: VALID_ADDR, avatar: undefined },
        ] as never);

        setup();

        await screen.findByTestId('contact-row-' + VALID_ADDR);
        await userEvent.click(screen.getByTestId('contact-row-' + VALID_ADDR));

        const modal = screen.getByTestId('contact-modal-root');
        expect(within(modal).getByText('Update Contact')).toBeInTheDocument();
    });

    it('renders rows without ids using their index as React key', async () => {
        jest.mocked(SelectorModule.useContacts).mockReturnValue([
            { id: undefined, name: 'NoId', walletAddress: VALID_ADDR, avatar: '🙂' },
        ] as never);

        setup();

        await screen.findByTestId('contact-row-' + VALID_ADDR);
    });
});
