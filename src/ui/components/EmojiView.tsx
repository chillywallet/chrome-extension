import React, { useEffect, useState } from 'react';
import { FaPencilAlt } from 'react-icons/fa';
import { getRandomAvatar, getRandomColor } from '../../shared/utils/avatar';

type ItemProps = {
    emoji?: string | null;
    walletAddress?: string;
    onPress?: (type: string) => void;
    width: number;
    emojiSize: number;
    defaultBackground?: string;
    showEditIcon?: boolean;
};

const DEFAULT_BG = '#4AA8DC40';

export default React.memo<ItemProps>((props: ItemProps) => {
    const { emoji, onPress, width, emojiSize, walletAddress, showEditIcon } = props;

    const [background, setBackground] = useState(DEFAULT_BG);
    const [localEmoji, setLocalEmoji] = useState(emoji ?? '');

    useEffect(() => {
        let temp = '';

        if (emoji) {
            temp = emoji;
        } else if (walletAddress) {
            temp = getRandomAvatar(walletAddress);
        }

        setLocalEmoji(temp);
        setBackground(temp ? getRandomColor(temp + temp + temp) + '33' : DEFAULT_BG);
    }, [emoji, walletAddress]);

    return (
        <div className="relative">
            <div
                onClick={() => onPress && onPress(localEmoji)}
                className={
                    'flex shrink-0 overflow-hidden rounded-full justify-center items-center relative ' +
                    (onPress ? 'cursor-pointer' : '')
                }
                style={{ backgroundColor: background, width, height: width }}>
                <p style={{ fontSize: emojiSize }}>{localEmoji}</p>
            </div>

            {showEditIcon && (
                <div
                    onClick={() => onPress && onPress(localEmoji)}
                    className="absolute -bottom-1 -right-1 w-6 h-6 cursor-pointer bg-primary rounded-full flex items-center justify-center shadow-md">
                    <FaPencilAlt className="text-white text-[9px]" />
                </div>
            )}
        </div>
    );
});
