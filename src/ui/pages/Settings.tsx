import React, { useState } from 'react';
import { BsFillFuelPumpFill } from 'react-icons/bs';
import { FaChevronRight, FaCode } from 'react-icons/fa';
import { LuImage } from 'react-icons/lu';
import { TbSunMoon } from 'react-icons/tb';
import { useHistory } from 'react-router-dom';
import {
    DEVELOP_ROUTE,
    GAS_OPTIONS_ROUTE,
    ICON_SELECTOR_ROUTE,
} from '../../shared/constants/routes';
import { usePreferences } from '../../store/selectors';
import BottomNav from '../components/BottomNav';
import ThemeModal from '../components/ThemeModal';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const history = useHistory();
    const preferences = usePreferences();
    const { enableChangeIcon } = preferences;
    const [isShowThemeSetting, setIsShowThemeSetting] = useState(false);

    return (
        <div className="flex flex-col h-full min-h-0 relative">
            <h1 className="font-display text-[26px] leading-tight font-medium px-5 pt-5 pb-4 shrink-0">
                Settings
            </h1>

            <div className="flex flex-col flex-1 min-h-0 overflow-auto divide-y divide-slate-100 dark:divide-darkline/40">
                {/* Theme Setting */}
                <button
                    onClick={() => setIsShowThemeSetting(true)}
                    className="flex flex-row items-center w-full text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors px-5 py-3 text-left">
                    <div className="flex items-center justify-center w-8 h-8 mr-3">
                        <TbSunMoon className="text-lg text-primary" />
                    </div>
                    <div className="flex-1">Theme Setting</div>
                    <FaChevronRight className="text-gray-400 dark:text-gray-500" />
                </button>

                {/* App Icon */}
                {enableChangeIcon && (
                    <button
                        onClick={() => history.push(ICON_SELECTOR_ROUTE)}
                        className="flex flex-row items-center w-full text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors px-5 py-3 text-left">
                        <div className="flex items-center justify-center w-8 h-8 mr-3">
                            <LuImage className="text-lg text-primary" />
                        </div>
                        <div className="flex-1">App Icon</div>
                        <FaChevronRight className="text-gray-400 dark:text-gray-500" />
                    </button>
                )}

                {/* Gas Options */}
                <button
                    onClick={() => history.push(GAS_OPTIONS_ROUTE)}
                    className="flex flex-row items-center w-full text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors px-5 py-3 text-left">
                    <div className="flex items-center justify-center w-8 h-8 mr-3">
                        <BsFillFuelPumpFill className="text-lg text-primary" />
                    </div>
                    <div className="flex-1">Network Fee Options</div>
                    <FaChevronRight className="text-gray-400 dark:text-gray-500" />
                </button>

                {/* Developer Settings */}
                {process.env.BUILD_TYPE !== 'Prod' && (
                    <button
                        onClick={() => history.push(DEVELOP_ROUTE)}
                        className="flex flex-row items-center w-full text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors px-5 py-3 text-left">
                        <div className="flex items-center justify-center w-8 h-8 mr-3">
                            <FaCode className="text-lg text-primary" />
                        </div>
                        <div className="flex-1">Developer Settings</div>
                        <FaChevronRight className="text-gray-400 dark:text-gray-500" />
                    </button>
                )}
            </div>

            <BottomNav />

            <ThemeModal show={isShowThemeSetting} onClose={() => setIsShowThemeSetting(false)} />
        </div>
    );
});
