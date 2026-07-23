import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import AdminLayout from './layout';

describe('AdminLayout', () => {
  it('wraps every admin route in the .admin-app typography scope', () => {
    const { container } = render(
      <AdminLayout>
        <p>page content</p>
      </AdminLayout>
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('admin-app');
    expect(wrapper).toHaveTextContent('page content');
  });
});
