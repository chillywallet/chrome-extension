export const ZERO_CODE_VALUES = new Set(['0x', '0x0']);

const toAddress = (value: number | string): string => {
    const hex = typeof value === 'number' ? value.toString(16) : value.replace(/^0x/i, '');

    return `0x${hex.padStart(40, '0')}`.toLowerCase();
};

const rangeAddresses = (from: number, to: number): string[] => {
    const addresses: string[] = [];

    for (let i = from; i <= to; i += 1) {
        addresses.push(toAddress(i));
    }

    return addresses;
};

const ETHEREUM_PRECOMPILES = [
    // Ethereum standard precompiles:
    // 0x01 ecrecover
    // 0x02 sha256
    // 0x03 ripemd160
    // 0x04 identity
    // 0x05 modexp
    // 0x06 alt_bn128 add
    // 0x07 alt_bn128 mul
    // 0x08 alt_bn128 pairing
    // 0x09 blake2f
    // 0x0a point evaluation / KZG
    ...rangeAddresses(0x01, 0x0a),
];

const MONAD_PRECOMPILES = [
    // Monad supports Ethereum precompiles 0x01 to 0x11,
    // plus P256 at 0x0100 and staking at 0x1000.
    ...rangeAddresses(0x01, 0x11),
    toAddress(0x0100),
    toAddress(0x1000),
];

const ARBITRUM_SYSTEM_PRECOMPILES = [
    // Arbitrum-specific precompiles.
    // These are in addition to standard Ethereum precompiles.
    toAddress(0x64), // ArbSys
    toAddress(0x65), // ArbInfo
    toAddress(0x66), // ArbAddressTable
    toAddress(0x67), // ArbBLS
    toAddress(0x68), // ArbFunctionTable
    toAddress(0x69), // ArbGasInfo
    toAddress(0x6a), // ArbAggregator
    toAddress(0x6b), // ArbRetryableTx
    toAddress(0x6c), // ArbStatistics
    toAddress(0x6d), // ArbOwner
    toAddress(0x6e), // ArbWasm
    toAddress(0x6f), // ArbWasmCache
    toAddress(0x70), // ArbNativeTokenManager
];

const OP_STACK_PREDEPLOYS = [
    // Common OP Stack / Base predeploys.
    // These often have bytecode, but we mark them as system addresses too.
    '0x4200000000000000000000000000000000000000', // LegacyERC20ETH
    '0x4200000000000000000000000000000000000001', // WETH9
    '0x4200000000000000000000000000000000000002', // L2ToL1MessagePasser legacy
    '0x4200000000000000000000000000000000000006', // WETH
    '0x4200000000000000000000000000000000000007', // L2CrossDomainMessenger
    '0x4200000000000000000000000000000000000010', // L2StandardBridge
    '0x4200000000000000000000000000000000000011', // SequencerFeeVault
    '0x4200000000000000000000000000000000000012', // OptimismMintableERC20Factory
    '0x4200000000000000000000000000000000000013', // L1BlockNumber
    '0x4200000000000000000000000000000000000014', // L2ERC721Bridge
    '0x4200000000000000000000000000000000000015', // L1Block
    '0x4200000000000000000000000000000000000016', // L2ToL1MessagePasser
    '0x4200000000000000000000000000000000000018', // ProxyAdmin
    '0x4200000000000000000000000000000000000019', // BaseFeeVault
    '0x4200000000000000000000000000000000000020', // L1FeeVault
    '0x4200000000000000000000000000000000000021', // SchemaRegistry
    '0x4200000000000000000000000000000000000022', // EAS
    '0x4200000000000000000000000000000000000042', // Native token on OP-style chains, if used
].map(address => address.toLowerCase());

const AVALANCHE_SYSTEM_PRECOMPILES = [
    // Avalanche C-Chain supports normal Ethereum precompiles.
    // These 0x02... addresses are Avalanche/Subnet-EVM stateful precompile addresses.
    // On C-Chain, only include them if your RPC/network actually exposes them.
    '0x0200000000000000000000000000000000000000',
    '0x0200000000000000000000000000000000000001',
    '0x0200000000000000000000000000000000000002',
    '0x0200000000000000000000000000000000000003',
    '0x0200000000000000000000000000000000000004',
    '0x0200000000000000000000000000000000000005',
].map(address => address.toLowerCase());

const COMMON_EVM_CHAINS_WITH_ETH_PRECOMPILES = [
    1, // Ethereum
    11155111, // Sepolia
    56, // BSC
    43114, // Avalanche C-Chain
    137, // Polygon
    80002, // Polygon Amoy
];

const PRECOMPILE_OR_SYSTEM_ADDRESSES_BY_CHAIN_ID: Record<number, Set<string>> = {
    // Monad Mainnet
    // Chain ID: 143
    143: new Set(MONAD_PRECOMPILES),

    // Monad Testnet
    // Chain ID: 10143
    10143: new Set(MONAD_PRECOMPILES),

    // Ethereum
    1: new Set(ETHEREUM_PRECOMPILES),

    // Sepolia
    11155111: new Set(ETHEREUM_PRECOMPILES),

    // Base
    8453: new Set([...ETHEREUM_PRECOMPILES, ...OP_STACK_PREDEPLOYS]),

    // Base Sepolia
    84532: new Set([...ETHEREUM_PRECOMPILES, ...OP_STACK_PREDEPLOYS]),

    // BSC
    56: new Set(ETHEREUM_PRECOMPILES),

    // Arbitrum One
    42161: new Set([...ETHEREUM_PRECOMPILES, ...ARBITRUM_SYSTEM_PRECOMPILES]),

    // Avalanche C-Chain
    43114: new Set([...ETHEREUM_PRECOMPILES, ...AVALANCHE_SYSTEM_PRECOMPILES]),

    // Polygon PoS
    137: new Set(ETHEREUM_PRECOMPILES),

    // Polygon Amoy
    80002: new Set(ETHEREUM_PRECOMPILES),
};

export function isKnownPrecompileOrSystemAddress(chainId: number, address: string): boolean {
    const normalizedAddress = address.toLowerCase();

    const chainSpecificAddresses = PRECOMPILE_OR_SYSTEM_ADDRESSES_BY_CHAIN_ID[chainId];

    if (chainSpecificAddresses?.has(normalizedAddress)) {
        return true;
    }

    // Optional fallback for common EVM-compatible chains.
    // This is useful if a supported chain was not added to the registry yet.
    if (
        COMMON_EVM_CHAINS_WITH_ETH_PRECOMPILES.includes(chainId) &&
        ETHEREUM_PRECOMPILES.includes(normalizedAddress)
    ) {
        return true;
    }

    return false;
}
