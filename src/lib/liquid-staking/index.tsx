import { EarnType } from '../../shared/types/Earn';
import aPriori from './aPriori';
import FastLane from './FastLane';
import Kintsu from './Kintsu';

export const LiquidStakingProviders = {
    [EarnType.aPriori]: aPriori,
    [EarnType.Kintsu]: Kintsu,
    [EarnType.FastLane]: FastLane,
    [EarnType.AgoraYield]: undefined,
    [EarnType.FastLaneYield]: undefined,
    [EarnType.GauntletYield]: undefined,
    [EarnType.GauntletAlphaYield]: undefined,
};
