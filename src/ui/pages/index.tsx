import React from 'react';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import { ReduxStore } from '../../store/store';
import AlertModal from '../components/AlertModal';
import AppIconHandler from '../components/AppIconHandler';
import LoadingIndicator from '../components/LoadingIndicator';
import StaticConfigHandler from '../components/StaticConfigHandler';
import Wrapper from '../components/Wrapper';
import CachingHandler from './CachingHandler';
import Routes from './Routes';

type Props = {
    store: ReduxStore;
};

export default React.memo<Props>((props: Props) => {
    const { store } = props;

    return (
        <Provider store={store}>
            <HashRouter hashType="noslash">
                <Wrapper>
                    <Routes />
                </Wrapper>

                <AppIconHandler />
                <StaticConfigHandler />
                <LoadingIndicator />
                <AlertModal />
                <CachingHandler />
            </HashRouter>
        </Provider>
    );
});
