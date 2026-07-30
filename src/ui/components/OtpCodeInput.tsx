// src/components/OtpInput.jsx
import { ChangeEvent, ClipboardEvent, KeyboardEvent, useState } from 'react';

const OtpInput = ({
    length = 6,
    onChange,
    onEnterPress,
}: {
    length?: number;
    onChange: (otp: string) => void;
    onEnterPress?: () => void;
}) => {
    const [otp, setOtp] = useState(Array(length).fill(''));

    const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
        const { value } = e.target;
        if (/^[0-9]$/.test(value) || value === '') {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);
            onChange(newOtp.join(''));

            // Focus next input
            if (value !== '' && index < length - 1) {
                const nextSibling = document.getElementById(`otp-input-${index + 1}`);
                if (nextSibling) {
                    nextSibling.focus();
                }
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace' && otp[index] === '') {
            if (index > 0) {
                const prevSibling = document.getElementById(`otp-input-${index - 1}`);
                if (prevSibling) {
                    prevSibling.focus();
                }
            }
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        const pasteData = e.clipboardData.getData('text');
        if (/^[0-9]*$/.test(pasteData)) {
            const newOtp = Array(length).fill('');
            for (let i = 0; i < length && i < pasteData.length; i++) {
                newOtp[i] = pasteData[i];
            }
            setOtp(newOtp);
            onChange(newOtp.join(''));

            // Focus the next empty input
            const firstEmptyIndex = newOtp.findIndex(value => value === '');
            if (firstEmptyIndex !== -1) {
                const nextSibling = document.getElementById(`otp-input-${firstEmptyIndex}`);
                if (nextSibling) {
                    nextSibling.focus();
                }
            }
        }

        e.preventDefault();
    };

    return (
        <div className="grid grid-cols-12 gap-3">
            {otp.map((data, index) => (
                <input
                    key={index}
                    id={`otp-input-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={data}
                    onChange={e => handleChange(e, index)}
                    onKeyDown={e => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    className="col-span-2 h-12 text-center text-lg border border-gray-300 dark:bg-dark rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    onKeyUp={e => {
                        if (e.key === 'Enter') {
                            onEnterPress && onEnterPress();
                        }
                    }}
                />
            ))}
        </div>
    );
};

export default OtpInput;
