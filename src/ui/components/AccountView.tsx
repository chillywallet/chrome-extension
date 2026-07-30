import { getAddress } from 'ethers';
import React, { useMemo } from 'react';
import { ChillyAccount } from '../../shared/types/Wallet';
import { smartTrim } from '../../shared/utils/string';
import { useCurrentAccount } from '../../store/selectors';
import EmojiView from './EmojiView';

type Props = {
    account?: ChillyAccount;
    className?: string;
    onPress?: (account: ChillyAccount) => void;
    isSmartWallet?: boolean;
};

export default React.memo<Props>((props: Props) => {
    const { account, className, onPress, isSmartWallet = false } = props;

    const currentAccount = useCurrentAccount();

    const activeAccount = useMemo(() => {
        if (!account) {
            return currentAccount;
        }
        return account;
    }, [account, currentAccount]);

    const activeWalletAddress = useMemo(() => {
        if (isSmartWallet) {
            return activeAccount?.smartAddress ?? '';
        }

        return activeAccount?.address ?? '';
    }, [activeAccount, isSmartWallet]);

    const emoji = useMemo(() => {
        return isSmartWallet ? activeAccount?.metadata.avatar : activeAccount?.metadata.smartAvatar;
    }, [activeAccount?.metadata.avatar, activeAccount?.metadata.smartAvatar, isSmartWallet]);

    if (activeAccount) {
        return (
            <button
                disabled={!onPress}
                onClick={e => {
                    e.preventDefault();
                    onPress && onPress(activeAccount);
                }}
                key={activeAccount.id}
                className={
                    'flex flex-row items-center text-sm rounded-lg bg-ice dark:bg-header p-3 ' +
                    className
                }>
                <EmojiView
                    emoji={emoji}
                    walletAddress={activeWalletAddress}
                    width={32}
                    emojiSize={12}
                />
                <div className={'ml-3 mr-2 text-left flex-1 overflow-hidden'}>
                    <p className={'truncate w-[200px]'}>{activeAccount.metadata.name}</p>
                    <p className="text-gray-400">
                        {smartTrim(getAddress(activeWalletAddress), 15)}
                    </p>
                </div>
                {onPress ? <p className="text-primary text-xs font-semibold">CHANGE</p> : null}
            </button>
        );
    }

    return null;
});
