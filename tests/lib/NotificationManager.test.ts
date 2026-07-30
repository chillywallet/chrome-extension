import NotificationManager, { NOTIFICATION_MANAGER_EVENTS } from '../../src/lib/NotificationManager';

jest.mock('../../src/lib/ExtensionPlatform', () => {
    class MockExtensionPlatform {
        addOnRemovedListener = jest.fn();
        focusWindow = jest.fn(async () => undefined);
        getLastFocusedWindow = jest.fn(async () => ({ top: 100, left: 200, width: 800 }));
        openWindow = jest.fn(async (opts: any) => ({ id: 99, left: opts.left, state: 'normal' }));
        updateWindowPosition = jest.fn(async () => undefined);
        getAllWindows = jest.fn(async () => [] as any[]);
    }
    return { __esModule: true, default: MockExtensionPlatform };
});

describe('NotificationManager', () => {
    it('registers an onRemoved listener on construction', () => {
        const nm = new NotificationManager();
        expect((nm as any).platform.addOnRemovedListener).toHaveBeenCalled();
    });

    it('exposes POPUP_CLOSED event name', () => {
        expect(NOTIFICATION_MANAGER_EVENTS.POPUP_CLOSED).toBe('onPopupClosed');
    });

    it('focuses existing popup if currentPopupId points to one', async () => {
        const nm = new NotificationManager();
        (nm as any).platform.getAllWindows.mockResolvedValueOnce([{ id: 42, type: 'popup' }]);

        const setCurrent = jest.fn();
        await nm.showPopup(setCurrent, 42);

        expect((nm as any).platform.focusWindow).toHaveBeenCalledWith(42);
    });

    it('opens a new popup window if none exists', async () => {
        const nm = new NotificationManager();
        const setCurrent = jest.fn();
        await nm.showPopup(setCurrent, undefined);

        expect((nm as any).platform.openWindow).toHaveBeenCalled();
        expect(setCurrent).toHaveBeenCalledWith(99);
    });

    it('falls back to window geometry if getLastFocusedWindow throws', async () => {
        const nm = new NotificationManager();
        (nm as any).platform.getLastFocusedWindow.mockRejectedValueOnce(new Error('no window'));

        const setCurrent = jest.fn();
        await nm.showPopup(setCurrent, undefined);

        expect((nm as any).platform.openWindow).toHaveBeenCalled();
    });

    it('emits POPUP_CLOSED when the tracked popup is removed', async () => {
        const nm = new NotificationManager();
        const setCurrent = jest.fn();
        await nm.showPopup(setCurrent, undefined);
        const listener: (id: number) => void = (nm as any).platform.addOnRemovedListener.mock.calls[0][0];

        const onClose = jest.fn();
        nm.on(NOTIFICATION_MANAGER_EVENTS.POPUP_CLOSED, onClose);

        nm.markAsAutomaticallyClosed();
        listener(99);

        expect(onClose).toHaveBeenCalledWith({ automaticallyClosed: true });
        expect(setCurrent).toHaveBeenLastCalledWith(undefined);
    });

    it('ignores onRemoved for unrelated window ids', async () => {
        const nm = new NotificationManager();
        const setCurrent = jest.fn();
        await nm.showPopup(setCurrent, undefined);
        const listener: (id: number) => void = (nm as any).platform.addOnRemovedListener.mock.calls[0][0];

        const onClose = jest.fn();
        nm.on(NOTIFICATION_MANAGER_EVENTS.POPUP_CLOSED, onClose);

        listener(1234);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('updates window position when popup left differs from desired', async () => {
        const nm = new NotificationManager();
        (nm as any).platform.openWindow.mockResolvedValueOnce({ id: 99, left: 0, state: 'normal' });
        (nm as any).platform.getLastFocusedWindow.mockResolvedValueOnce({ top: 50, left: 50, width: 1500 });

        const setCurrent = jest.fn();
        await nm.showPopup(setCurrent, undefined);

        expect((nm as any).platform.updateWindowPosition).toHaveBeenCalled();
    });

    it('defaults top/left/width to 0 when lastFocused properties are missing', async () => {
        const nm = new NotificationManager();
        (nm as any).platform.getLastFocusedWindow.mockResolvedValueOnce({});
        await nm.showPopup(jest.fn(), undefined);
        expect((nm as any).platform.openWindow).toHaveBeenCalledWith(
            expect.objectContaining({ top: 0, left: 0 }),
        );
    });

    it('skips setCurrentPopupId when newly opened window has no id', async () => {
        const nm = new NotificationManager();
        (nm as any).platform.openWindow.mockResolvedValueOnce({ id: undefined, left: 0 });
        const setCurrent = jest.fn();
        await nm.showPopup(setCurrent, undefined);
        expect(setCurrent).not.toHaveBeenCalled();
    });

    it('skips position update when popup is fullscreen', async () => {
        const nm = new NotificationManager();
        (nm as any).platform.openWindow.mockResolvedValueOnce({
            id: 99,
            left: 99999, // different from desired
            state: 'fullscreen',
        });
        await nm.showPopup(jest.fn(), undefined);
        expect((nm as any).platform.updateWindowPosition).not.toHaveBeenCalled();
    });

    it('_getPopupIn returns null when windows is null', () => {
        const nm: any = new NotificationManager();
        expect(nm._getPopupIn(null)).toBeNull();
    });
});
