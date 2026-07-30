import { Clusters } from '@clustersxyz/sdk';
import { Cluster, Wallet } from '@clustersxyz/sdk/types';
import { ethers } from 'ethers';
import { AnimatePresence, motion } from 'framer-motion';
import _ from 'lodash';
import {
    forwardRef,
    InputHTMLAttributes,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { FaCheckCircle, FaSpinner } from 'react-icons/fa';
import AllDomainsService from '../../lib/AllDomainsService';
import NnsService from '../../lib/NnsService';
import { ANIM_DURATION } from '../../shared/constants/app';
import { ResolvedAddress, ResolvedName } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { smartTrim } from '../../shared/utils/string';
import { useEthProvider, usePreferences } from '../../store/selectors';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    showError: boolean;
    className?: string;
    value: string;
    onResolvedClusterWallet: (wallet: Wallet, name?: string) => void;
    onResolvedAddress: (address: string, name?: string) => void;
}

export type EnsAddress = {
    ens: string;
    address: string;
};

const clusters = new Clusters({ apiKey: process.env.CLUSTERS_API_KEY });

export default forwardRef<HTMLInputElement, TextInputProps>((props, ref) => {
    const {
        className,
        value,
        onChange,
        onResolvedClusterWallet,
        onResolvedAddress,
        showError,
        ...inputProps
    } = props;

    const { enableCluster, enableAllDomains, nnsMetadata } = usePreferences();

    const addressRef = useRef('');

    const provider = useEthProvider();

    const [resolvedNames, setResolvedNames] = useState<ResolvedName[]>([]);
    const [resolvedAddresses, setResolvedAddresses] = useState<ResolvedAddress[]>([]);
    const [resolvedCluster, setResolvedCluster] = useState<Cluster | undefined>(undefined);

    const [error, setError] = useState('');
    const [loadingWalletAddress, setLoadingWalletAddress] = useState(false);
    const [selectedClusterWallet, setSelectedClusterWallet] = useState<Wallet | null>(null);
    const [selectedDomain, setSelectedDomain] = useState<ResolvedAddress | null>(null);

    const label = useMemo(() => {
        let labels = ['ADDRESS'];

        if (enableCluster) {
            labels.push('CLUSTER');
        }

        labels.push('ENS');
        labels.push('NNS');

        if (enableAllDomains) {
            labels.push('ALLDOMAINS');
        }

        let _label = labels.join(', ');

        //insert OR or remove ,
        _label = _label.replace(/,([^,]*)$/, ' OR$1');

        return _label;
    }, [enableAllDomains, enableCluster]);

    const clusterWallets = useMemo(() => {
        return resolvedCluster
            ? resolvedCluster.wallets.filter(item => ethers.isAddress(item.address))
            : [];
    }, [resolvedCluster]);

    const hasError = useMemo(() => {
        return showError && !!error;
    }, [error, showError]);

    const height = useMemo(() => {
        const size = clusterWallets.length + resolvedAddresses.length;
        return size > 2 ? 100 : 45 * size;
    }, [clusterWallets, resolvedAddresses]);

    const onClusterPress = useCallback(
        (item: Wallet) => {
            onResolvedClusterWallet(item, (resolvedCluster?.name ?? '') + item.name);
            setSelectedClusterWallet(item);
        },
        [onResolvedClusterWallet, resolvedCluster],
    );

    const onResolvedAddressPress = useCallback(
        (item: ResolvedAddress) => {
            onResolvedAddress(item.walletAddress, item.domainName);
            setSelectedDomain(item);
        },
        [onResolvedAddress],
    );

    const resetData = useCallback(() => {
        onResolvedAddress('');
        setResolvedCluster(undefined);
        setResolvedNames([]);
        setResolvedAddresses([]);
        setSelectedClusterWallet(null);
        setSelectedDomain(null);
        setError('');
    }, [onResolvedAddress]);

    const ensBounceFunc = useMemo(() => {
        return _.debounce(async (_address: string) => {
            if (addressRef.current !== _address) {
                return;
            }

            resetData();

            if (!_address) {
                setLoadingWalletAddress(false);
                return;
            }

            if (_address === '0x0') {
                onResolvedAddress('0x0000000000000000000000000000000000000000');
            } else if (ethers.isAddress(_address) || _address === '0x0') {
                onResolvedAddress(_address);

                const tasks: Promise<void>[] = [];
                const resolveNames: ResolvedName[] = [];

                if (enableAllDomains) {
                    // AllDomains detection
                    tasks.push(
                        AllDomainsService.getDomainsByAddress(_address)
                            .then(result => {
                                if (result && addressRef.current === _address) {
                                    result.forEach(item => {
                                        resolveNames.push({
                                            name: item.domain_name + item.tld,
                                            provider: 'AllDomains',
                                            color: '#e56a17',
                                        });
                                    });
                                }
                            })
                            .catch(e => {
                                logger.log('Error resolving all domains:', e);
                            }),
                    );
                }
                // NNS Detection
                tasks.push(
                    NnsService.getDomainByAddress(_address, nnsMetadata.chain_id)
                        .then(result => {
                            const nnsData = result.data;

                            if (
                                nnsData &&
                                nnsData.success &&
                                addressRef.current === _address &&
                                nnsData.primaryName
                            ) {
                                resolveNames.push({
                                    name: nnsData.primaryName,
                                    provider: 'NNS',
                                    color: '#4AA8DC',
                                });
                            }
                        })
                        .catch(e => {
                            logger.log('Error resolving NNS:', e);
                        }),
                );
                // Cluster detection
                tasks.push(
                    clusters
                        .getName(_address)
                        .then(result => {
                            // @ts-ignore
                            if (result && result !== 404 && addressRef.current === _address) {
                                resolveNames.push({
                                    name: result,
                                    provider: 'Cluster',
                                    color: '#1D98FF',
                                });
                            }
                        })
                        .catch(e => {
                            logger.log('Error resolving Cluster:', e);
                        }),
                );

                setLoadingWalletAddress(true);
                Promise.all(tasks).then(() => {
                    setResolvedNames(resolveNames);
                    setLoadingWalletAddress(false);

                    if (resolveNames.length) {
                        onResolvedAddress(_address, resolveNames[0].name);
                    }
                });
            } else {
                const tasks: Promise<ResolvedAddress | null>[] = [];
                if (enableAllDomains) {
                    // AllDomains detection
                    tasks.push(
                        new Promise(resolve => {
                            AllDomainsService.getAddressByDomain(_address)
                                .then(result => {
                                    if (addressRef.current === _address && result) {
                                        resolve({
                                            walletAddress: result,
                                            provider: 'AllDomains',
                                            domainName: _address,
                                            color: '#e56a17',
                                        });
                                        return;
                                    }

                                    resolve(null);
                                })
                                .catch(() => resolve(null));
                        }),
                    );
                }
                // NNS detection
                tasks.push(
                    new Promise(resolve => {
                        NnsService.getAddressByDomain(_address, nnsMetadata.chain_id)
                            .then(result => {
                                const nnsData = result.data;

                                if (nnsData && nnsData.success) {
                                    if (
                                        addressRef.current === _address &&
                                        nnsData.resolvedAddress
                                    ) {
                                        resolve({
                                            walletAddress: nnsData.resolvedAddress,
                                            provider: 'NNS',
                                            domainName: _address,
                                            color: '#4AA8DC',
                                        });

                                        return;
                                    }
                                }

                                resolve(null);
                            })
                            .catch(() => resolve(null));
                    }),
                );
                // ENS detection
                tasks.push(
                    new Promise(resolve => {
                        provider
                            .resolveName(_address)
                            .then(result => {
                                if (addressRef.current === _address && result) {
                                    resolve({
                                        walletAddress: result,
                                        provider: 'ENS',
                                        domainName: _address,
                                        color: '#1D98FF',
                                    });
                                    return;
                                }

                                resolve(null);
                            })
                            .catch(() => resolve(null));
                    }),
                );

                setLoadingWalletAddress(true);
                const _resolvedAddresses = (await Promise.all(tasks)).filter(item => !!item);
                setResolvedAddresses(_resolvedAddresses);

                if (!enableCluster || _resolvedAddresses.length) {
                    setLoadingWalletAddress(false);
                    return;
                }

                // Second step: Cluster
                try {
                    const resolvedAddress = await clusters.getCluster(_address);

                    // @ts-ignore
                    if (resolvedAddress === 404) {
                        //weird issue with the sdk
                        throw new Error('Cluster not found');
                    }

                    if (addressRef.current !== _address) {
                        return;
                    }

                    if (resolvedAddress) {
                        setResolvedCluster(resolvedAddress);
                        setLoadingWalletAddress(false);
                        return;
                    }
                } catch (err) {
                    logger.log('Error resolving address:', err);
                }

                setError('Invalid domain and address');
                setLoadingWalletAddress(false);
            }
        }, 500);
    }, [onResolvedAddress, resetData, nnsMetadata, enableCluster, enableAllDomains, provider]);

    useEffect(() => {
        const text = (value ?? '').trim();
        addressRef.current = text;
        ensBounceFunc(text);
    }, [value, ensBounceFunc]);

    useEffect(() => {
        const _selectedClusterWallet = clusterWallets.length === 1 ? clusterWallets[0] : null;
        setSelectedClusterWallet(_selectedClusterWallet);

        if (_selectedClusterWallet) {
            onResolvedClusterWallet(
                _selectedClusterWallet,
                (resolvedCluster?.name ?? '') + _selectedClusterWallet.name,
            );
        }
    }, [clusterWallets, onResolvedClusterWallet, resolvedCluster]);

    useEffect(() => {
        const _selectedDomain = resolvedAddresses.length === 1 ? resolvedAddresses[0] : null;
        setSelectedDomain(_selectedDomain);

        if (_selectedDomain) {
            onResolvedAddress(_selectedDomain.walletAddress, _selectedDomain.domainName);
        }
    }, [resolvedAddresses, onResolvedAddress]);

    return (
        <div className="flex flex-col">
            <div className={className}>
                <div
                    className={
                        'w-full relative border dark:border-neutral-500 rounded-md px-3 py-1 bg-slate-50 dark:bg-dark focus-within:border-primary'
                    }>
                    <label className="text-xs">{label}</label>
                    <input
                        ref={ref}
                        value={value}
                        onChange={onChange}
                        placeholder={'Type to search…'}
                        {...inputProps}
                        className={'text-sm w-full focus:outline-none bg-transparent'}
                    />

                    {loadingWalletAddress && (
                        <div className="absolute right-2 top-6">
                            <FaSpinner className="custom-anim-fast text-primary text-xl z-999" />
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: height }}
                    transition={{ duration: ANIM_DURATION }}>
                    <div className="overflow-y-auto">
                        <div className={'flex flex-col px-3'}>
                            {resolvedAddresses.map(resolvedAddress => {
                                return (
                                    <div
                                        className={
                                            'flex flex-row items-center justify-between border rounded-md px-3 h-[40px] mt-[5px] cursor-pointer ' +
                                            (selectedDomain?.walletAddress ===
                                            resolvedAddress.walletAddress
                                                ? 'bg-slate-200 dark:bg-darker'
                                                : 'bg-transparent')
                                        }
                                        key={resolvedAddress.provider}
                                        onClick={() => {
                                            onResolvedAddressPress(resolvedAddress);
                                        }}>
                                        <div className="flex flex-row text-sm items-center">
                                            <div>{resolvedAddress.domainName}</div>
                                            <div
                                                style={{ background: resolvedAddress.color }}
                                                className="px-2 ml-1 h-[20px] text-[8px] text-white rounded-md">
                                                {resolvedAddress.provider}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {smartTrim(resolvedAddress.walletAddress, 12)}
                                        </div>
                                    </div>
                                );
                            })}
                            {resolvedCluster &&
                                clusterWallets.map(wallet => {
                                    return (
                                        <div
                                            className={
                                                'flex flex-row items-center justify-between border rounded-md px-3 h-[40px] mt-[5px] cursor-pointer ' +
                                                (selectedClusterWallet?.address === wallet.address
                                                    ? 'bg-slate-200 dark:bg-darker'
                                                    : 'bg-transparent')
                                            }
                                            key={wallet.address}
                                            onClick={() => {
                                                onClusterPress(wallet);
                                            }}>
                                            <div className="flex flex-row text-sm items-center">
                                                <div>
                                                    {resolvedCluster.name}
                                                    {wallet.name}
                                                </div>
                                                {wallet.isVerified && (
                                                    <FaCheckCircle className="text-primary text-sm ml-1" />
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {smartTrim(wallet.address, 12)}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {resolvedNames.length > 0 && (
                <div className="mx-3 flex flex-wrap">
                    {resolvedNames.map(_resolvedName => {
                        return (
                            <div
                                key={_resolvedName.provider}
                                style={{ background: _resolvedName.color }}
                                className="px-2 py-1 mr-2 mt-1 text-xs text-white rounded-md">
                                {_resolvedName.provider}: {_resolvedName.name}
                            </div>
                        );
                    })}
                </div>
            )}

            {hasError && <div className="text-red-600 mx-3 text-sm mt-1">{error}</div>}
        </div>
    );
});
