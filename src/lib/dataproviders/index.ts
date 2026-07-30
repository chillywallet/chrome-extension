import { BlockscoutProvider } from './BlockscoutProvider';
import { BlockVisionProvider } from './BlockVisionProvider';
import { registerDataProvider } from './DataProvider';
import { EtherscanV2Provider } from './EtherscanV2Provider';

registerDataProvider('blockscout', context => new BlockscoutProvider(context));
registerDataProvider('etherscan', context => new EtherscanV2Provider(context));
registerDataProvider('blockvision', context => new BlockVisionProvider(context));

export { MissingApiKeyError, clearDataProviderCache, getDataProvider } from './DataProvider';
export type { DataProvider } from './DataProvider';
export * from './types';
