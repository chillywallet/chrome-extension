import { createRoot } from 'react-dom/client';
import { deserializeBigInt } from '../lib/bigintSerializer';
import { ActiveTab } from '../shared/types/BrowserTab';
import { BackgroundConnection } from '../shared/types/Connection';
import logger from '../shared/utils/logger';
import { updateGlobalState } from '../store/actions/uiActions';
import { setBackgroundConnection } from '../store/backgroundConnection';
import configureStore, { ReduxState, ReduxStore, getReduxStore } from '../store/store';
import Root from './pages';
import Reload from './pages/Reload';

/**
 * Method to update backgroundConnection object use by UI
 *
 * @param backgroundConnection - connection object to background
 */
export const updateBackgroundConnection = (backgroundConnection: BackgroundConnection) => {
    setBackgroundConnection(backgroundConnection);

    backgroundConnection.onNotification((data: any) => {
        if (data.method === 'sendUpdate') {
            const store = getReduxStore();
            // Deserialize bigint values in update params
            const deserializedParams = deserializeBigInt(data.params[0]);
            store && store.dispatch(updateGlobalState(deserializedParams));
        } else {
            throw new Error(
                `Internal JSON-RPC Notification Not Handled:\n\n ${JSON.stringify(data)}`,
            );
        }
    });
};

type LaunchUIOptions = { activeTab: ActiveTab | null; container: HTMLElement | null };

export default function launchAppUI(
    backgroundConnection: BackgroundConnection,
    opts: LaunchUIOptions,
    cb: (store: ReduxStore) => void,
) {
    backgroundConnection.getState(function (err: any, state: ReduxState['globalState']) {
        if (err) {
            logger.error('getState', err);
            return;
        }

        startApp(state, backgroundConnection, opts).then(store => {
            cb(store);
            logger.log('Started state', store.getState());
        });
    });
}

async function startApp(
    state: ReduxState['globalState'],
    backgroundConnection: BackgroundConnection,
    opts: LaunchUIOptions,
) {
    const { activeTab, container } = opts;
    updateBackgroundConnection(backgroundConnection);

    const initialState = { activeTab, globalState: state };
    const store = configureStore(initialState);

    if (container) {
        const root = createRoot(container);
        root.render(<Root store={store} />);
    }

    return store;
}

export function startReloadPage(container: HTMLElement | null) {
    if (container) {
        const root = createRoot(container);
        root.render(<Reload />);
    }
}
