import { getPermissionBackgroundApiMethods } from '../../../src/lib/permissions/background-api';
import { CaveatTypes, RestrictedMethods } from '../../../src/shared/constants/permissions';

jest.mock('nanoid', () => ({ nanoid: () => 'fixed-id' }));

const makeController = (override: any = {}) => ({
    getCaveat: jest.fn(),
    updateCaveat: jest.fn(),
    revokePermission: jest.fn(),
    requestPermissions: jest.fn(async () => ({ id: 'p-1' })),
    ...override,
});

describe('getPermissionBackgroundApiMethods', () => {
    describe('addPermittedAccount', () => {
        it('does nothing when no existing caveat', () => {
            const c = makeController();
            getPermissionBackgroundApiMethods(c as any).addPermittedAccount('origin', '0xa');
            expect(c.updateCaveat).not.toHaveBeenCalled();
        });

        it('does nothing when account is already permitted', () => {
            const c = makeController({ getCaveat: jest.fn(() => ({ value: ['0xa'] })) });
            getPermissionBackgroundApiMethods(c as any).addPermittedAccount('origin', '0xa');
            expect(c.updateCaveat).not.toHaveBeenCalled();
        });

        it('appends a new account', () => {
            const c = makeController({ getCaveat: jest.fn(() => ({ value: ['0xa'] })) });
            getPermissionBackgroundApiMethods(c as any).addPermittedAccount('origin', '0xb');
            expect(c.updateCaveat).toHaveBeenCalledWith(
                'origin',
                RestrictedMethods.eth_accounts,
                CaveatTypes.restrictReturnedAccounts,
                ['0xa', '0xb'],
            );
        });
    });

    describe('addMorePermittedAccounts', () => {
        it('does nothing when no caveat', () => {
            const c = makeController();
            getPermissionBackgroundApiMethods(c as any).addMorePermittedAccounts('origin', ['0xa']);
            expect(c.updateCaveat).not.toHaveBeenCalled();
        });

        it('does nothing when all accounts already present', () => {
            const c = makeController({ getCaveat: jest.fn(() => ({ value: ['0xa', '0xb'] })) });
            getPermissionBackgroundApiMethods(c as any).addMorePermittedAccounts('origin', ['0xa']);
            expect(c.updateCaveat).not.toHaveBeenCalled();
        });

        it('adds missing accounts deduped', () => {
            const c = makeController({ getCaveat: jest.fn(() => ({ value: ['0xa'] })) });
            getPermissionBackgroundApiMethods(c as any).addMorePermittedAccounts('origin', ['0xa', '0xb']);
            expect(c.updateCaveat).toHaveBeenCalled();
            const updateArgs = c.updateCaveat.mock.calls[0][3];
            expect(updateArgs).toEqual(['0xa', '0xb']);
        });
    });

    describe('removePermittedAccount', () => {
        it('does nothing when no caveat', () => {
            const c = makeController();
            getPermissionBackgroundApiMethods(c as any).removePermittedAccount('origin', '0xa');
            expect(c.updateCaveat).not.toHaveBeenCalled();
        });

        it('does nothing when account is not present', () => {
            const c = makeController({ getCaveat: jest.fn(() => ({ value: ['0xa'] })) });
            getPermissionBackgroundApiMethods(c as any).removePermittedAccount('origin', '0xb');
            expect(c.updateCaveat).not.toHaveBeenCalled();
        });

        it('revokes permission when last account is removed', () => {
            const c = makeController({ getCaveat: jest.fn(() => ({ value: ['0xa'] })) });
            getPermissionBackgroundApiMethods(c as any).removePermittedAccount('origin', '0xa');
            expect(c.revokePermission).toHaveBeenCalledWith('origin', RestrictedMethods.eth_accounts);
        });

        it('updates caveat when more than one account remains', () => {
            const c = makeController({ getCaveat: jest.fn(() => ({ value: ['0xa', '0xb'] })) });
            getPermissionBackgroundApiMethods(c as any).removePermittedAccount('origin', '0xa');
            expect(c.updateCaveat).toHaveBeenCalledWith(
                'origin',
                RestrictedMethods.eth_accounts,
                CaveatTypes.restrictReturnedAccounts,
                ['0xb'],
            );
        });
    });

    describe('requestAccountsPermissionWithId', () => {
        it('returns the generated id and requests permissions', async () => {
            const c = makeController();
            const id = await getPermissionBackgroundApiMethods(c as any).requestAccountsPermissionWithId(
                'origin',
            );
            expect(id).toBe('fixed-id');
            expect(c.requestPermissions).toHaveBeenCalled();
        });
    });
});
