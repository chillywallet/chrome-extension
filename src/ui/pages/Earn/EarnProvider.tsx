import { createContext, useContext, useState } from 'react';
import { EarnItem, EarnListItem } from '../../../shared/types/Earn';

type EarnContextType = {
    liquidStakingData?: EarnItem;
    setLiquidStakingData: (value: EarnItem) => void;
    liquidStakingClaimData?: {
        data: EarnItem;
        waitTime: number;
    };
    setLiquidStakingClaimData: (value: { data: EarnItem; waitTime: number }) => void;
    yieldData?: EarnListItem;
    setYieldData: (value: EarnListItem) => void;
};

export const EarnContext = createContext<EarnContextType>({
    setLiquidStakingData: () => { },
    setLiquidStakingClaimData: () => { },
    setYieldData: () => { },
});

export const useEarnData = () => {
    return useContext(EarnContext);
};

type Props = {
    children: React.ReactNode;
};

export default function EarnProvider(props: Props) {
    const [liquidStakingData, setLiquidStakingData] = useState<EarnItem | undefined>();
    const [liquidStakingClaimData, setLiquidStakingClaimData] = useState<
        | {
            data: EarnItem;
            waitTime: number;
        }
        | undefined
    >();
    const [yieldData, setYieldData] = useState<EarnListItem | undefined>();

    return (
        <EarnContext.Provider
            value={{
                liquidStakingData,
                liquidStakingClaimData,
                yieldData,
                setLiquidStakingClaimData,
                setLiquidStakingData,
                setYieldData,
            }}>
            {props.children}
        </EarnContext.Provider>
    );
}
