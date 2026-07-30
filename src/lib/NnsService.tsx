/* eslint-disable import/no-anonymous-default-export */
import axios from 'axios';

const NNS_BASE_URL = 'https://api.nad.domains';
export default {
    getDomainByAddress: (address: string, chain_id: number | undefined) => {
        return axios.get(`${NNS_BASE_URL}/v1/protocol/primary-name/${address}?chainId=${chain_id}`);
    },
    getAddressByDomain: (domain: string, chain_id: number | undefined) => {
        return axios.get(
            `${NNS_BASE_URL}/v1/protocol/resolved-address/${domain.toLowerCase()}?chainId=${chain_id}`,
        );
    },
};
