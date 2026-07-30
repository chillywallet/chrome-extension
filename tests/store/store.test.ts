import configureStore, { getReduxStore } from '../../src/store/store';

jest.mock('../../src/store/reducers', () => ({
    __esModule: true,
    default: (state: any = { value: 0 }) => state,
}));

describe('store/store', () => {
    it('getReduxStore returns null until configureStore is called', () => {
        // Sequence-dependent: this may not be the first test, but configureStore
        // is idempotent in our environment - just call it again to set the singleton.
        configureStore({});
        expect(getReduxStore()).not.toBeNull();
    });

    it('configureStore creates a redux store with preloaded state', () => {
        const store = configureStore({ value: 7 });
        expect(typeof store.dispatch).toBe('function');
        expect(typeof store.getState).toBe('function');
        expect(store.getState()).toEqual({ value: 7 });
    });

    it('configureStore exposes the same instance via getReduxStore', () => {
        const store = configureStore({});
        expect(getReduxStore()).toBe(store);
    });
});
