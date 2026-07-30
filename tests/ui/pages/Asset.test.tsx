import React from 'react';
import { render, screen } from '@testing-library/react';

import Asset from '../../../src/ui/pages/Asset';

describe('Asset', () => {
    it('renders the Asset placeholder', () => {
        const { container } = render(<Asset />);

        expect(screen.getByText('Asset')).toBeInTheDocument();
        expect(container.firstChild).toMatchInlineSnapshot(`
          <div>
            Asset
          </div>
        `);
    });
});
