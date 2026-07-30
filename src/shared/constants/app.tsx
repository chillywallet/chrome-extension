import { RestrictedMethods } from './permissions';

export const ORIGIN_CHILLY = 'chilly';

export const PRIMARY_COLOR = '#4AA8DC';

export const CHROME_WEB_STORE_URL =
    'https://chromewebstore.google.com/detail/chilly-wallet/andhndehpcjpmneneealacgnmealilal';

export const ENVIRONMENT_TYPE_POPUP = 'popup';
export const ENVIRONMENT_TYPE_NOTIFICATION = 'notification';
export const ENVIRONMENT_TYPE_FULLSCREEN = 'fullscreen';
export const ENVIRONMENT_TYPE_BACKGROUND = 'background';
export const ENVIRONMENT_TYPE_SIDEPANEL = 'sidepanel';

export const CONNECTION_READY = 'CONNECTION_READY';
export const CHILLY_EXTENSION_READY = 'CHILLY_EXTENSION_READY';

export type EnvironmentType = 'popup' | 'notification' | 'fullscreen' | 'background' | 'sidepanel';

export const PLATFORM_BRAVE = 'Brave';
export const PLATFORM_CHROME = 'Chrome';
export const PLATFORM_EDGE = 'Edge';
export const PLATFORM_FIREFOX = 'Firefox';
export const PLATFORM_OPERA = 'Opera';

export const MESSAGE_TYPE = {
    ADD_ETHEREUM_CHAIN: 'wallet_addEthereumChain',
    ADD_CUSTOM_RPC: 'wallet_addCustomRPC',
    ETH_ACCOUNTS: RestrictedMethods.eth_accounts,
    ETH_DECRYPT: 'eth_decrypt',
    ETH_CHAIN_ID: 'eth_chainId',
    ETH_GET_ENCRYPTION_PUBLIC_KEY: 'eth_getEncryptionPublicKey',
    ETH_GET_BLOCK_BY_NUMBER: 'eth_getBlockByNumber',
    ETH_REQUEST_ACCOUNTS: 'eth_requestAccounts',
    ETH_SIGN: 'eth_sign',
    ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
    ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
    ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
    GET_PROVIDER_STATE: 'chilly_getProviderState',
    PERSONAL_SIGN: 'personal_sign',
    SEND_METADATA: 'chilly_sendDomainMetadata',
    SWITCH_ETHEREUM_CHAIN: 'wallet_switchEthereumChain',
    TRANSACTION: 'transaction',
    WALLET_REQUEST_PERMISSIONS: 'wallet_requestPermissions',
    WATCH_ASSET: 'wallet_watchAsset',
    // EIP5792
    WALLET_GET_CAPABILITIES: 'wallet_getCapabilities',
    WALLET_SEND_CALLS: 'wallet_sendCalls',
    WALLET_GET_CALLS_STATUS: 'wallet_getCallsStatus',
    WALLET_SHOW_CALLS_STATUS: 'wallet_showCallsStatus',
} as const;

export const UI_DELAY_INTERNAL = 2000;

export const ANIM_DURATION = 0.3;

export const REMOTE_CONFIG_CACHE_INTERVAL = 60000; // 1 Min

export const BALANCE_CACHE_INTERVAL = 2000; // 2 seconds

export const COIN_PRICE_CACHE_INTERVAL = 180000; // 3 minutes
