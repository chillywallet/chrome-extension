// @ts-ignore — JS module
import ComposableObservableStore from '../../src/lib/ComposableObservableStore';

const makeObservableStore = (initial: any) => {
    let state = initial;
    const listeners: Function[] = [];
    return {
        state,
        getState: () => state,
        subscribe: (cb: Function) => listeners.push(cb),
        update: (next: any) => {
            state = next;
            listeners.forEach(l => l(state));
        },
    };
};

const makeMessenger = () => {
    const subs: Record<string, Function[]> = {};
    return {
        subs,
        subscribe: (event: string, cb: Function) => {
            (subs[event] ||= []).push(cb);
        },
        publish: (event: string, payload: any) => {
            (subs[event] || []).forEach(cb => cb(payload));
        },
    };
};

describe('ComposableObservableStore', () => {
    it('initializes empty when no config', () => {
        const store = new ComposableObservableStore({ controllerMessenger: makeMessenger() });
        expect(store.getFlatState()).toEqual({});
    });

    it('throws when config has an undefined entry', () => {
        const messenger = makeMessenger();
        expect(() => new ComposableObservableStore({
            controllerMessenger: messenger,
            config: { foo: undefined },
        })).toThrow(/Undefined 'foo'/);
    });

    it('subscribes to observable child stores', () => {
        const messenger = makeMessenger();
        const child = makeObservableStore({ a: 1 });

        const store = new ComposableObservableStore({
            controllerMessenger: messenger,
            config: { child },
        });

        expect(store.getState()).toEqual({ child: { a: 1 } });

        child.update({ a: 2 });
        expect(store.getState().child).toEqual({ a: 2 });
    });

    it('subscribes to messenger-based controllers', () => {
        const messenger = makeMessenger();
        const controller = {
            name: 'CtrlA',
            state: { x: 1 },
            getState: () => ({ x: 1 }),
            metadata: {},
        };

        const store = new ComposableObservableStore({
            controllerMessenger: messenger,
            config: { ctrlA: controller },
        });

        expect(store.getState()).toEqual({ ctrlA: { x: 1 } });
        messenger.publish('CtrlA:stateChange', { x: 2 });
        expect(store.getState().ctrlA).toEqual({ x: 2 });
    });

    it('getFlatState merges child states', () => {
        const messenger = makeMessenger();
        const child = makeObservableStore({ a: 1 });
        const ctrl = { name: 'C', state: { b: 2 }, getState: () => ({ b: 2 }) };
        const store = new ComposableObservableStore({
            controllerMessenger: messenger,
            config: { child, ctrl },
        });
        expect(store.getFlatState()).toEqual({ a: 1, b: 2 });
    });

    it('applies getPersistentState when persist=true on controller stateChange', () => {
        const messenger = makeMessenger();
        const controller = {
            name: 'CtrlPersist',
            state: { x: 1, secret: 's' },
            getState: () => ({ x: 1, secret: 's' }),
            metadata: { x: { persist: true, anonymous: false } },
        };
        const store = new ComposableObservableStore({
            controllerMessenger: messenger,
            config: { ctrlP: controller },
            persist: true,
        });
        messenger.publish('CtrlPersist:stateChange', { x: 2, secret: 'sx' });
        // when persist=true, only x (persist:true) gets through; secret is dropped
        expect(store.getState().ctrlP).toEqual({ x: 2 });
    });

    it('uses getState() when state is missing on controller', () => {
        const messenger = makeMessenger();
        const controller = {
            name: 'NoState',
            // No `state` property
            getState: () => ({ y: 9 }),
            metadata: {},
        };
        const store = new ComposableObservableStore({
            controllerMessenger: messenger,
            config: { c: controller },
        });
        expect(store.getState().c).toEqual({ y: 9 });
    });

    it('getFlatState uses controller.state when getState is absent', () => {
        const messenger = makeMessenger();
        const child = makeObservableStore({ a: 1 });
        // Remove `getState` to force the falsy branch
        delete (child as any).getState;
        const store = new ComposableObservableStore({
            controllerMessenger: messenger,
            config: { child },
        });
        expect(store.getFlatState()).toEqual({ a: 1 });
    });

    it('getFlatState returns {} when config is set to null', () => {
        const messenger = makeMessenger();
        const store = new ComposableObservableStore({ controllerMessenger: messenger });
        // Force-clear config to trigger `if (!this.config)` branch
        (store as any).config = null;
        expect(store.getFlatState()).toEqual({});
    });
});
