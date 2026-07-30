import React, { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { ONBOARDING_CREATE_PIN_CODE_ROUTE } from '../../shared/constants/routes';
import { Images } from '../../shared/utils/Images';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const {} = props;
    const history = useHistory();

    const getStarted = useCallback(() => {
        history.push(ONBOARDING_CREATE_PIN_CODE_ROUTE);
    }, [history]);

    return (
        <div className="h-full min-h-0 flex flex-col dark:bg-dark dark:text-white">
            <div
                className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-40px)]"
                style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex flex-col h-full p-10">
                    <div className="block mb-8">
                        <img
                            src={Images.logoColorText}
                            className="h-8 mr-2 dark:hidden"
                            alt="Logo"
                        />
                        <img
                            src={Images.logoWhiteText}
                            className="h-8 mr-2 hidden dark:block"
                            alt="Logo"
                        />
                    </div>

                    <div className="flex flex-col flex-1 justify-center">
                        <div className="font-display text-4xl font-medium leading-tight">
                            Manage all
                            <br />
                            your crypto in
                            <br />
                            one place
                        </div>
                        <div className="aurora-line w-16 mt-6" aria-hidden="true" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 text-sm">
                        <button className={'btn btn-primary w-full'} onClick={getStarted}>
                            Get started
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
