import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EmojiView from '../../../src/ui/components/EmojiView';

describe('EmojiView', () => {
    it('shows the provided emoji', () => {
        render(<EmojiView emoji="🐱" width={40} emojiSize={20} />);
        expect(screen.getByText('🐱')).toBeInTheDocument();
    });

    it('derives an emoji from walletAddress when none is provided', () => {
        const { container } = render(
            <EmojiView walletAddress="0xabc" width={40} emojiSize={20} />,
        );
        // Some emoji should be rendered
        expect(container.querySelector('p')?.textContent?.length).toBeGreaterThan(0);
    });

    it('calls onPress when clicked', () => {
        const onPress = jest.fn();
        render(<EmojiView emoji="🐱" width={40} emojiSize={20} onPress={onPress} />);
        fireEvent.click(screen.getByText('🐱'));
        expect(onPress).toHaveBeenCalled();
    });

    it('renders the edit icon when showEditIcon is true', () => {
        const { container } = render(
            <EmojiView
                emoji="🐱"
                width={40}
                emojiSize={20}
                onPress={jest.fn()}
                showEditIcon={true}
            />,
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('calls onPress when edit icon is clicked', () => {
        const onPress = jest.fn();
        const { container } = render(
            <EmojiView
                emoji="🐱"
                width={40}
                emojiSize={20}
                onPress={onPress}
                showEditIcon={true}
            />,
        );
        const editIcon = container.querySelector('.bg-primary') as HTMLElement;
        expect(editIcon).not.toBeNull();
        fireEvent.click(editIcon);
        expect(onPress).toHaveBeenCalledWith('🐱');
    });

    it('does not throw when clicked without onPress', () => {
        render(<EmojiView emoji="🐱" width={40} emojiSize={20} />);
        // Should not throw
        fireEvent.click(screen.getByText('🐱'));
    });

    it('renders with no emoji and no walletAddress (default background)', () => {
        const { container } = render(<EmojiView width={40} emojiSize={20} />);
        expect(container.querySelector('p')?.textContent).toBe('');
    });

    it('renders with null emoji', () => {
        const { container } = render(<EmojiView emoji={null} width={40} emojiSize={20} />);
        expect(container.querySelector('p')?.textContent).toBe('');
    });
});
