import React, { useCallback, useEffect, useState } from 'react';
import { Switch, matchPath, useHistory, useLocation } from 'react-router-dom';
import {
    SEND_ASSET_AMOUNT_ROUTE,
    SEND_ASSET_CONFIRMATION_ROUTE,
    SEND_ASSET_RECEIVER_ROUTE,
    SEND_ASSET_SELECT_ASSET_ROUTE,
} from '../../../shared/constants/routes';
import { Coin, NFT, Receiver, SendAssetData } from '../../../shared/types/Wallet';
import { Route } from 'react-router-dom';
import Authenticated from '../Authenticated';
import { useRoutesData } from '../RoutesProvider';
import EnterSendData from './EnterSendData';
import SendAmount from './SendAmount';
import SendAssetFlowSwitch from './SendAssetFlowSwitch';
import SendConfirmation from './SendConfirmation';
import SendSelectAsset from './SendSelectAsset';

type Props = {};

export default React.memo((props: Props) => {
    const { sendAssetInitData: initData, setHomeTabIndex, setSubTabIndex } = useRoutesData();
    const { isAAWallet } = initData ?? { isAAWallet: false };
    const history = useHistory();
    const location = useLocation();

    const [coinData, setCoinData] = useState<{
        value: bigint;
        usdValue?: number;
        balance: bigint;
        decimals: number;
    }>({
        value: 0n,
        balance: 0n,
        decimals: 18,
    });
    const [assetData, setAssetData] = useState<SendAssetData | undefined>(initData);
    const [receiver, setReceiver] = useState<Receiver | null>(null);
    const [tabIndex, setTabIndex] = useState(0);
    const [showSpamNft, setShowSpamNft] = useState(false);

    const onCoinPress = useCallback(
        (coin: Coin) => {
            setAssetData({ coinToSend: coin, isAAWallet });
            history.push(SEND_ASSET_RECEIVER_ROUTE);
        },
        [history, isAAWallet],
    );

    const onNFTPress = useCallback(
        (nft: NFT) => {
            setAssetData({ nftToSend: nft, isAAWallet });
            history.push(SEND_ASSET_RECEIVER_ROUTE);
        },
        [history, isAAWallet],
    );

    const onSelectReceiver = useCallback(
        (data: Receiver) => {
            if (assetData) {
                setReceiver(data);

                if (assetData.coinToSend) {
                    history.push(SEND_ASSET_AMOUNT_ROUTE);
                } else {
                    history.push(SEND_ASSET_CONFIRMATION_ROUTE);
                }
            }
        },
        [history, assetData],
    );

    const goToConfirmation = useCallback(
        (data: { value: bigint; usdValue?: number; balance: bigint; decimals: number }) => {
            setCoinData(data);
            history.push(SEND_ASSET_CONFIRMATION_ROUTE);
        },
        [history],
    );

    const onTxSuccess = useCallback(() => {
        setSubTabIndex(2);
        setHomeTabIndex(isAAWallet ? 2 : 1);
    }, [isAAWallet, setHomeTabIndex, setSubTabIndex]);

    useEffect(() => {
        if (
            !assetData?.coinToSend &&
            !assetData?.nftToSend &&
            !matchPath(location.pathname, {
                path: SEND_ASSET_SELECT_ASSET_ROUTE,
                exact: true,
            })
        ) {
            history.push(SEND_ASSET_SELECT_ASSET_ROUTE);
        }
    }, [assetData, history, location.pathname]);

    useEffect(() => {
        if (initData?.coinToSend) {
            onCoinPress(initData.coinToSend);
        } else if (initData?.nftToSend) {
            onNFTPress(initData.nftToSend);
        }
    }, [initData?.coinToSend, initData?.nftToSend, onCoinPress, onNFTPress]);

    return (
        <Switch>
            <Authenticated
                path={SEND_ASSET_SELECT_ASSET_ROUTE}
                component={(props: any) => (
                    <SendSelectAsset
                        {...props}
                        onCoinPress={onCoinPress}
                        onNFTPress={onNFTPress}
                        tabIndex={tabIndex}
                        setTabIndex={setTabIndex}
                        showSpamNft={showSpamNft}
                        setShowSpamNft={setShowSpamNft}
                        isAAWallet={isAAWallet}
                    />
                )}
            />
            <Authenticated
                path={SEND_ASSET_RECEIVER_ROUTE}
                component={(props: any) => (
                    <EnterSendData
                        {...props}
                        goToNextStep={onSelectReceiver}
                        isAAWallet={isAAWallet}
                    />
                )}
            />
            {assetData?.coinToSend ? (
                <Authenticated
                    path={SEND_ASSET_AMOUNT_ROUTE}
                    component={(props: any) => (
                        <SendAmount
                            {...props}
                            coin={assetData.coinToSend}
                            isAAWallet={isAAWallet}
                            receiver={receiver}
                            goToNextStep={goToConfirmation}
                        />
                    )}
                />
            ) : null}
            {assetData ? (
                <Authenticated
                    path={SEND_ASSET_CONFIRMATION_ROUTE}
                    component={(props: any) => (
                        <SendConfirmation
                            {...props}
                            assetData={assetData}
                            receiver={receiver}
                            onTxSuccess={onTxSuccess}
                            {...coinData}
                        />
                    )}
                />
            ) : null}

            <Route exact path="*" component={SendAssetFlowSwitch} />
        </Switch>
    );
});
