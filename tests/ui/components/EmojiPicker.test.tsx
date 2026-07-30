import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EmojiPicker from '../../../src/ui/components/EmojiPicker';

jest.mock('@emoji-mart/data', () => ({}), { virtual: true });

jest.mock('@emoji-mart/react', () => ({
    __esModule: true,
    default: ({ onEmojiSelect }: { onEmojiSelect: (e: any) => void }) => (
        <button
            data-testid="picker"
            onClick={() => onEmojiSelect({ native: '🎉' })}>
            picker
        </button>
    ),
}), { virtual: true });

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => 'light',
}));

jest.mock('../../../src/ui/components/EmojiView', () => ({
    __esModule: true,
    default: ({ emoji, onPress }: { emoji: string | null; onPress: () => void }) => (
        <button data-testid="emoji-view" onClick={onPress}>
            {emoji ?? 'none'}
        </button>
    ),
}));

describe('EmojiPicker', () => {
    it('renders the EmojiView with the current emoji', () => {
        render(
            <EmojiPicker emoji="🙂" width={30} emojiSize={20} onSelect={jest.fn()} />,
        );
        expect(screen.getByText('🙂')).toBeInTheDocument();
    });

    it('opens the picker on press and emits onSelect with the native emoji', () => {
        const onSelect = jest.fn();
        render(
            <EmojiPicker emoji={null} width={30} emojiSize={20} onSelect={onSelect} />,
        );
        fireEvent.click(screen.getByTestId('emoji-view'));
        expect(screen.getByTestId('picker')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('picker'));
        expect(onSelect).toHaveBeenCalledWith('🎉');
    });

    it('hides the picker after selection', () => {
        render(
            <EmojiPicker emoji={null} width={30} emojiSize={20} onSelect={jest.fn()} />,
        );
        fireEvent.click(screen.getByTestId('emoji-view'));
        fireEvent.click(screen.getByTestId('picker'));
        expect(screen.queryByTestId('picker')).toBeNull();
    });
});
