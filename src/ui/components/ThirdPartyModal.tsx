import React, { useMemo } from 'react';
import { FaExternalLinkAlt, FaQuestionCircle } from 'react-icons/fa';
import { MdContentCopy } from 'react-icons/md';
import { smartTrim } from '../../shared/utils/string';
import { useActualTheme, useSelectedNetwork } from '../../store/selectors';
import Modal from './Modal';
import SafeImage from './SafeImage';
import Toast from './Toast';

type Props = {
    visible: boolean;
    onClose: () => void;

    tokenLogo?: string;
    tokenSymbol: string;
    tokenAddress: string;
    spenderAddress: string;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClose, tokenLogo, tokenSymbol, tokenAddress, spenderAddress } = props;

    const actualTheme = useActualTheme();

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    const selectedNetwork = useSelectedNetwork();

    return (
        <Modal visible={visible} onClose={onClose}>
            <div className="p-5">
                <div className="text-sm font-semibold mb-3">Third-party details</div>
                <div className="text-xs mb-3">
                    To protect your assets, verify the details of the third party requesting access
                    to your tokens.
                </div>
                <div className="text-xs mb-1">Token contract</div>
                <div className="flex flex-row items-center border dark:border-darkline rounded-md bg-white dark:bg-dark px-3 py-1 mb-3">
                    <SafeImage
                        src={tokenLogo ?? ''}
                        alt={'Subject logo'}
                        className="w-6 h-6 object-contain rounded-md mr-2"
                    />
                    <div className="flex-1 mr-3">
                        <div>{tokenSymbol ?? 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{smartTrim(tokenAddress, 10)}</div>
                    </div>

                    <div
                        className="cursor-pointer text-primary mr-2"
                        data-tooltip-id="chilly-tooltip"
                        data-tooltip-variant={tooltipVariant}
                        data-tooltip-content="Copy to clipboard"
                        data-tooltip-place="top"
                        onClick={() => {
                            if (tokenAddress) {
                                Toast.showSuccess('Copied to clipboard');
                                navigator.clipboard.writeText(tokenAddress);
                            }
                        }}>
                        <MdContentCopy />
                    </div>

                    <div
                        className="cursor-pointer text-primary"
                        data-tooltip-id="chilly-tooltip"
                        data-tooltip-variant={tooltipVariant}
                        data-tooltip-content="Open in block explorer"
                        data-tooltip-place="top"
                        onClick={() => {
                            if (tokenAddress && selectedNetwork.explorer_url) {
                                global.platform.openLink(
                                    selectedNetwork.explorer_url + '/address/' + tokenAddress,
                                    '_blank',
                                );
                            }
                        }}>
                        <FaExternalLinkAlt />
                    </div>
                </div>

                <div className="text-xs mb-1">Third party requesting spending cap</div>
                <div className="flex flex-row items-center border dark:border-darkline rounded-md bg-white dark:bg-dark px-3 py-1 mb-3">
                    <FaQuestionCircle className="text-primary mr-2" />
                    <div className="flex-1 mr-3">{smartTrim(spenderAddress, 10)}</div>

                    <div
                        className="cursor-pointer text-primary mr-2"
                        data-tooltip-id="chilly-tooltip"
                        data-tooltip-variant={tooltipVariant}
                        data-tooltip-content="Copy to clipboard"
                        data-tooltip-place="top"
                        onClick={() => {
                            if (spenderAddress) {
                                Toast.showSuccess('Copied to clipboard');
                                navigator.clipboard.writeText(spenderAddress);
                            }
                        }}>
                        <MdContentCopy />
                    </div>

                    <div
                        className="cursor-pointer text-primary"
                        data-tooltip-id="chilly-tooltip"
                        data-tooltip-variant={tooltipVariant}
                        data-tooltip-content="Open in block explorer"
                        data-tooltip-place="top"
                        onClick={() => {
                            if (spenderAddress && selectedNetwork.explorer_url) {
                                global.platform.openLink(
                                    selectedNetwork.explorer_url + '/address/' + spenderAddress,
                                    '_blank',
                                );
                            }
                        }}>
                        <FaExternalLinkAlt />
                    </div>
                </div>

                <button className="btn w-full" onClick={onClose}>
                    Close
                </button>
            </div>
        </Modal>
    );
});
