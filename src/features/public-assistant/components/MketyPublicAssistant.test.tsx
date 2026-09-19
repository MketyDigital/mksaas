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

  it('renders one centered Mkety AI command surface without provider or model controls', () => {
    render(<MketyPublicAssistant />);

    const launcher = screen.getByRole('button', { name: /ask mkety ai/i });
    expect(launcher).toHaveAttribute('data-surface', 'mkety-ai-command');
    expect(launcher).toHaveClass('bg-transparent');
    expect(launcher).toHaveClass('max-w-[560px]');
    expect(screen.queryByText(/openai|gemini|bedrock|vertex|model selector/i)).not.toBeInTheDocument();
  });


  it('uses Mkety branding and opens at the top below the public header', () => {
    render(<MketyPublicAssistant />);

    const launcher = screen.getByRole('button', { name: /ask mkety ai/i });
    expect(launcher).toHaveClass('top-[4.5rem]');
    expect(launcher.querySelector('img')).toHaveAttribute('src', '/mkety-logo.png');
  });

  it('opens Enterprise sales intake from the public CTA deep link without exposing sensitive-data prompts', async () => {
    window.history.replaceState({}, '', '/?mketyAI=enterprise-sales');
    render(<MketyPublicAssistant />);

    const dialog = await screen.findByRole('dialog', { name: /mkety ai/i });
    expect(dialog).toHaveClass('top-[4.5rem]');
    expect(screen.getByText(/tell me briefly what you want mkety to build or help with/i)).toBeInTheDocument();
    expect(screen.getByText(/i need trading workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/avoid sharing passwords, payment details or private account data/i)).toBeInTheDocument();

    const input = screen.getByLabelText(/message mkety ai/i);
    fireEvent.change(input, { target: { value: 'We need a Trading Workspace for our team.' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2));
    const salesRequest = (global.fetch as jest.Mock).mock.calls.find(
      ([url, request]) => url === '/api/public/assistant' && request?.method === 'POST',
    );
    expect(salesRequest).toBeDefined();
    expect(JSON.parse(salesRequest![1].body)).toEqual({
      message: 'We need a Trading Workspace for our team.',
      intent: 'enterprise-sales',
    });

    window.history.replaceState({}, '', '/');
  });

  it('opens a centered rectangular support panel with suggested Mkety questions', async () => {
    render(<MketyPublicAssistant />);
    fireEvent.click(screen.getByRole('button', { name: /ask mkety ai/i }));

    const dialog = await screen.findByRole('dialog', { name: /mkety ai/i });
    expect(dialog).toHaveAttribute('data-surface', 'mkety-ai-panel');
    expect(await screen.findByText('What can I build with Mkety?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /conversation history/i }));
    expect(screen.getByRole('button', { name: /clear history/i })).toBeInTheDocument();
  });

  it('renders assistant markdown and bare Mkety routes as clean human-facing content', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        conversations: [],
        activeConversationId: '11111111-1111-4111-8111-111111111111',
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: '**Choose the plan that fits.**\n\n- Compare options\n- Start small\n\nSee /pricing for details.',
          },
        ],
      }),
    });

    render(<MketyPublicAssistant />);
    fireEvent.click(screen.getByRole('button', { name: /ask mkety ai/i }));

    expect(await screen.findByText('Choose the plan that fits.')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*Choose/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view pricing/i })).toHaveAttribute('href', '/pricing');
    expect(screen.queryByText('/pricing')).not.toBeInTheDocument();
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
