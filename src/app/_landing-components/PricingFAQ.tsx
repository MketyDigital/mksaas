'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';

const FAQ_ITEMS = [
  {
    q: 'What is Mkety Platform?',
    a: 'Mkety Platform brings AI, automation, deployment, projects, billing, usage and reusable business solutions into one connected product experience.',
  },
  {
    q: 'Do I need Mkety One?',
    a: 'No. You can use Starter or choose an individual AI, Automation or Deploy Workspace. Mkety One combines Starter with all three self-service Workspaces.',
  },
  {
    q: 'Can I pay for more than one month?',
    a: 'Yes. Self-service plans support 1, 3, 6 and 12 month prepaid terms. The approved subscription discounts are 0%, 5%, 10% and 15% respectively, so longer prepaid terms have a lower effective monthly rate.',
  },
  {
    q: 'Where do I access the Platform?',
    a: 'The main authenticated Platform is at app.mkety.com. Public product information, pricing and Enterprise enquiries remain on mkety.com.',
  },
  {
    q: 'How is account access protected?',
    a: 'Mkety uses organization, project, role and permission boundaries. You should also keep passwords, recovery methods, API credentials and other secrets private.',
  },
  {
    q: 'Does Mkety support Enterprise requirements?',
    a: 'Yes. Custom systems, specialized integrations, managed delivery and Trading requirements are handled through Mkety Enterprise under separately agreed scope and commercial terms.',
  },
  {
    q: 'Where can I learn more before buying?',
    a: 'Use the public Docs and Pricing pages for current product information. For Academy programmes, support, or custom requirements, start with Mkety AI on mkety.com; it checks public information first and routes you to the appropriate next step or human channel.',
  },
];

export function PricingFAQ() {
  return (
    <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto">
      {FAQ_ITEMS.map((item, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="text-left text-base font-medium">{item.q}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
