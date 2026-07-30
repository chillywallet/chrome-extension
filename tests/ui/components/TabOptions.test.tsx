import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TabOptions from '../../../src/ui/components/TabOptions';

describe('TabOptions', () => {
    it('renders each option', () => {
        render(<TabOptions options={['one', 'two']} selected="one" onItemPress={jest.fn()} />);
        expect(screen.getByText('one')).toBeInTheDocument();
        expect(screen.getByText('two')).toBeInTheDocument();
    });

    it('emits onItemPress with the clicked option', () => {
        const onItemPress = jest.fn();
        render(<TabOptions options={['a', 'b']} selected="a" onItemPress={onItemPress} />);
        fireEvent.click(screen.getByText('b'));
        expect(onItemPress).toHaveBeenCalledWith('b');
    });

    it('marks selected option with the active class', () => {
        render(<TabOptions options={['a', 'b']} selected="a" onItemPress={jest.fn()} />);
        expect(screen.getByText('a').className).toContain('bg-white');
        expect(screen.getByText('b').className).toContain('text-gray-500');
    });

    it('transforms titles to uppercase', () => {
        render(
            <TabOptions
                options={['abc']}
                selected="abc"
                onItemPress={jest.fn()}
                titleCase="uppercase"
            />,
        );
        expect(screen.getByText('ABC')).toBeInTheDocument();
    });

    it('transforms titles to lowercase', () => {
        render(
            <TabOptions
                options={['XYZ']}
                selected="XYZ"
                onItemPress={jest.fn()}
                titleCase="lowercase"
            />,
        );
        expect(screen.getByText('xyz')).toBeInTheDocument();
    });

    it('capitalizes the first letter when titleCase is capitalize', () => {
        render(
            <TabOptions
                options={['hello']}
                selected="hello"
                onItemPress={jest.fn()}
                titleCase="capitalize"
            />,
        );
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('applies extra className on the wrapper', () => {
        const { container } = render(
            <TabOptions
                options={['a']}
                selected="a"
                onItemPress={jest.fn()}
                className="extra-class"
            />,
        );
        expect((container.firstChild as HTMLElement).className).toContain('extra-class');
    });
});
