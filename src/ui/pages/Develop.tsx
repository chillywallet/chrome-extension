import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { API_KEY_INFO, DataProviderPreset, getDataProviderPresets } from '../../config';
import { CURRENT_CHAINS } from '../../lib/ChainsUtils';
import { DEFAULT_ROUTE } from '../../shared/constants/routes';
import { setApiKey, setChainDataProvider, setPreferences } from '../../store/actions/uiActions';
import { usePreferences } from '../../store/selectors';
import Dropdown from '../components/Dropdown';
import Header from '../components/Header';
import TextInput from '../components/TextInput';
import Toast from '../components/Toast';

type Props = {};

const SECTION_CLASS = 'bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkline/60 rounded-2xl p-6';
const HEADING_CLASS = 'text-lg font-medium text-gray-900 dark:text-white mb-4';
const HINT_CLASS = 'text-sm text-gray-600 dark:text-gray-400 mb-4';

export default React.memo<Props>((props: Props) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const preferences = usePreferences();

    const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => ({
        ...(preferences.apiKeys ?? {}),
    }));
    const [isLoading, setIsLoading] = useState(false);
    const saveInFlightRef = useRef(false);

    const customNetworks = preferences.customNetworks;

    /** The preset currently in effect per chain, falling back to the committed default. */
    const selectedPresetIds = useMemo(() => {
        const selection: Record<number, string> = {};

        CURRENT_CHAINS.forEach(chain => {
            const override = customNetworks?.find(
                (entry: any) => entry.chain_id === chain.chain_id,
            )?.dataProvider;
            const presets = getDataProviderPresets(chain.chain_id);
            const active = override
                ? presets.find(
                      preset =>
                          preset.kind === override.kind &&
                          (!override.baseUrl || preset.baseUrl === override.baseUrl),
                  )
                : presets.find(preset => preset.isDefault);

            if (active) {
                selection[chain.chain_id] = active.id;
            }
        });

        return selection;
    }, [customNetworks]);

    const handleApiKeyChange = useCallback((apiKeyRef: string, value: string) => {
        setApiKeys(current => ({ ...current, [apiKeyRef]: value }));
    }, []);

    const handleProviderChange = useCallback(
        async (chainId: number, preset: DataProviderPreset) => {
            try {
                await dispatch(
                    setChainDataProvider(
                        chainId,
                        preset.isDefault
                            ? null
                            : {
                                  kind: preset.kind,
                                  baseUrl: preset.baseUrl,
                                  apiKeyRef: preset.apiKeyRef,
                              },
                    ),
                );
                Toast.showSuccess(`Data provider updated to ${preset.label}`);
            } catch (error) {
                Toast.showError('Failed to update data provider');
            }
        },
        [dispatch],
    );

    const handleSave = useCallback(async () => {
        if (saveInFlightRef.current) return;

        saveInFlightRef.current = true;
        setIsLoading(true);
        try {
            for (const info of API_KEY_INFO) {
                const next = (apiKeys[info.apiKeyRef] ?? '').trim();
                const current = (preferences.apiKeys?.[info.apiKeyRef] ?? '').trim();

                if (next !== current) {
                    await dispatch(setApiKey(info.apiKeyRef, next));
                }
            }

            Toast.showSuccess('Settings saved successfully');
            history.replace(DEFAULT_ROUTE);
        } catch (error) {
            Toast.showError('Failed to save settings');
        } finally {
            saveInFlightRef.current = false;
            setIsLoading(false);
        }
    }, [dispatch, apiKeys, preferences.apiKeys, history]);

    return (
        <div className="flex flex-col h-full min-h-[400px] relative">
            <Header title="Developer Settings" />

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* API Keys Section */}
                    <div className={SECTION_CLASS}>
                        <h2 className={HEADING_CLASS}>Data Provider API Keys</h2>
                        <p className={HINT_CLASS}>
                            Keys are stored locally in this wallet and are never sent anywhere
                            except the provider they belong to. Leave a field empty to fall back to
                            the built-in default.
                        </p>

                        <div className="space-y-4">
                            {API_KEY_INFO.map(info => (
                                <div key={info.apiKeyRef}>
                                    <TextInput
                                        label={`${info.label} API Key`}
                                        type="password"
                                        autoComplete="off"
                                        spellCheck={false}
                                        placeholder={`Enter your free ${info.label} key`}
                                        value={apiKeys[info.apiKeyRef] ?? ''}
                                        onChange={e =>
                                            handleApiKeyChange(info.apiKeyRef, e.target.value)
                                        }
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {info.description}{' '}
                                        <a
                                            href={info.signupUrl}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="text-primary hover:underline">
                                            Get a free key
                                        </a>
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Per-chain Data Provider Section */}
                    <div className={SECTION_CLASS}>
                        <h2 className={HEADING_CLASS}>Data Provider per Network</h2>
                        <p className={HINT_CLASS}>
                            Chooses where holdings, transaction history and NFTs come from. Changes
                            apply immediately — refresh the wallet to reload data.
                        </p>

                        <div className="space-y-4">
                            {CURRENT_CHAINS.map(chain => {
                                const presets = getDataProviderPresets(chain.chain_id);

                                if (!presets.length) {
                                    return null;
                                }

                                return (
                                    <div key={chain.chain_id}>
                                        <label className="text-xs text-gray-600 dark:text-gray-400">
                                            {chain.name}
                                        </label>
                                        <Dropdown
                                            usePortal={false}
                                            value={selectedPresetIds[chain.chain_id]}
                                            options={presets.map(preset => ({
                                                value: preset.id,
                                                label: preset.label,
                                                subLabel: preset.note,
                                                badge: preset.isDefault ? 'Default' : undefined,
                                            }))}
                                            onChange={value => {
                                                const preset = presets.find(
                                                    entry => entry.id === value,
                                                );
                                                if (preset) {
                                                    handleProviderChange(chain.chain_id, preset);
                                                }
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Build Information Section */}
                    <div className={SECTION_CLASS}>
                        <h2 className={HEADING_CLASS}>Build Information</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    Build Type:
                                </span>
                                <span className="font-mono text-gray-900 dark:text-white">
                                    {process.env.BUILD_TYPE || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    Environment:
                                </span>
                                <span className="font-mono text-gray-900 dark:text-white">
                                    {process.env.NODE_ENV || 'Unknown'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="btn btn-primary">
                            {isLoading ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
