import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TextInput from '../../../src/ui/components/TextInput';

describe('TextInput', () => {
    it('renders label and input', () => {
        render(<TextInput label="Email" placeholder="Enter email" />);
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    it('forwards a ref to the input', () => {
        const ref = createRef<HTMLInputElement>();
        render(<TextInput ref={ref} placeholder="x" />);
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('forwards events to the input', () => {
        const onChange = jest.fn();
        render(<TextInput onChange={onChange} placeholder="x" />);
        fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: 'hi' } });
        expect(onChange).toHaveBeenCalled();
    });
});
