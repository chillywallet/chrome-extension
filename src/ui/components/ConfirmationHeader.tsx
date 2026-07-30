import { getAddress } from 'ethers';
import React, { useMemo } from 'react';
import { FaArrowRight } from 'react-icons/fa';
import { useActualTheme } from '../../store/selectors';
import EmojiView from './EmojiView';
import TextTruncate from './TextTruncate';
import Toast from './Toast';

type Account = {
    emoji?: string | null;
    name?: string | null;
    address?: string;
};

type Props = {
    from: Account;
    to?: Account | null;
    className?: string;
    mode?: 'full' | 'padding';
};

export default React.memo<Props>((props: Props) => {
    const { from, to, className, mode = 'full' } = props;

    const actualTheme = useActualTheme();

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    const widthClass = useMemo(() => {
        if (mode === 'full') {
            return 'w-[calc(50vw-40px)] sm:w-[calc(225px-40px)] lg:w-[300px]';
        } else {
            return 'w-[calc(50vw-100px)] sm:w-[calc(225px-100px)] lg:w-[300px]';
        }
    }, [mode]);

    const bgClass = useMemo(() => {
        if (mode === 'full') {
            return 'bg-slate-50 dark:bg-dark border-b border-slate-200 dark:border-darkline';
        } else {
            return 'bg-white dark:bg-dark border border-slate-200 dark:border-darkline rounded-xl';
        }
    }, [mode]);

    const emojiSize = useMemo(() => {
        if (mode === 'full') {
            return 22;
        } else {
            return 32;
        }
    }, [mode]);

    const checksumFromAddress = useMemo(() => {
        try {
            return getAddress(from.address ?? '');
        } catch (error) {
            return from.address ?? '';
        }
    }, [from.address]);

    const checksumToAddress = useMemo(() => {
        if (!to) return '';

        try {
            return getAddress(to.address ?? '');
        } catch (error) {
            return to.address ?? '';
        }
    }, [to]);

    return (
        <div className={' grid grid-cols-11 gap-2 text-sm px-3 py-3 ' + bgClass + ' ' + className}>
            <div className="col-span-5 flex flex-row items-center">
                <div className="shrink-0">
                    <EmojiView
                        emoji={from.emoji}
                        walletAddress={from.address}
                        width={emojiSize}
                        emojiSize={12}
                    />
                </div>
                <div className="ml-2 flex-1">
                    {from.name && (
                        <TextTruncate
                            text={from.name}
                            className={'font-semibold whitespace-nowrap ' + widthClass}
                            position="end"
                        />
                    )}
                    <TextTruncate
                        text={checksumFromAddress}
                        className={'text-gray-400 cursor-pointer whitespace-nowrap ' + widthClass}
                        data-tooltip-id="chilly-tooltip"
                        data-tooltip-variant={tooltipVariant}
                        data-tooltip-content="Click to copy address"
                        data-tooltip-place="bottom"
                        onClick={() => {
                            navigator.clipboard.writeText(checksumFromAddress);

                            Toast.showSuccess('Address copied to clipboard');
                        }}
                    />
                </div>
            </div>
            {to ? (
                <>
                    <div className="col-span-1 text-center pt-3">
                        <FaArrowRight className="text-md inline-block" />
                    </div>
                    <div className="col-span-5 flex flex-row items-center">
                        {to.emoji || to.address ? (
                            <div className="shrink-0">
                                <EmojiView
                                    emoji={to.emoji}
                                    walletAddress={to.address}
                                    width={emojiSize}
                                    emojiSize={12}
                                />
                            </div>
                        ) : null}
                        <div className="ml-2 flex-1">
                            {to.name && (
                                <TextTruncate
                                    text={to.name}
                                    className={'font-semibold whitespace-nowrap ' + widthClass}
                                    position="end"
                                />
                            )}
                            <TextTruncate
                                text={checksumToAddress}
                                className={
                                    'text-gray-400 cursor-pointer whitespace-nowrap ' + widthClass
                                }
                                data-tooltip-id="chilly-tooltip"
                                data-tooltip-variant={tooltipVariant}
                                data-tooltip-content="Click to copy address"
                                data-tooltip-place="bottom"
                                onClick={() => {
                                    navigator.clipboard.writeText(checksumToAddress);

                                    Toast.showSuccess('Address copied to clipboard');
                                }}
                            />
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
});
