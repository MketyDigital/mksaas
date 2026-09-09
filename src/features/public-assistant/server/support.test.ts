import { buildPublicSystemPrompt, planPublicSupportTools } from './support';

describe('Mkety public support-agent behavior', () => {
  it('plans pricing and navigation tools for a pricing where-to question', () => {
    expect(planPublicSupportTools('Where can I see the plans and pricing?')).toEqual(
      expect.arrayContaining(['get_public_pricing', 'resolve_public_route']),
    );
  });

  it('plans docs and product knowledge for a how-to product question', () => {
    expect(planPublicSupportTools('How does Mkety Automation work?')).toEqual(
      expect.arrayContaining(['search_public_docs', 'get_public_product_summary']),
    );
  });

  it('hard-bounds the agent to production-safe public informational support', () => {
    const prompt = buildPublicSystemPrompt('PUBLIC CONTEXT');
    expect(prompt).toMatch(/public-facing Mkety support assistant/i);
    expect(prompt).toMatch(/never claim access to a visitor.*private/i);
    expect(prompt).toMatch(/do not disclose.*repositories.*github/i);
    expect(prompt).toMatch(/growth.*pro.*business.*not.*current/i);
    expect(prompt).toMatch(/academy\.mkety\.com/i);
    expect(prompt).toMatch(/trade\.mkety\.com/i);
    expect(prompt).toMatch(/academy.*pricing.*academy/i);
    expect(prompt).toMatch(/trading.*commercial.*trading.*enterprise/i);
    expect(prompt).toContain('PUBLIC CONTEXT');
  });
});
