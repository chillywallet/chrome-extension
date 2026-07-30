import React, { useEffect, useState } from 'react';
import { RiMoonFill, RiSunFill } from "react-icons/ri";
import { setPreferColorScheme } from '../../store/actions/uiActions';
import { useActualTheme, usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ThemeModal from './ThemeModal';

type Props = {
    className?: string;
};

export default React.memo<Props>((props: Props) => {
    const { className } = props;
    const { darkMode, darkModeSystem } = usePreferences();
    const theme = useActualTheme();
    const dispatch = useAppDispatch();

    const [showModal, setShowModal] = useState<boolean>(false);

    useEffect(() => {
        const darkThemeListener = (e: MediaQueryListEvent) => {
            if (e.matches) {
                dispatch(setPreferColorScheme("dark"));
            }
        };
        const lightThemeListener = (e: MediaQueryListEvent) => {
            if (e.matches) {
                dispatch(setPreferColorScheme("light"));
            }
        };
        const mdark = window.matchMedia("(prefers-color-scheme: dark)");
        const mlight = window.matchMedia("(prefers-color-scheme: light)");
        mdark.addEventListener("change", darkThemeListener);
        mlight.addEventListener("change", lightThemeListener);
        return () => {
            // cleanup event listeners
            mdark.removeEventListener("change", darkThemeListener);
            mlight.removeEventListener("change", lightThemeListener);
        };
    }, [dispatch, darkMode, darkModeSystem]);

    useEffect(() => {
        if (theme === "dark") {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    return (
        <>
            <div className={className + " hidden sm:block"}>
                <label
                    className="cursor-pointer w-10 h-10 rounded-full bg-black text-2xl"
                    onClick={() => {
                        setShowModal(true);
                    }}>
                    <RiMoonFill className='text-white hidden dark:block' />
                    <RiSunFill className='text-yellow-500 dark:hidden' />
                </label>
            </div>

            <ThemeModal show={showModal} onClose={() => setShowModal(false)} />
        </>
    );
});