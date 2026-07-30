import React, { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Images } from '../../shared/utils/Images';
import { unlockApp } from '../../store/actions/uiActions';
import TextInput from '../components/TextInput';

type Props = {
    onUnlockSuccess: (password: string) => void;
    onForgotPinCode: () => void;
};

export default React.memo<Props>((props: Props) => {
    const { onUnlockSuccess, onForgotPinCode } = props;
    const dispatch = useDispatch();

    const [pinCode, setPinCode] = useState(process.env.BUILD_TYPE === 'Debug' ? '11111111' : '');
    const [error, setError] = useState('');

    const onUnlockPress = useCallback(() => {
        if (pinCode) {
            dispatch(
                unlockApp(pinCode, (err, errMessage) => {
                    if (err) {
                        if (errMessage === 'Incorrect password') {
                            setError('Incorrect Pin Code');
                        } else {
                            setError(errMessage ?? 'Unknown Error');
                        }
                    } else {
                        setError('');
                        onUnlockSuccess(pinCode);
                    }
                }),
            );
        } else {
            setError('Pin Code is required.');
        }
    }, [dispatch, onUnlockSuccess, pinCode]);

    return (
        <div className="flex flex-col justify-center items-center h-full p-10">
            <img className="w-20 h-20 mb-6 rounded-[18px]" src={Images.logo128} alt="" loading="lazy" />
            <p className="font-display text-2xl font-medium mb-8">Welcome back</p>
            <div className="flex flex-col w-full">
                <TextInput
                    label="Enter your Pin Code to unlock"
                    className="mb-3"
                    autoFocus
                    type="password"
                    placeholder="Your Pin Code"
                    value={pinCode}
                    onChange={e => setPinCode(e.target.value)}
                    onKeyUp={e => {
                        //detect enter key
                        if (e.key === 'Enter') {
                            onUnlockPress();
                        }
                    }}
                />
                {error ? <p className="text-sm text-red-500 mt-1">{error}</p> : null}
                <button
                    onClick={e => {
                        onUnlockPress();
                        e.preventDefault();
                    }}
                    className="btn btn-primary w-full mt-10">
                    Unlock
                </button>

                <button
                    className="text-sm font-medium hover:text-primary text-right self-center mt-8"
                    onClick={onForgotPinCode}>
                    Forgot Pin Code?
                </button>
            </div>
        </div>
    );
});
