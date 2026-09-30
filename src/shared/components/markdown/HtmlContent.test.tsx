import { render } from '@testing-library/react';

import { HtmlContent } from './HtmlContent';

describe('stored rich HTML rendering', () => {
  it('preserves customer formatting, public links and attached images', () => {
    const { container } = render(
      <HtmlContent html='<p>Hello <strong>customer</strong></p><a href="https://mkety.com/docs" target="_blank" rel="noopener noreferrer">Docs</a><img src="https://mkety.com/image.png" alt="Attachment">' />,
    );
    expect(container.querySelector('strong')).toHaveTextContent('customer');
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://mkety.com/docs');
    expect(container.querySelector('img')).toHaveAttribute('alt', 'Attachment');
  });

  it('removes executable markup and unsafe link protocols from stored content', () => {
    const { container } = render(
      <HtmlContent html='<p>Safe</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Unsafe link</a><svg onload="alert(1)"></svg>' />,
    );
    expect(container.querySelector('p')).toHaveTextContent('Safe');
    expect(container.querySelector('script, svg')).toBeNull();
    expect(container.querySelector('img')).not.toHaveAttribute('onerror');
    expect(container.querySelector('a')).not.toHaveAttribute('href');
  });
});
