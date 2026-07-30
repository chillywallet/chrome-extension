import { PlatformCoin } from '../types/Wallet';
import { Images } from '../utils/Images';

export const UNSUPPORTED_RPC_METHODS = new Set(['eth_signTransaction' as const]);
export const MAX_TOKEN_ALLOWANCE =
    '115792089237316195423570985008687907853269984665640564039457584007913129639935';
export const USD_COIN_ID = '616756cb97b3be542eb70b10';
export const USD_COIN: PlatformCoin = {
    coinId: 'usd_coin',
    latest: {
        price: 1,
        percent_change_24h: 0,
    },
    icon: Images.coinUSD,
    name: 'USD',
    symbol: 'USD',
    rank: 0,
    id: 9999,
    logo: '',
    logo_lrg: '',
    coinAddress: '',
    platformId: 0,
    is_verified: false,
};

export const EVM_NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const POLYGON_NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000001010';
