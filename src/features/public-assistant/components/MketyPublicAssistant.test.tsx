import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MketyPublicAssistant } from './MketyPublicAssistant';

describe('MketyPublicAssistant', () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ conversations: [], activeConversationId: null, messages: [] }),
    }) as jest.Mock;
  });

  it('renders one Mkety AI launcher without exposing provider or model controls', () => {
    render(<MketyPublicAssistant />);

    expect(screen.getByRole('button', { name: /ask mkety ai/i })).toBeInTheDocument();
    expect(screen.queryByText(/openai|gemini|bedrock|vertex|model selector/i)).not.toBeInTheDocument();
  });

  it('opens an accessible support panel with suggested Mkety questions', async () => {
    render(<MketyPublicAssistant />);
    fireEvent.click(screen.getByRole('button', { name: /ask mkety ai/i }));

    expect(await screen.findByRole('dialog', { name: /mkety ai/i })).toBeInTheDocument();
    expect(await screen.findByText('What can I build with Mkety?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /conversation history/i }));
    expect(screen.getByRole('button', { name: /clear history/i })).toBeInTheDocument();
  });

  it('sends only the visitor question and conversation id to the public endpoint', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversations: [], activeConversationId: null, messages: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: 'Mkety helps you build, automate and deploy.',
          conversationId: '11111111-1111-4111-8111-111111111111',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [],
          activeConversationId: '11111111-1111-4111-8111-111111111111',
          messages: [],
        }),
      });

    render(<MketyPublicAssistant />);
    fireEvent.click(screen.getByRole('button', { name: /ask mkety ai/i }));
    const input = await screen.findByLabelText(/message mkety ai/i);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: 'What is Mkety?' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    const [, request] = fetchMock.mock.calls[1];
    const body = JSON.parse(request.body);
    expect(body).toEqual({ message: 'What is Mkety?' });
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(await screen.findByText('Mkety helps you build, automate and deploy.')).toBeInTheDocument();
  });
});
