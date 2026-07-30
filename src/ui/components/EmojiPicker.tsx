import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import React, { useState } from 'react';
import { useActualTheme } from '../../store/selectors';
import EmojiView from './EmojiView';

type ItemProps = {
    emoji: string | null;
    onSelect: (type: any) => void;
    width: number;
    emojiSize: number;
    defaultBackground?: string;
};

export default React.memo<ItemProps>((props: ItemProps) => {
    const { emoji, onSelect, width, emojiSize } = props;

    const theme = useActualTheme();
    const [showPicker, setShowPicker] = useState<boolean>(false);

    return (
        <>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        em-emoji-picker {
                            height: 370px !important;
                            max-height: 370px !important;
                        }
                    `,
                }}
            />
            <EmojiView
                emoji={emoji}
                width={width}
                showEditIcon={true}
                emojiSize={emojiSize}
                onPress={() => {
                    setShowPicker(true);
                }}
            />
            {showPicker && (
                <div className="absolute z-50 mt-2">
                    <Picker
                        data={data}
                        theme={theme}
                        onEmojiSelect={(e: any) => {
                            setShowPicker(false);
                            onSelect(e.native);
                        }}
                    />
                </div>
            )}
        </>
    );
});
