import { configureStore as baseConfigureStore } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import { StoreEnhancer } from 'redux';
import rootReducer from './reducers';

let reduxStore: ReduxStore | null = null;

export function getReduxStore() {
    return reduxStore;
}

export default function configureStore(preloadedState: any) {
    const enhancers: StoreEnhancer[] = [];

    const _store = baseConfigureStore({
        reducer: rootReducer,
        middleware: getDefaultMiddleware =>
            getDefaultMiddleware({
                serializableCheck: false,
                immutableCheck: false,
            }),
        devTools: false,
        enhancers,
        preloadedState,
    });
    reduxStore = _store;
    return _store;
}

export type ReduxStore = ReturnType<typeof configureStore>;
export type ReduxState = ReturnType<ReduxStore['getState']>;
export type ReduxDispatch = ReduxStore['dispatch'];

//@ts-ignore
export const useAppDispatch: () => ReduxDispatch = useDispatch;
