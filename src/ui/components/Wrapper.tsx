import React, { useEffect, useMemo, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { BsFillPinFill } from 'react-icons/bs';
import { IoExtensionPuzzle } from 'react-icons/io5';
import { useLocation } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import { ONBOARDING_CREATE_WALLET_DONE_ROUTE } from '../../shared/constants/routes';
import { Images } from '../../shared/utils/Images';
import ContextMenuHandler from './ContextMenuHandler';
import ThemeSwitcher from './ThemeSwitcher';

type Props = {
    children: React.ReactNode;
};

export default React.memo<Props>((props: Props) => {
    const { children } = props;
    const location = useLocation();

    const pageType = useMemo(() => {
        if (
            location.pathname.startsWith('/onboarding') ||
            location.pathname.startsWith('/add-wallet')
        ) {
            return 'onboarding';
        } else if (location.pathname.startsWith('/forgot-code')) {
            return 'desktop';
        } else {
            return 'authenticated';
        }
    }, [location]);

    const isOnboardingDone = useMemo(() => {
        return location.pathname.startsWith(ONBOARDING_CREATE_WALLET_DONE_ROUTE);
    }, [location]);

    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

    useEffect(() => {
        // Handler to call when window size changes
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Cleanup function to remove the event listener
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showTextLogo = useMemo(() => {
        if (pageType === 'onboarding') {
            if (windowSize.width < 820) {
                return false;
            } else {
                return true;
            }
        } else {
            if (windowSize.width < 820) {
                return false;
            } else if (windowSize.width < 1024) {
                return true;
            } else if (windowSize.width < 1170) {
                return false;
            } else {
                return true;
            }
        }
    }, [windowSize, pageType]);

    if (pageType === 'onboarding') {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-darker via-header to-[#2E5E86] relative">
                <img
                    src={
                        showTextLogo ? Images.logoWalletWhite : Images.logoWalletWhiteNoText
                    }
                    className="absolute top-5 left-5 hidden sm:block h-8"
                    alt="Logo"
                />
                {isOnboardingDone ? (
                    <div className="absolute top-2 right-2 flex flex-row items-center gap-5">
                        <ThemeSwitcher className="" />
                        <div className="bg-primary text-white p-3 rounded-md">
                            <div className="text-sm font-semibold">Pin the Chilly Extension</div>
                            <div className="text-sm flex flex-row items-center gap-1">
                                Click <IoExtensionPuzzle /> and <BsFillPinFill /> to pin the
                                extension
                            </div>
                        </div>
                    </div>
                ) : (
                    <ThemeSwitcher className="absolute top-5 right-5" />
                )}
                <div className="w-[450px] max-h-[calc(100vh-40px)] bg-white text-black dark:bg-dark dark:text-white rounded-2xl overflow-hidden relative">
                    <Toaster
                        containerStyle={{
                            position: 'relative',
                            left: 0,
                        }}
                    />
                    {children}
                    <Tooltip
                        id="chilly-tooltip"
                        positionStrategy="fixed"
                        style={{
                            fontSize: '12px',
                            zIndex: 9999,
                            maxWidth: 300,
                        }}
                    />
                </div>

                <ContextMenuHandler />
            </div>
        );
    } else if (pageType === 'authenticated') {
        return (
            <div className="w-full sm:h-full flex items-center justify-center text-black dark:text-white bg-gradient-to-tr from-darker via-header to-[#2E5E86] relative">
                <img
                    src={
                        showTextLogo ? Images.logoWalletWhite : Images.logoWalletWhiteNoText
                    }
                    className="absolute top-5 left-5 hidden sm:block h-8"
                    alt="Logo"
                />
                <ThemeSwitcher className="absolute top-5 right-5" />
                <div className="w-full sm:w-[450px] lg:w-[800px] h-[100vh] sm:h-[calc(100vh-40px)] border-0 sm:border dark:sm:border-darkline sm:rounded-2xl overflow-hidden relative bg-white dark:bg-darker">
                    <Toaster
                        containerStyle={{
                            position: 'relative',
                            left: 0,
                        }}
                    />
                    {children}
                    <Tooltip
                        id="chilly-tooltip"
                        positionStrategy="fixed"
                        style={{
                            fontSize: '12px',
                            zIndex: 9999,
                            maxWidth: 300,
                        }}
                    />
                </div>

                <ContextMenuHandler />
            </div>
        );
    } else {
        return (
            <div className="bg-white text-black dark:bg-dark p-3 h-full">
                <div className="border-b border-gray-200 dark:border-gray-800 py-5">
                    <div className="box-container relative mx-auto">
                        <img
                            src={Images.logoWalletColor}
                            className="h-8 mr-2 dark:hidden"
                            alt="Logo"
                        />
                        <img
                            src={Images.logoWalletWhite}
                            className="h-8 mr-2 hidden dark:block"
                            alt="Logo"
                        />

                        <ThemeSwitcher className="absolute top-0 right-0" />
                    </div>
                </div>
                <div className="box-container mx-auto dark:text-white py-5">
                    <Toaster
                        containerStyle={{
                            position: 'relative',
                            left: 0,
                        }}
                    />
                    {children}
                    <Tooltip
                        id="chilly-tooltip"
                        positionStrategy="fixed"
                        style={{
                            fontSize: '12px',
                            zIndex: 9999,
                            maxWidth: 300,
                        }}
                    />
                </div>

                <ContextMenuHandler />
            </div>
        );
    }
});
