import axios from 'axios';

/**
 * Third-party HTTP utilities. All proprietary-backend and auth endpoints have
 * been removed; what remains are free public APIs.
 */

/** Etherscan-style gas oracle fetch, URL pattern comes from chain config (gas.oracleUrlPattern). */
export const getCustomGasPrice = (url_pattern: string) => {
    return axios({
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        url: url_pattern,
    });
};

/** aPriori liquid staking withdrawal requests (third-party, keyless). */
export const getaPrioriClaimRequests = (walletAddress: string) => {
    return axios({
        method: 'GET',
        headers: {},
        url: `https://stake-api.apr.io/withdrawal_requests?address=${walletAddress}`,
        params: {},
    });
};

export const getCountryCode = () => {
    return fetch('https://ipwho.is/')
        .then(response => response.json())
        .then(data => ({ data }));
};
