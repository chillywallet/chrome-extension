export const AUTOMATION_ERRORS: Record<string, string> = {
    BALANCE_TOO_LOW: 'Insufficient funds',
    CAN_NOT_PAY_FEES: 'Insufficient funds',
    ALLOWANCE_NOT_ENOUGH: 'Insufficient allowance',
    INVALID_PLATFORM_ID: 'Unsupported chain',
    SWAP_FAILED: 'Swap failed',
    INCORRECT_TOKEN_PAIR: 'Invalid token pair',
    TOKEN_PAIR_NOT_FOUND_IN_DEX: 'Token Pair not found or swap amount too small',
    NOT_AVAILABLE_TO_PROCEED: 'Transaction cannot proceed',
    AUTOMATION_DOES_NOT_EXIST: 'Auto Swap not found',
    APPROVE_FAILED: 'Approval failed',
    SLIPPAGE_EXCEED: 'Slippage Exceeded',
};
