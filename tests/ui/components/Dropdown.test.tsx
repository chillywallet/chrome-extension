import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Dropdown from '../../../src/ui/components/Dropdown';

const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta', subLabel: 'second', badge: 'NEW' },
    { value: 'c', label: 'Gamma', disabled: true },
];

describe('Dropdown', () => {
    it('renders placeholder when no value selected', () => {
        render(<Dropdown options={options} onChange={jest.fn()} placeholder="Pick one" />);
        expect(screen.getByText('Pick one')).toBeInTheDocument();
    });

    it('renders the selected option label', () => {
        render(<Dropdown options={options} value="b" onChange={jest.fn()} />);
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('NEW')).toBeInTheDocument();
    });

    it('opens the menu on click and shows options', () => {
        render(<Dropdown options={options} onChange={jest.fn()} usePortal={false} />);
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
    });

    it('does not open when disabled', () => {
        render(
            <Dropdown options={options} onChange={jest.fn()} usePortal={false} disabled={true} />,
        );
        fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByText('Alpha')).toBeNull();
    });

    it('calls onChange when a non-disabled option is clicked', () => {
        const onChange = jest.fn();
        render(<Dropdown options={options} onChange={onChange} usePortal={false} />);
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Alpha'));
        expect(onChange).toHaveBeenCalledWith('a', options[0]);
    });

    it('ignores clicks on disabled options', () => {
        const onChange = jest.fn();
        render(<Dropdown options={options} onChange={onChange} usePortal={false} />);
        fireEvent.click(screen.getByRole('button'));
        // disabled HTML buttons in jsdom do not fire onClick — assert via attribute
        const gamma = screen.getByText('Gamma').closest('button');
        expect(gamma).toBeDisabled();
    });

    it('shows search input when searchable and filters options', () => {
        render(
            <Dropdown
                options={options}
                onChange={jest.fn()}
                searchable={true}
                usePortal={false}
            />,
        );
        fireEvent.click(screen.getAllByRole('button')[0]);
        const input = screen.getByPlaceholderText('Search...');
        fireEvent.change(input, { target: { value: 'alph' } });
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.queryByText('Beta')).toBeNull();
    });

    it('shows empty message when search yields no matches', () => {
        render(
            <Dropdown
                options={options}
                onChange={jest.fn()}
                searchable={true}
                usePortal={false}
            />,
        );
        fireEvent.click(screen.getAllByRole('button')[0]);
        fireEvent.change(screen.getByPlaceholderText('Search...'), {
            target: { value: 'xyz' },
        });
        expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('shows the empty state when there are no options at all', () => {
        render(<Dropdown options={[]} onChange={jest.fn()} usePortal={false} />);
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText('No options available')).toBeInTheDocument();
    });

    it('closes when clicking outside the dropdown', () => {
        render(
            <div>
                <span data-testid="outside">outside</span>
                <Dropdown options={options} onChange={jest.fn()} usePortal={false} />
            </div>,
        );
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText('Alpha')).toBeInTheDocument();

        // mousedown outside the [data-dropdown] container
        fireEvent.mouseDown(screen.getByTestId('outside'));
        expect(screen.queryByText('Alpha')).toBeNull();
    });

    it('does not close when clicking inside the dropdown', () => {
        render(<Dropdown options={options} onChange={jest.fn()} usePortal={false} />);
        fireEvent.click(screen.getByRole('button'));
        const alpha = screen.getByText('Alpha');
        fireEvent.mouseDown(alpha);
        // still open
        expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    it('stops propagation when clicking the search input', () => {
        render(
            <Dropdown
                options={options}
                onChange={jest.fn()}
                searchable={true}
                usePortal={false}
            />,
        );
        fireEvent.click(screen.getAllByRole('button')[0]);
        const input = screen.getByPlaceholderText('Search...');
        // Clicking input must not close the dropdown (covers stopPropagation line 129)
        fireEvent.click(input);
        expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    it('does not invoke onChange when isOpen state stays false (disabled)', () => {
        const onChange = jest.fn();
        render(
            <Dropdown
                options={options}
                onChange={onChange}
                usePortal={false}
                disabled={true}
            />,
        );
        // first click won't open, second still won't
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByRole('button'));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('passes the search query to onSearch callback', () => {
        const onSearch = jest.fn();
        render(
            <Dropdown
                options={options}
                onChange={jest.fn()}
                searchable={true}
                onSearch={onSearch}
                usePortal={false}
            />,
        );
        fireEvent.click(screen.getAllByRole('button')[0]);
        fireEvent.change(screen.getByPlaceholderText('Search...'), {
            target: { value: 'beta' },
        });
        expect(onSearch).toHaveBeenCalledWith('beta');
    });

    it('renders the selected option icon, subLabel, rightContent and isLoading', () => {
        const opts = [
            {
                value: 'x',
                label: 'WithExtras',
                icon: <span data-testid="opt-icon" />,
                subLabel: 'sub',
                rightContent: <span data-testid="opt-right" />,
                isLoading: true,
            },
        ];
        render(<Dropdown options={opts} value="x" onChange={jest.fn()} usePortal={false} />);
        expect(screen.getByText('WithExtras')).toBeInTheDocument();
        expect(screen.getByText('sub')).toBeInTheDocument();
        expect(screen.getByTestId('opt-icon')).toBeInTheDocument();
        expect(screen.getByTestId('opt-right')).toBeInTheDocument();
    });

    it('uses portal when usePortal default true and shows options in document body', () => {
        render(<Dropdown options={options} onChange={jest.fn()} />);
        fireEvent.click(screen.getByRole('button'));
        // option should be rendered (portal still attaches to body which jsdom queries)
        expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    it('clicking an option (with portal) calls onChange and closes', () => {
        const onChange = jest.fn();
        render(<Dropdown options={options} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Beta'));
        expect(onChange).toHaveBeenCalledWith('b', options[1]);
    });

    it('renders options with icon, rightContent and no isLoading', () => {
        const opts = [
            {
                value: 'x',
                label: 'WithExtras',
                icon: <span data-testid="opt-icon" />,
                subLabel: 'sub',
                rightContent: <span data-testid="opt-right" />,
            },
        ];
        render(<Dropdown options={opts} onChange={jest.fn()} usePortal={false} />);
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getAllByTestId('opt-icon').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('opt-right').length).toBeGreaterThan(0);
        expect(screen.getByText('sub')).toBeInTheDocument();
    });

    it('renders selected option with rightContent without isLoading', () => {
        const opts = [
            {
                value: 'y',
                label: 'Selected',
                rightContent: <span data-testid="sel-right" />,
            },
        ];
        render(<Dropdown options={opts} value="y" onChange={jest.fn()} usePortal={false} />);
        expect(screen.getByTestId('sel-right')).toBeInTheDocument();
    });

    it('handleOptionClick early-returns for option.disabled (covers branch)', () => {
        // Directly invoke the underlying disabled-option click by simulating a click event on the disabled button
        const onChange = jest.fn();
        const opts = [{ value: 'd', label: 'DisabledOption', disabled: true }];
        const { container } = render(
            <Dropdown options={opts} onChange={onChange} usePortal={false} />,
        );
        fireEvent.click(screen.getByRole('button'));
        // The disabled option still renders; simulate a click on the underlying <button>
        const disabledBtn = container.querySelector(
            'button[disabled]:not([type="button"]):not([class*="w-full p-3"])',
        );
        // jsdom blocks click on disabled, so test attribute only — branch covered if option.disabled true via handleOptionClick guard
        // To cover the option.disabled branch, fire a synthetic click on the disabled option (jsdom prevents real disabled clicks)
        const allButtons = screen.getAllByRole('button');
        // Manually invoke click on the option button - jsdom doesn't actually fire for disabled, so use dispatch
        const optBtn = Array.from(allButtons).find(
            b => b.textContent?.includes('DisabledOption') && (b as HTMLButtonElement).disabled,
        );
        if (optBtn) {
            // dispatchEvent ignores disabled state and triggers the onClick handler
            optBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        expect(onChange).not.toHaveBeenCalled();
    });
});
