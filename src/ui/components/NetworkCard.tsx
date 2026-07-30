import React from 'react';
import { ChainData } from '../../shared/types/Chain';

type Props = {
    network: ChainData;
    selected: boolean;
    onPress: (network: ChainData) => void;
    onCustomizePress: (network: ChainData, e: React.MouseEvent) => void;
    comingSoon?: boolean;
    /**
     * Set when the chain's data provider needs an API key that isn't configured.
     * The row is disabled and explains how to enable it; the customize (RPC) button
     * stays reachable so a user can still point the chain elsewhere.
     */
    missingApiKeyLabel?: string;
};

export default React.memo<Props>((props: Props) => {
    const {
        network,
        selected,
        onPress,
        onCustomizePress,
        comingSoon = false,
        missingApiKeyLabel,
    } = props;

    const gated = comingSoon || !!missingApiKeyLabel;

    const handlePress = (e: React.MouseEvent) => {
        e.preventDefault();
        onPress(network);
    };

    const handleCustomizePress = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onCustomizePress(network, e);
    };

    return (
        <div className="flex flex-row items-center w-full text-sm hover:text-primary px-5 hover:bg-gray-200 dark:hover:bg-darker dark:hover:text-white dark:hover:font-semibold">
            <button
                onClick={handlePress}
                disabled={gated}
                className="flex flex-row items-center flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {/* Decorative: the accessible name comes from the chain name text below,
                    so an empty alt keeps it out of the computed name. */}
                <img
                    src={network.icon}
                    className="w-5 h-5 rounded-full mr-2 overflow-hidden"
                    alt=""
                />
                <div className="flex flex-row items-center flex-1">
                    <p className={selected ? 'ml-2 font-semibold text-primary' : 'ml-2'}>
                        {network.short_name}
                    </p>
                    {comingSoon && (
                        <div className="ml-2 px-2 py-[2px] text-xs bg-primary/10 text-primary border border-primary rounded-full">
                            Coming Soon
                        </div>
                    )}
                    {!comingSoon && missingApiKeyLabel && (
                        <span
                            data-tooltip-id="chilly-tooltip"
                            data-tooltip-content={missingApiKeyLabel}
                            aria-label={missingApiKeyLabel}
                            className="ml-2 w-4 h-4 shrink-0 flex items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none text-gray-500 dark:text-gray-400">
                            i
                        </span>
                    )}
                </div>
            </button>
            <button
                onClick={handleCustomizePress}
                disabled={comingSoon}
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
            </button>
        </div>
    );
});
