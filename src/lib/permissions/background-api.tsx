import {
    CaveatSpecificationConstraint,
    PermissionController,
    PermissionSpecificationConstraint,
} from '@metamask/permission-controller';
import { nanoid } from 'nanoid';
import { CaveatTypes, RestrictedMethods } from '../../shared/constants/permissions';

export function getPermissionBackgroundApiMethods(
    permissionController: PermissionController<
        PermissionSpecificationConstraint,
        CaveatSpecificationConstraint
    >,
) {
    return {
        addPermittedAccount: (origin: string, account: string) => {
            const _caveat = permissionController.getCaveat(
                origin,
                RestrictedMethods.eth_accounts,
                CaveatTypes.restrictReturnedAccounts,
            );

            if (!_caveat) {
                return;
            }

            //@ts-ignore
            const existingAccounts: string[] = _caveat.value;

            if (existingAccounts.includes(account)) {
                return;
            }

            permissionController.updateCaveat(
                origin,
                RestrictedMethods.eth_accounts,
                CaveatTypes.restrictReturnedAccounts,
                [...existingAccounts, account] as never,
            );
        },

        // To add more than one account when already connected to the dapp
        addMorePermittedAccounts: (origin: string, accounts: string[]) => {
            const _caveat = permissionController.getCaveat(
                origin,
                RestrictedMethods.eth_accounts,
                CaveatTypes.restrictReturnedAccounts,
            );

            if (!_caveat) {
                return;
            }

            //@ts-ignore
            const existingAccounts: string[] = _caveat.value;

            const updatedAccounts = Array.from(new Set([...existingAccounts, ...accounts]));

            if (updatedAccounts.length === existingAccounts.length) {
                return;
            }

            permissionController.updateCaveat(
                origin,
                RestrictedMethods.eth_accounts,
                CaveatTypes.restrictReturnedAccounts,
                updatedAccounts as never,
            );
        },

        removePermittedAccount: (origin: string, account: string) => {
            const _caveat = permissionController.getCaveat(
                origin,
                RestrictedMethods.eth_accounts,
                CaveatTypes.restrictReturnedAccounts,
            );

            if (!_caveat) {
                return;
            }

            //@ts-ignore
            const existingAccounts: string[] = _caveat.value;
            const remainingAccounts = existingAccounts.filter(
                existingAccount => existingAccount !== account,
            );

            if (remainingAccounts.length === existingAccounts.length) {
                return;
            }

            if (remainingAccounts.length === 0) {
                permissionController.revokePermission(origin, RestrictedMethods.eth_accounts);
            } else {
                permissionController.updateCaveat(
                    origin,
                    RestrictedMethods.eth_accounts,
                    CaveatTypes.restrictReturnedAccounts,
                    remainingAccounts as never,
                );
            }
        },

        requestAccountsPermissionWithId: async (origin: string) => {
            const id = nanoid();
            permissionController.requestPermissions(
                { origin },
                {
                    eth_accounts: {},
                },
                { id },
            );
            return id;
        },
    };
}
