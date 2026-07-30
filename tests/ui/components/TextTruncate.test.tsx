import React from 'react';
import { render, screen } from '@testing-library/react';
import TextTruncate from '../../../src/ui/components/TextTruncate';

jest.mock('react-middle-ellipsis', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('TextTruncate', () => {
    it('renders text in middle mode by default', () => {
        render(<TextTruncate text="abcdef" />);
        expect(screen.getByText('abcdef')).toBeInTheDocument();
    });

    it('renders truncate class in end mode', () => {
        const { container } = render(<TextTruncate text="abcdef" position="end" />);
        const root = container.firstChild as HTMLElement;
        expect(root.className).toContain('truncate');
    });
});
