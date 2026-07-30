import eventManager from '../../../src/shared/utils/eventManager';
import Toast from '../../../src/ui/components/Toast';

jest.useFakeTimers();

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
        showError: jest.fn(),
        showInfo: jest.fn(),
    },
}));

jest.mock('../../../src/shared/utils/format', () => ({
    ...jest.requireActual('../../../src/shared/utils/format'),
    formatNumber: jest.fn((n: number) => n.toString()),
}));

describe('eventManager', () => {
    beforeEach(() => {
        eventManager.list.clear();
        jest.clearAllMocks();
    });

    it('emit returns false when no listeners', () => {
        expect(eventManager.emit('NONE')).toBe(false);
    });

    it('on adds a listener and emit fires it', () => {
        const cb = jest.fn();
        eventManager.on('EVT', cb);
        expect(eventManager.emit('EVT', 1, 2)).toBe(true);
        jest.runAllTimers();
        expect(cb).toHaveBeenCalledWith(1, 2);
    });

    it('off removes a listener', () => {
        const cb = jest.fn();
        eventManager.on('EVT', cb);
        eventManager.off('EVT', cb);
        eventManager.emit('EVT');
        jest.runAllTimers();
        expect(cb).not.toHaveBeenCalled();
    });

    it('off on a missing event is a no-op', () => {
        expect(() => eventManager.off('MISSING', () => {})).not.toThrow();
    });

    it('reset removes all listeners for event', () => {
        const cb = jest.fn();
        eventManager.on('EVT', cb);
        eventManager.reset('EVT');
        expect(eventManager.emit('EVT')).toBe(false);
    });

    it('showAlertModal emits SHOW_ALERT_MODAL', () => {
        const cb = jest.fn();
        eventManager.on('SHOW_ALERT_MODAL', cb);
        eventManager.showAlertModal({ title: 'x' } as any);
        jest.runAllTimers();
        expect(cb).toHaveBeenCalledWith({ title: 'x' });
    });

    it('setTxConfirmationHandling emits SET_CONFIRMATION_HANDLING', () => {
        const cb = jest.fn();
        eventManager.on('SET_CONFIRMATION_HANDLING', cb);
        eventManager.setTxConfirmationHandling(true);
        jest.runAllTimers();
        expect(cb).toHaveBeenCalledWith(true);
    });

    it('showSeedPhraseModal emits SHOW_SEED_PHRASE_MODAL', () => {
        const cb = jest.fn();
        eventManager.on('SHOW_SEED_PHRASE_MODAL', cb);
        eventManager.showSeedPhraseModal({} as any);
        jest.runAllTimers();
        expect(cb).toHaveBeenCalled();
    });

    it('showPrivateKeyModal emits SHOW_PRIVATE_KEY_MODAL', () => {
        const cb = jest.fn();
        eventManager.on('SHOW_PRIVATE_KEY_MODAL', cb);
        eventManager.showPrivateKeyModal({} as any);
        jest.runAllTimers();
        expect(cb).toHaveBeenCalled();
    });

    it('showWalletAddressModal emits SHOW_WALLET_ADDRESS_MODAL', () => {
        const cb = jest.fn();
        eventManager.on('SHOW_WALLET_ADDRESS_MODAL', cb);
        eventManager.showWalletAddressModal({ walletAddress: '0x1' });
        jest.runAllTimers();
        expect(cb).toHaveBeenCalledWith({ walletAddress: '0x1' });
    });

    it('showAddCustomCoinModal emits SHOW_ADD_CUSTOM_COIN_MODAL', () => {
        const cb = jest.fn();
        eventManager.on('SHOW_ADD_CUSTOM_COIN_MODAL', cb);
        eventManager.showAddCustomCoinModal('0x1');
        jest.runAllTimers();
        expect(cb).toHaveBeenCalledWith('0x1');
    });

    it('showCelebration shows toast when points > 0', () => {
        eventManager.showCelebration(10);
        expect(Toast.showSuccess).toHaveBeenCalled();
    });

    it('showCelebration is a no-op when points falsy', () => {
        eventManager.showCelebration(0);
        eventManager.showCelebration();
        expect(Toast.showSuccess).not.toHaveBeenCalled();
    });
});
