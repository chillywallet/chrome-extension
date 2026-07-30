import { getAddress } from 'ethers';
import React, { useCallback, useMemo } from 'react';
import QRCode from 'react-qr-code';
import { ChillyAccount } from '../../shared/types/Wallet';
import { smartTrim } from '../../shared/utils/string';
import Header from './Header';
import Modal from './Modal';
import Toast from './Toast';

type Props = {
    visible: boolean;
    account?: ChillyAccount;
    walletAddress?: string;
    isSmartWallet?: boolean;
    onClosePress: () => void;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, account, isSmartWallet = false, walletAddress } = props;

    const checksumAddress = useMemo(() => {
        try {
            if (walletAddress) {
                return getAddress(walletAddress);
            }

            const _address =
                (isSmartWallet && account?.smartAddress
                    ? account?.smartAddress
                    : account?.address) ?? '';
            return getAddress(_address);
        } catch (error) {
            return '';
        }
    }, [account, isSmartWallet, walletAddress]);

    const name = useMemo(() => {
        return account?.metadata.name ?? '';
    }, [account]);

    const onCopyPress = useCallback(() => {
        navigator.clipboard.writeText(checksumAddress ?? '');
        Toast.showSuccess('Address copied to clipboard');
    }, [checksumAddress]);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onClosePress();
            }}>
            <Header title={'Your Wallet Address'} hasBackButton={false} onClosePress={onClosePress} />
            <div className="flex flex-col items-center p-5">
                <div className="bg-white rounded-lg p-5">
                    <QRCode value={checksumAddress} size={150} />
                </div>
                {walletAddress ? (
                    <div className="flex flex-row w-full border dark:border-darkline shadow-md rounded-lg overflow-hidden bg-ice dark:bg-header my-5 p-3 items-center">
                        <p className="text-sm text-gray-400 flex-1">
                            {smartTrim(checksumAddress, 16)}
                        </p>
                        <div className="flex flex-1 flex-row justify-end">
                            <button
                                className="w-14 h-7 bg-primary text-xs text-white rounded-full hover:bg-primarydark"
                                onClick={onCopyPress}>
                                Copy
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-row w-full border dark:border-darkline shadow-md rounded-lg overflow-hidden bg-ice dark:bg-header my-5 p-3 items-center">
                        <p className="text-sm text-black dark:text-white truncate flex-1">{name}</p>
                        <p className="text-sm text-center text-gray-400 flex-1">
                            {smartTrim(checksumAddress, 10)}
                        </p>
                        <div className="flex flex-1 flex-row justify-end">
                            <button
                                className="w-14 h-7 bg-primary text-xs text-white rounded-full hover:bg-primarydark"
                                onClick={onCopyPress}>
                                Copy
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
});
