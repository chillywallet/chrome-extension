import { uiState } from '../../../src/store/reducers/uiReducer';
import { HIDE_LOADING, SHOW_LOADING } from '../../../src/store/actions/uiActions';

describe('uiState reducer', () => {
    it('returns initial state for unknown action', () => {
        expect(uiState(undefined as any, { type: 'unknown' })).toEqual({
            isShowLoading: false,
        });
    });

    it('handles SHOW_LOADING', () => {
        expect(uiState(undefined as any, { type: SHOW_LOADING })).toEqual({
            isShowLoading: true,
        });
    });

    it('handles HIDE_LOADING', () => {
        expect(
            uiState({ isShowLoading: true } as any, { type: HIDE_LOADING }),
        ).toEqual({ isShowLoading: false });
    });
});
