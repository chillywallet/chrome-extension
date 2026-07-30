import { HIDE_LOADING, SHOW_LOADING } from '../actions/uiActions';

const initGlobalState = {
    isShowLoading: false,
};

export const uiState = (
    state: typeof initGlobalState = initGlobalState,
    action: { [key: string]: any },
) => {
    switch (action.type) {
        case SHOW_LOADING:
            return { ...state, isShowLoading: true };

        case HIDE_LOADING:
            return { ...state, isShowLoading: false };

        default:
            return state;
    }
};
