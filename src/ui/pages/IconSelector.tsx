import React from 'react';
import { FaCheck } from 'react-icons/fa';
import { LAUNCHER_ICONS } from '../../shared/utils/Images';
import { setAppIcon } from '../../store/actions/uiActions';
import { usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import Header from '../components/Header';
import Toast from '../components/Toast';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const dispatch = useAppDispatch();

    const { appIcon } = usePreferences();

    return (
        <div className="flex flex-col h-full min-h-[400px] relative">
            <Header title="Choose App Icon" />

            <div className="flex flex-col flex-1 h-[calc(100vh-40px-10rem)] overflow-auto divide-y divide-slate-100 dark:divide-darkline/40">
                {LAUNCHER_ICONS.map((icon, index) => {
                    const selected = appIcon === icon.key;
                    return (
                        <button
                            onClick={async e => {
                                e.preventDefault();
                                if (!selected) {
                                    await dispatch(setAppIcon(icon.key));

                                    Toast.showSuccess('App icon changed successfully');
                                }
                            }}
                            key={index}
                            aria-pressed={selected}
                            className={
                                'flex flex-row items-center w-full text-sm px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors' +
                                (selected ? ' bg-primary/10 dark:bg-accent/10' : '')
                            }>
                            <img
                                src={icon.path}
                                className="w-10 h-10 rounded-[10px]"
                                alt={icon.name}
                            />
                            <div className="ml-3 flex-1 text-left">{icon.name}</div>
                            {selected && (
                                <FaCheck className="text-primary dark:text-accent" size={14} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});
