/**
 * @jest-environment jsdom
 */
import { requestProvider, announceProvider } from '../../../src/lib/providers/EIP6963';

const VALID_INFO = {
    uuid: '350670db-19fa-4704-a166-e52e178b59d2',
    name: 'Chilly',
    icon: 'data:image/png;base64,abcd',
    rdns: 'io.chilly.example',
};

describe('EIP-6963', () => {
    describe('requestProvider', () => {
        it('dispatches a requestProvider event', () => {
            const seen: string[] = [];
            const listener = (ev: Event) => seen.push(ev.type);
            window.addEventListener('eip6963:requestProvider', listener);
            requestProvider(jest.fn());
            window.removeEventListener('eip6963:requestProvider', listener);
            expect(seen).toContain('eip6963:requestProvider');
        });

        it('invokes the handler when an announce event is received with valid detail', () => {
            const handler = jest.fn();
            requestProvider(handler);

            const detail = Object.freeze({ info: { ...VALID_INFO }, provider: {} as any });
            const ev = new CustomEvent('eip6963:announceProvider', { detail });
            window.dispatchEvent(ev);
            expect(handler).toHaveBeenCalledWith(detail);
        });

        it('throws when announce event has invalid detail', () => {
            requestProvider(jest.fn());
            // Detail not frozen and info missing fields → isValidAnnounceProviderEvent returns false
            const onError = jest.fn();
            window.addEventListener('error', onError);
            const ev = new CustomEvent('eip6963:announceProvider', {
                detail: { info: {}, provider: {} },
            });
            // jsdom catches listener throws and emits an 'error' event
            try {
                window.dispatchEvent(ev);
            } catch (e) {
                // Some environments rethrow
            }
            window.removeEventListener('error', onError);
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('isValidProviderDetail validation', () => {
        it('rejects empty name', () => {
            expect(() => announceProvider({ info: { ...VALID_INFO, name: '' }, provider: {} as any })).toThrow();
        });
        it('rejects non-uuid uuid', () => {
            expect(() => announceProvider({ info: { ...VALID_INFO, uuid: 'not-uuid' }, provider: {} as any })).toThrow();
        });
        it('rejects non-data icon', () => {
            expect(() => announceProvider({ info: { ...VALID_INFO, icon: 'http://foo' }, provider: {} as any })).toThrow();
        });
        it('rejects invalid rdns', () => {
            expect(() => announceProvider({ info: { ...VALID_INFO, rdns: 'no-dots' }, provider: {} as any })).toThrow();
        });
        it('rejects non-object providerDetail', () => {
            expect(() => announceProvider(null as any)).toThrow();
        });
        it('rejects providerDetail with non-object info', () => {
            expect(() => announceProvider({ info: 'bad' as any, provider: {} as any })).toThrow();
        });
        it('rejects providerDetail with non-object provider', () => {
            expect(() => announceProvider({ info: { ...VALID_INFO }, provider: 'bad' as any })).toThrow();
        });
    });

    describe('announceProvider', () => {
        it('dispatches an announce event for valid detail', () => {
            const seenAnnouncements: any[] = [];
            const listener = (ev: any) => seenAnnouncements.push(ev.detail);
            window.addEventListener('eip6963:announceProvider', listener);
            announceProvider({ info: { ...VALID_INFO }, provider: {} as any });
            window.removeEventListener('eip6963:announceProvider', listener);
            expect(seenAnnouncements.length).toBeGreaterThanOrEqual(1);
        });

        it('re-announces on requestProvider event', () => {
            const seenAnnouncements: any[] = [];
            const listener = (ev: any) => seenAnnouncements.push(ev.detail);
            window.addEventListener('eip6963:announceProvider', listener);
            announceProvider({ info: { ...VALID_INFO }, provider: {} as any });
            window.dispatchEvent(new Event('eip6963:requestProvider'));
            window.removeEventListener('eip6963:announceProvider', listener);
            expect(seenAnnouncements.length).toBeGreaterThanOrEqual(2);
        });
    });
});
