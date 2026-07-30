import React, { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import TextInput from '../components/TextInput';

type Props = {
    password: string;
    onCreatePinCode: (passKey: string) => void;
};

export default React.memo<Props>((props: Props) => {
    const { onCreatePinCode } = props;

    const location = useLocation();

    const [password, setPassword] = useState(process.env.BUILD_TYPE === 'Debug' ? '11111111' : '');
    const [confirmPassword, setConfirmPassword] = useState(
        process.env.BUILD_TYPE === 'Debug' ? '11111111' : '',
    );
    const [error, setError] = useState('');

    const onContinuePress = useCallback(() => {
        if (password !== confirmPassword) {
            setError('Your entries did not match');
            return;
        }

        if (password.length < 8) {
            setError('Code must be at least 8 characters');
            return;
        }

        onCreatePinCode(password);
    }, [password, confirmPassword, onCreatePinCode]);

    const isDesktop = useMemo(() => {
        return location.pathname.startsWith('/forgot-code');
    }, [location.pathname]);

    return (
        <div
            className={
                (isDesktop ? 'w-full sm:w-[450px] mx-auto ' : '') +
                'h-full min-h-0 flex flex-col'
            }>
            <Header title="Create Pin Code" hasBackButton={isDesktop} />

            <div
                className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-3rem-40px)]"
                style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex flex-col flex-1 p-10 pt-5 ">
                <div className="text-center text-lg font-semibold mb-3">
                    Create Your Secure Pin Code
                </div>
                <div className="text-center text-sm mb-10">
                    For your security, please set up a unique PIN. This PIN will help protect your
                    digital assets and keep your account safe.
                </div>

                <div className="flex-1">
                    <TextInput
                        label="Pin Code"
                        className="mb-3"
                        type="password"
                        placeholder="Your Pin Code"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyUp={e => {
                            //detect enter key
                            if (e.key === 'Enter') {
                                //focus to next input
                                const nextInput =
                                    e.currentTarget.parentElement?.nextElementSibling?.querySelector(
                                        'input',
                                    ) as HTMLInputElement;
                                if (nextInput) {
                                    nextInput.focus();
                                }
                            }
                        }}
                    />

                    <TextInput
                        label="Confirm Pin Code"
                        className="mb-3"
                        type="password"
                        placeholder="Confirm Pin Code"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onKeyUp={e => {
                            //detect enter key
                            if (e.key === 'Enter') {
                                onContinuePress();
                            }
                        }}
                    />

                    {error && <div className="text-xs text-red-500 text-center mb-3">{error}</div>}
                </div>

                <div className="pt-5">
                    <button className={'btn btn-primary w-full'} onClick={onContinuePress}>
                        Continue
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
});
