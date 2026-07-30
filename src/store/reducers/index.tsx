import { combineReducers } from '@reduxjs/toolkit';

import * as globalReducer from './globalReducer';
import * as portfolioReducer from './portfolioReducer';
import * as uiReducer from './uiReducer';

export default combineReducers({
    ...globalReducer,
    ...portfolioReducer,
    ...uiReducer,
});
