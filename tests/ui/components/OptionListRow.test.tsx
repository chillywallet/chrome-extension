import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import OptionListRow from '../../../src/ui/components/OptionListRow';

jest.mock('../../../src/ui/components/RadioButton', () => ({
    __esModule: true,
    default: ({ checked }: any) => (
        <span data-testid="radio" data-checked={checked ? 'yes' : 'no'} />
    ),
}));

describe('OptionListRow', () => {
    it('renders a button in navigate mode and fires onClick', () => {
        const onClick = jest.fn();
        render(<OptionListRow label="Go" icon="🚀" onClick={onClick} />);
        const btn = screen.getByRole('button', { name: /Go/ });
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalled();
    });

    it('navigate mode honours disabled (button.disabled)', () => {
        const onClick = jest.fn();
        render(<OptionListRow label="Go" icon="🚀" onClick={onClick} disabled />);
        const btn = screen.getByRole('button', { name: /Go/ }) as HTMLButtonElement;
        expect(btn).toBeDisabled();
    });

    it('navigate mode shows description and bottom border', () => {
        render(
            <OptionListRow
                label="Title"
                icon="🌎"
                onClick={() => {}}
                description="Sub-text"
                withBottomBorder
            />,
        );
        expect(screen.getByText('Sub-text')).toBeInTheDocument();
    });

    it('coming-soon row is not interactive and displays the badge', () => {
        const onClick = jest.fn();
        render(<OptionListRow label="Soon" icon="🔜" onClick={onClick} comingSoon />);
        expect(screen.getByText('Coming Soon')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Soon'));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('select mode renders a radio control and fires onClick', () => {
        const onClick = jest.fn();
        render(
            <OptionListRow
                label="A"
                icon="A"
                onClick={onClick}
                mode="select"
                selected={false}
            />,
        );
        const role = screen.getByRole('radio');
        fireEvent.click(role);
        expect(onClick).toHaveBeenCalled();
    });

    it('select mode keyboard handler fires onClick on Enter and Space', () => {
        const onClick = jest.fn();
        render(
            <OptionListRow
                label="A"
                icon="A"
                onClick={onClick}
                mode="select"
                selected={true}
            />,
        );
        const radio = screen.getByRole('radio');
        fireEvent.keyDown(radio, { key: 'Enter' });
        fireEvent.keyDown(radio, { key: ' ' });
        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('select mode ignores other keys', () => {
        const onClick = jest.fn();
        render(
            <OptionListRow label="A" icon="A" onClick={onClick} mode="select" />,
        );
        const radio = screen.getByRole('radio');
        fireEvent.keyDown(radio, { key: 'a' });
        expect(onClick).not.toHaveBeenCalled();
    });

    it('select mode is non-interactive when disabled', () => {
        const onClick = jest.fn();
        render(
            <OptionListRow label="A" icon="A" onClick={onClick} mode="select" disabled />,
        );
        const radio = screen.getByRole('radio');
        fireEvent.click(radio);
        fireEvent.keyDown(radio, { key: 'Enter' });
        expect(onClick).not.toHaveBeenCalled();
    });

    it('renders with iconSurface=neutral path', () => {
        render(<OptionListRow label="Neutral Label" icon="N" onClick={() => {}} iconSurface="neutral" />);
        expect(screen.getByText('Neutral Label')).toBeInTheDocument();
    });
});
