/** @jest-environment node */

import { sanitizePublicAssistantAnswer } from './support';

describe('Public Mkety AI final response boundary', () => {
  it('removes private-source sentences while preserving public commercial guidance', () => {
    const answer = sanitizePublicAssistantAnswer(
      'Starter is $5.99/month. Academy questions start with Mkety AI. I cannot show the GitHub repository or pull requests. Trading purchases go through Enterprise.',
    );

    expect(answer).toContain('Starter is $5.99/month.');
    expect(answer).toContain('Academy questions start with Mkety AI.');
    expect(answer).toContain('Trading purchases go through Enterprise.');
    expect(answer).not.toContain('academy.mkety.com');
    expect(answer).not.toMatch(/GitHub|repositor(?:y|ies)|pull requests?/i);
  });

  it('returns a public-only fallback when every sentence contains private engineering terminology', () => {
    const answer = sanitizePublicAssistantAnswer(
      'I cannot show the repository. I cannot disclose branches or commits.',
    );

    expect(answer).toMatch(/public Mkety information/i);
    expect(answer).not.toMatch(/repositor(?:y|ies)|branches?|commits?/i);
  });

  it('does not alter ordinary public product answers', () => {
    const answer = 'Mkety One includes Starter, AI Workspace, Automation Workspace, and Deploy Workspace.';
    expect(sanitizePublicAssistantAnswer(answer)).toBe(answer);
  });
});
