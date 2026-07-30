// Smoke test that the DappInteraction page modules load and expose components.
// These pages are exercised indirectly via DappConfirmationScreens /
// PermissionSwitchSignature / TokenAllowanceScreens / SendCallsConfirmation tests;
// this file just ensures the modules themselves stay importable.

describe('DappInteraction page modules', () => {
    const pages = [
        'ContractInteractionConfirmation',
        'DeployContractConfirmation',
        'PermissionConnect',
        'SendNativeCoinConfirmation',
        'SendOtherCoinConfirmation',
        'SignatureRequest',
        'SwitchNetwork',
        'TokenAllowance',
        'TokenAllowanceConfirmation',
    ];

    it.each(pages)('%s exports a default component', name => {
        const mod = require(`../../../../src/ui/pages/DappInteraction/${name}`);
        expect(mod.default).toBeDefined();
    });
});
