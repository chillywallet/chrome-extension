import { NOTIFICATION_NAMES } from '../../../src/lib/permissions/enums';

describe('NOTIFICATION_NAMES', () => {
    it('exposes chilly-prefixed notification names', () => {
        expect(NOTIFICATION_NAMES.accountsChanged).toBe('chilly_accountsChanged');
        expect(NOTIFICATION_NAMES.unlockStateChanged).toBe('chilly_unlockStateChanged');
        expect(NOTIFICATION_NAMES.chainChanged).toBe('chilly_chainChanged');
    });
});
