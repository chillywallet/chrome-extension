import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NetworkCard from '../../../src/ui/components/NetworkCard';

const network: any = {
    icon: 'eth.png',
    short_name: 'ETH',
};

describe('NetworkCard', () => {
    it('renders the network name', () => {
        render(
            <NetworkCard
                network={network}
                selected={false}
                onPress={jest.fn()}
                onCustomizePress={jest.fn()}
            />,
        );
        expect(screen.getByText('ETH')).toBeInTheDocument();
    });

    it('emits onPress when the main button is clicked', () => {
        const onPress = jest.fn();
        render(
            <NetworkCard
                network={network}
                selected={false}
                onPress={onPress}
                onCustomizePress={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByText('ETH').closest('button')!);
        expect(onPress).toHaveBeenCalledWith(network);
    });

    it('emits onCustomizePress when the customize button is clicked', () => {
        const onCustomizePress = jest.fn();
        const { container } = render(
            <NetworkCard
                network={network}
                selected={false}
                onPress={jest.fn()}
                onCustomizePress={onCustomizePress}
            />,
        );
        const buttons = container.querySelectorAll('button');
        // Second button is the customize button
        fireEvent.click(buttons[1]);
        expect(onCustomizePress).toHaveBeenCalled();
    });

    it('renders Coming Soon badge when comingSoon is true', () => {
        render(
            <NetworkCard
                network={network}
                selected={false}
                onPress={jest.fn()}
                onCustomizePress={jest.fn()}
                comingSoon={true}
            />,
        );
        expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('applies selected styling', () => {
        render(
            <NetworkCard
                network={network}
                selected={true}
                onPress={jest.fn()}
                onCustomizePress={jest.fn()}
            />,
        );
        expect(screen.getByText('ETH')).toHaveClass('text-primary');
    });
});
