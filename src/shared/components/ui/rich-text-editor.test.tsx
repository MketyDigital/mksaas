import { render, waitFor } from '@testing-library/react';

import { RichTextEditor } from './rich-text-editor';

describe('rich text editor dependency compatibility', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registers each extension once', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<RichTextEditor value="Notes" tenantSlug="example" onChange={jest.fn()} />);
    await waitFor(() => expect(container.querySelector('.tiptap')).not.toBeNull());
    expect(warn.mock.calls.flat().some((entry) => String(entry).includes('Duplicate extension'))).toBe(false);
  });
  it('renders and updates controlled rich content without emitting a customer edit', async () => {
    const onChange = jest.fn();
    const { container, rerender } = render(
      <RichTextEditor value="<p>Hello <strong>customer</strong></p>" tenantSlug="example" onChange={onChange} />,
    );
    await waitFor(() => expect(container.querySelector('.tiptap strong')).toHaveTextContent('customer'));
    onChange.mockClear(); // Ignore initial editor normalization; the external update must stay silent.
    rerender(<RichTextEditor value="<p>Updated <em>notes</em></p>" tenantSlug="example" onChange={onChange} />);
    await waitFor(() => expect(container.querySelector('.tiptap em')).toHaveTextContent('notes'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps disabled customer notes read-only', async () => {
    const { container } = render(
      <RichTextEditor value="Read only notes" tenantSlug="example" onChange={jest.fn()} disabled />,
    );
    await waitFor(() => expect(container.querySelector('.tiptap')).toHaveAttribute('contenteditable', 'false'));
  });
});
