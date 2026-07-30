import React, { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { DEFAULT_ROUTE } from '../../shared/constants/routes';
import { Images } from '../../shared/utils/Images';
import Header from '../components/Header';

export type WalletSuccessVariant = 'created' | 'recovered' | 'hardware';

type Props = {
    variant: WalletSuccessVariant;
};

const VARIANT_CONFIG: Record<
    WalletSuccessVariant,
    { headerTitle: string; heading: string; description: string }
> = {
    created: {
        headerTitle: 'Create Wallet',
        heading: 'Wallet Created',
        description: 'Now you can use your wallet for transactions in Chilly App.',
    },
    recovered: {
        headerTitle: 'Recover Wallet',
        heading: 'Wallet Recovered',
        description: 'Now you can use your wallet for transactions in Chilly App.',
    },
    hardware: {
        headerTitle: 'Hardware wallet',
        heading: 'Hardware wallet connected',
        description:
            'Your accounts are ready. When you sign, connect your hardware wallet via USB and approve the request on your device.',
    },
};

export default React.memo<Props>((props: Props) => {
    const { variant } = props;
    const history = useHistory();
    const { headerTitle, heading, description } = VARIANT_CONFIG[variant];

    const finish = useCallback(() => {
        history.replace(DEFAULT_ROUTE);
    }, [history]);

    return (
        <div className="h-full min-h-0 flex flex-col">
            <Header title={headerTitle} hasBackButton={false} />
            <div
                className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-3rem-40px)]"
                style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex flex-col flex-1 items-center p-10">
                    <img src={Images.iconSuccess} className="w-24 h-24 my-5" alt="Success" />

                    <div className="text-center font-semibold text-lg mb-3">{heading}</div>

                    <div className="text-center text-sm text-slate-500 dark:text-slate-100 flex-1 mb-10 leading-relaxed px-1">
                        {description}
                    </div>

                    <button className="btn btn-primary w-full" onClick={finish}>
                        Start Using Wallet
                    </button>
                </div>
            </div>
        </div>
    );
});
