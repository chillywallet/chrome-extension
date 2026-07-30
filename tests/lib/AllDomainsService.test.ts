import AllDomainsService from '../../src/lib/AllDomainsService';
import { getCurrentChainByChain } from '../../src/lib/ChainsUtils';
import { getRpcUrlOnUIScript } from '../../src/store/selectorUtils';

jest.mock('../../src/lib/ChainsUtils', () => ({
    getCurrentChainByChain: jest.fn(() => null),
}));

jest.mock('../../src/store/selectorUtils', () => ({
    getRpcUrlOnUIScript: jest.fn(() => 'https://rpc.monad'),
}));

jest.mock('@onsol/tldparser', () => ({
    __esModule: true,
    NetworkWithRpc: function MockNetworkWithRpc(name: string, id: number, rpc: string) {
        return { name, id, rpc };
    },
    TldParser: function MockTldParser(this: any) {
        this.getAllUserDomains = jest.fn(async () => [{ name: 'foo' }]);
        this.getOwnerFromDomainTld = jest.fn(async () => '0xowner');
        return this;
    },
}));

jest.mock('ethers', () => ({
    __esModule: true,
    ethers: {
        getAddress: (x: string) => x.toLowerCase(),
    },
}));

describe('AllDomainsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getRpcUrlOnUIScript as jest.Mock).mockReturnValue('https://rpc.monad');
    });

    it('getDomainsByAddress returns undefined when no chain available', async () => {
        (getCurrentChainByChain as jest.Mock).mockReturnValue(null);
        const result = await AllDomainsService.getDomainsByAddress('0xabc');
        expect(result).toBeUndefined();
    });

    it('getDomainsByAddress returns parsed domains when chain found', async () => {
        (getCurrentChainByChain as jest.Mock).mockReturnValue({ chain_id: 1 });
        const result = await AllDomainsService.getDomainsByAddress('0xabc');
        expect(result).toEqual([{ name: 'foo' }]);
    });

    it('getDomainsByAddress returns undefined when rpcUrl is empty', async () => {
        (getCurrentChainByChain as jest.Mock).mockReturnValue({ chain_id: 1 });
        (getRpcUrlOnUIScript as jest.Mock).mockReturnValueOnce('');
        const result = await AllDomainsService.getDomainsByAddress('0xabc');
        expect(result).toBeUndefined();
    });

    it('getAddressByDomain returns undefined when no chain available', async () => {
        (getCurrentChainByChain as jest.Mock).mockReturnValue(null);
        const result = await AllDomainsService.getAddressByDomain('foo.monad');
        expect(result).toBeUndefined();
    });

    it('getAddressByDomain returns owner when found', async () => {
        (getCurrentChainByChain as jest.Mock).mockReturnValue({ chain_id: 1 });
        const result = await AllDomainsService.getAddressByDomain('foo.monad');
        expect(result).toBe('0xowner');
    });

    it('getAddressByDomain returns undefined when rpcUrl is empty', async () => {
        (getCurrentChainByChain as jest.Mock).mockReturnValue({ chain_id: 1 });
        (getRpcUrlOnUIScript as jest.Mock).mockReturnValueOnce('');
        const result = await AllDomainsService.getAddressByDomain('foo.monad');
        expect(result).toBeUndefined();
    });

    it('getAddressByDomain returns undefined when zero address is returned', async () => {
        (getCurrentChainByChain as jest.Mock).mockReturnValue({ chain_id: 1 });
        // Re-define the TldParser mock so getOwnerFromDomainTld returns zero
        const tld = require('@onsol/tldparser');
        const original = tld.TldParser;
        tld.TldParser = function MockTldParser(this: any) {
            this.getOwnerFromDomainTld = jest.fn(
                async () => '0x0000000000000000000000000000000000000000',
            );
            return this;
        };
        const result = await AllDomainsService.getAddressByDomain('foo.monad');
        expect(result).toBeUndefined();
        tld.TldParser = original;
    });
});
