import messages from '../../../src/lib/providers/messages';

describe('provider messages', () => {
    it('exposes error message factories', () => {
        expect(messages.errors.disconnected()).toMatch(/Disconnected/);
        expect(messages.errors.permanentlyDisconnected()).toMatch(/reload/i);
        expect(messages.errors.unsupportedSync('eth_sign')).toMatch(/eth_sign/);
        expect(messages.errors.invalidLoggerMethod('log')).toMatch(/log/);
    });

    it('exposes all remaining error message factories', () => {
        expect(messages.errors.sendSiteMetadata()).toMatch(/site metadata/);
        expect(messages.errors.invalidDuplexStream()).toMatch(/duplex stream/);
        expect(messages.errors.invalidNetworkParams()).toMatch(/invalid network parameters/i);
        expect(messages.errors.invalidRequestArgs()).toMatch(/single, non-array, object argument/);
        expect(messages.errors.invalidRequestMethod()).toMatch(/args.method/);
        expect(messages.errors.invalidRequestParams()).toMatch(/args.params/);
        expect(messages.errors.invalidLoggerObject()).toMatch(/args.logger/);
    });

    it('exposes connected info', () => {
        expect(messages.info.connected('0x1')).toMatch(/0x1/);
    });

    it('exposes warning text', () => {
        expect(messages.warnings.chainIdDeprecation).toMatch(/chainId/);
        expect(messages.warnings.events.close).toMatch(/disconnect/);
        expect(messages.warnings.rpc.ethDecryptDeprecation).toMatch(/eth_decrypt/);
    });
});
