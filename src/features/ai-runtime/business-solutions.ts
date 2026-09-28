export type EnterpriseAiSolutionKey =
  | 'customer-support'
  | 'lead-follow-up'
  | 'business-knowledge'
  | 'operations-booking'
  | 'team-assistant'
  | 'custom-automation';

export type EnterpriseAiSolution = {
  key: EnterpriseAiSolutionKey;
  title: string;
  shortDescription: string;
  outcomes: string[];
  setupSteps: string[];
  readiness: 'available' | 'guided';
};

export const ENTERPRISE_AI_SOLUTIONS: EnterpriseAiSolution[] = [
  {
    key: 'customer-support',
    title: 'Help customers faster',
    shortDescription: 'Give your team an AI assistant that can answer common questions from approved business knowledge and prepare support replies.',
    outcomes: [
      'Answer repeat questions consistently',
      'Give staff faster draft replies',
      'Use your approved business information',
    ],
    setupSteps: ['Choose the customer questions to handle', 'Add approved business information', 'Review and test answers', 'Connect a supported channel when ready'],
    readiness: 'available',
  },
  {
    key: 'lead-follow-up',
    title: 'Follow up leads',
    shortDescription: 'Help sales teams qualify enquiries, prepare replies, summarize prospects, and keep follow-up work organized.',
    outcomes: [
      'Respond to new enquiries faster',
      'Summarize lead context',
      'Prepare follow-up messages for review',
    ],
    setupSteps: ['Choose your lead source', 'Describe your offer and qualification rules', 'Review sample follow-ups', 'Connect approved CRM or messaging tools when ready'],
    readiness: 'guided',
  },
  {
    key: 'business-knowledge',
    title: 'Ask your business anything',
    shortDescription: 'Create a private assistant for policies, procedures, products, files, FAQs, and internal business knowledge.',
    outcomes: [
      'Find answers across business information',
      'Reduce repeated internal questions',
      'Keep answers linked to approved sources',
    ],
    setupSteps: ['Choose who can use the assistant', 'Add business knowledge', 'Set answer rules', 'Test with common team questions'],
    readiness: 'available',
  },
  {
    key: 'operations-booking',
    title: 'Handle bookings and operations',
    shortDescription: 'Guide routine requests, collect the right details, summarize work, and connect approved business workflows.',
    outcomes: [
      'Collect complete customer information',
      'Reduce repetitive admin work',
      'Route requests to the right process',
    ],
    setupSteps: ['Choose the process to simplify', 'Define required information', 'Set approval rules', 'Connect calendars, forms, or workflows when supported'],
    readiness: 'guided',
  },
  {
    key: 'team-assistant',
    title: 'Give your team an assistant',
    shortDescription: 'Help employees draft, summarize, research approved knowledge, and complete repeatable internal work.',
    outcomes: [
      'Save time on routine writing and summaries',
      'Standardize common team work',
      'Keep company context private to the workspace',
    ],
    setupSteps: ['Choose the team', 'Choose allowed tasks', 'Add relevant knowledge', 'Review permissions and launch internally'],
    readiness: 'available',
  },
  {
    key: 'custom-automation',
    title: 'Build a custom AI workflow',
    shortDescription: 'Combine agents, knowledge, tools, APIs, approvals, and workflows for advanced business processes.',
    outcomes: [
      'Connect AI to your existing systems',
      'Add human approvals to important actions',
      'Use developer APIs and custom integrations',
    ],
    setupSteps: ['Define the business outcome', 'Choose data and systems', 'Set permissions and approvals', 'Test before production'],
    readiness: 'guided',
  },
];

export function getEnterpriseAiSolution(key: string) {
  return ENTERPRISE_AI_SOLUTIONS.find((solution) => solution.key === key) ?? null;
}
