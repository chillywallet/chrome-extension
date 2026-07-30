import React from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';
import { FaCircleHalfStroke } from 'react-icons/fa6';
import { setDarkMode, setDarkModeSystem } from '../../store/actions/uiActions';
import { usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';

type Props = {
    show: boolean;
    onClose: () => void;
};

type ThemeButtonProps = {
    selected: boolean;
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
};

const ThemeButton = (props: ThemeButtonProps) => {
    const { selected, title, icon, onClick } = props;
    return (
        <div className='flex flex-col items-center gap-2 cursor-pointer' onClick={onClick}>
            <div className={'w-full flex flex-col items-center justify-center border-2 rounded-lg h-24 ' + (selected ? 'text-primary border-primary' : 'text-gray-500 border-gray-500')}>
                {icon}
            </div>
            <div className={'text-center text-sm ' + (selected ? 'text-primary' : 'text-gray-500')}>{title}</div>
        </div>
    );
}

export default React.memo<Props>((props: Props) => {
    const { show, onClose } = props;
    const dispatch = useAppDispatch();
    const { darkMode, darkModeSystem } = usePreferences();

    return (
        <Modal visible={show} onClose={onClose}>
            <Header title="Theme Setting" hasBackButton={false} onClosePress={onClose} />

            <div className="p-5 text-black dark:text-white">
                <div className='grid grid-cols-3 gap-3 mb-3'>
                    <ThemeButton
                        title='Light Mode'
                        selected={!darkMode && !darkModeSystem}
                        icon={<FaSun size={25} />}
                        onClick={async () => {
                            await dispatch(setDarkMode(false));
                            await dispatch(setDarkModeSystem(false));
                        }} />

                    <ThemeButton
                        title='Dark Mode'
                        selected={darkMode && !darkModeSystem}
                        icon={<FaMoon size={25} />}
                        onClick={async () => {
                            await dispatch(setDarkMode(true));
                            await dispatch(setDarkModeSystem(false));
                        }} />

                    <ThemeButton
                        title='Auto'
                        selected={darkModeSystem}
                        icon={<FaCircleHalfStroke size={25} />}
                        onClick={async () => {
                            await dispatch(setDarkModeSystem(true));
                        }} />
                </div>
            </div>
        </Modal>
    );
});
