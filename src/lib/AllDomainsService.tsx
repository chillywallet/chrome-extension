/* eslint-disable import/no-anonymous-default-export */
import { NameRecord, NetworkWithRpc, TldParser } from '@onsol/tldparser';
import { ethers } from 'ethers';
import { getRpcUrlOnUIScript } from '../store/selectorUtils';
import { getCurrentChainByChain } from './ChainsUtils';

export default {
    getDomainsByAddress: async (address: string) => {
        const chain = getCurrentChainByChain('monad');

        if (!chain) {
            return;
        }
        const rpcUrl = getRpcUrlOnUIScript(chain);

        if (rpcUrl) {
            const settings = new NetworkWithRpc('monad', chain.chain_id, rpcUrl);
            const parser = new TldParser(settings, 'monad');

            const PUBLIC_KEY = ethers.getAddress(address);
            const mainDomain = (await parser.getAllUserDomains(PUBLIC_KEY)) as NameRecord[];
            return mainDomain;
        }
    },
    getAddressByDomain: async (domain: string) => {
        const chain = getCurrentChainByChain('monad');

        if (!chain) {
            return;
        }
        const rpcUrl = getRpcUrlOnUIScript(chain);

        if (rpcUrl) {
            const settings = new NetworkWithRpc('monad', chain.chain_id, rpcUrl);
            const parser = new TldParser(settings, 'monad');

            const address = await parser.getOwnerFromDomainTld(domain);

            return address !== '0x0000000000000000000000000000000000000000'
                ? (address as string)
                : undefined;
        }
    },
};
