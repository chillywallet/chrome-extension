// Side-effect imports for type/constant/enum files that have no actual logic.
// Loading them is sufficient to bring their coverage from 0% to fully covered.

// eslint-disable-next-line @typescript-eslint/no-var-requires
import {
    EIP5792_METHODS,
    EIP5792_APPROVAL_TYPES,
    EIP5792_ERROR_CODES,
    CallBatchStatusCode,
} from '../src/lib/eip5792/types';
import * as MessageManagerTypes from '../src/lib/message-manager/types';
import * as LiquidStakingTypes from '../src/lib/liquid-staking/Types';
import * as TestData from '../src/shared/utils/testData';
const ErrorMessages = require('../src/shared/messages/ErrorMessages').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NOTIFICATION_NAMES: PermissionNotificationNames } = require('../src/lib/permissions/enums');

describe('module imports → coverage', () => {
    it('ErrorMessages exposes user-facing strings', () => {
        expect(ErrorMessages.WC_NO_URI).toBeDefined();
        expect(ErrorMessages.NO_WALLET).toBeDefined();
    });

    it('permissions/enums exposes the NOTIFICATION_NAMES enum', () => {
        expect(PermissionNotificationNames.accountsChanged).toBe('chilly_accountsChanged');
        expect(PermissionNotificationNames.unlockStateChanged).toBe('chilly_unlockStateChanged');
        expect(PermissionNotificationNames.chainChanged).toBe('chilly_chainChanged');
    });

    it('eip5792/types exposes constants and the CallBatchStatusCode enum', () => {
        expect(EIP5792_METHODS.WALLET_SEND_CALLS).toBe('wallet_sendCalls');
        expect(EIP5792_APPROVAL_TYPES.SEND_CALLS).toBe('wallet_sendCalls');
        expect(EIP5792_ERROR_CODES.USER_REJECTED.code).toBe(4001);
        expect(CallBatchStatusCode.Confirmed).toBe(200);
    });

    it('message-manager/types module loads', () => {
        expect(MessageManagerTypes).toBeDefined();
    });

    it('liquid-staking/Types module loads', () => {
        expect(LiquidStakingTypes).toBeDefined();
    });

    it('shared/utils/testData module loads', () => {
        expect(TestData).toBeDefined();
    });
});
