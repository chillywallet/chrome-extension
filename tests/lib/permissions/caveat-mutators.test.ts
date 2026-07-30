import { CaveatMutatorOperation } from '@metamask/permission-controller';
import { CaveatMutatorFactories } from '../../../src/lib/permissions/caveat-mutators';
import { CaveatTypes } from '../../../src/shared/constants/permissions';

const removeAccount =
    CaveatMutatorFactories[CaveatTypes.restrictReturnedAccounts].removeAccount;

const ACC1 = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';
const ACC2 = '0xeFA1ec40d0c7c81FfFA51AdC4e72cF8b85bdD6cf';

describe('CaveatMutatorFactories.restrictReturnedAccounts.removeAccount', () => {
    it('returns noop when target is not present', () => {
        const result = removeAccount(ACC1, [ACC2]);
        expect(result.operation).toBe(CaveatMutatorOperation.noop);
    });

    it('updates the value when other accounts remain', () => {
        const result = removeAccount(ACC1, [ACC1, ACC2]);
        expect(result.operation).toBe(CaveatMutatorOperation.updateValue);
        expect((result as any).value).toEqual([ACC2]);
    });

    it('revokes when the array becomes empty', () => {
        const result = removeAccount(ACC1, [ACC1]);
        expect(result.operation).toBe(CaveatMutatorOperation.revokePermission);
    });

    it('normalizes addresses via checksum', () => {
        const lc = ACC1.toLowerCase();
        const result = removeAccount(ACC1, [lc]);
        expect(result.operation).toBe(CaveatMutatorOperation.revokePermission);
    });
});
