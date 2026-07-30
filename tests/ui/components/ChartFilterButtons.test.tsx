import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ChartFilterButtons from '../../../src/ui/components/ChartFilterButtons';

describe('ChartFilterButtons', () => {
    it('renders the default labels for known chart types', () => {
        render(
            <ChartFilterButtons
                chartTypes={['day', 'week', 'month', 'year', 'all'] as any}
                selectedType={'day' as any}
                onTypeChange={jest.fn()}
            />,
        );
        expect(screen.getByText('24H')).toBeInTheDocument();
        expect(screen.getByText('1 W')).toBeInTheDocument();
        expect(screen.getByText('1 M')).toBeInTheDocument();
        expect(screen.getByText('1 Y')).toBeInTheDocument();
        expect(screen.getByText('ALL')).toBeInTheDocument();
    });

    it('falls back to the type id when no label is mapped', () => {
        render(
            <ChartFilterButtons
                chartTypes={['custom'] as any}
                selectedType={'custom' as any}
                onTypeChange={jest.fn()}
            />,
        );
        expect(screen.getByText('custom')).toBeInTheDocument();
    });

    it('emits onTypeChange with the clicked type', () => {
        const onTypeChange = jest.fn();
        render(
            <ChartFilterButtons
                chartTypes={['day', 'week'] as any}
                selectedType={'day' as any}
                onTypeChange={onTypeChange}
            />,
        );
        fireEvent.click(screen.getByText('1 W'));
        expect(onTypeChange).toHaveBeenCalledWith('week');
    });

    it('marks the selected button with the primary style', () => {
        render(
            <ChartFilterButtons
                chartTypes={['day', 'week'] as any}
                selectedType={'day' as any}
                onTypeChange={jest.fn()}
            />,
        );
        expect(screen.getByText('24H').className).toContain('bg-primary');
        expect(screen.getByText('1 W').className).toContain('bg-transparent');
    });

    it('honors a custom labels map', () => {
        render(
            <ChartFilterButtons
                chartTypes={['day'] as any}
                selectedType={'day' as any}
                onTypeChange={jest.fn()}
                labels={{ day: 'Today' }}
            />,
        );
        expect(screen.getByText('Today')).toBeInTheDocument();
    });
});
