import type { MketyPublicPageDefault } from './public-page-defaults';

export const MKETY_LEGAL_PAGE_DEFAULTS: readonly MketyPublicPageDefault[] = [
  {
    slug: 'privacy',
    title: 'Mkety Privacy Policy',
    seoTitle: 'Mkety Privacy Policy | Data and privacy information',
    seoDescription: 'Read how Mkety handles information across the public website, Mkety Platform, Academy and Enterprise services.',
    eyebrow: 'Privacy Policy',
    headline: 'Mkety privacy and how we handle information.',
    intro:
      'Effective 22 September 2026. This Privacy Policy explains the main categories of information Mkety may process, why that information is used, and the choices available to you when you use mkety.com, Mkety Platform, public Mkety AI, Academy entry points, or Enterprise services.',
    sections: [
      {
        eyebrow: 'Information we process',
        title: 'Information depends on how you use Mkety.',
        description:
          'Mkety processes information needed to provide, secure, support and improve the services you choose to use. Please do not submit passwords, private keys, payment secrets or other credentials through public support or public AI conversations.',
        items: [
          {
            key: 'identity',
            title: 'Account and organization information',
            description:
              'This can include your name, email address, organization, membership, role, tenant, project and workspace information used to authenticate you and provide authorized access.',
          },
          {
            key: 'submitted-content',
            title: 'Content and configuration you provide',
            description:
              'This can include prompts, documents, workflow or agent configuration, project information, support messages, files and other content you intentionally submit to a Mkety feature.',
          },
          {
            key: 'operations',
            title: 'Usage, security and technical information',
            description:
              'Mkety may process service usage, request metadata, device or browser information, security events, audit events, deployment records and diagnostics needed to operate, protect and troubleshoot the service.',
          },
          {
            key: 'commercial',
            title: 'Billing and transaction information',
            description:
              'Mkety may process plan selections, invoices, payment references, settlement status and related commercial records. Payment credentials may be handled by the applicable payment provider rather than stored directly by Mkety.',
          },
        ],
      },
      {
        eyebrow: 'How information is used',
        title: 'Information is used to provide and protect Mkety services.',
        description:
          'Mkety may use information to provide requested product functionality, authenticate users, enforce permissions, process billing, maintain records, prevent abuse, respond to support enquiries, troubleshoot failures, improve service quality and meet legal or operational requirements.',
        items: [
          {
            key: 'service-delivery',
            title: 'Service delivery',
            description:
              'Operate Mkety Platform, public Mkety AI, billing, support, Enterprise delivery and other requested product experiences.',
          },
          {
            key: 'security-fraud',
            title: 'Security and abuse prevention',
            description:
              'Detect suspicious activity, enforce tenant and project boundaries, investigate incidents and protect Mkety, customers and infrastructure.',
          },
          {
            key: 'support',
            title: 'Support and communications',
            description:
              'Respond to enquiries, send service-related information and follow up on product, Academy or Enterprise requests you submit.',
          },
        ],
      },
      {
        eyebrow: 'Providers and integrations',
        title: 'Some services rely on trusted third-party providers.',
        description:
          'Depending on the feature you use, information may be processed by infrastructure, identity, AI-model, communications, payment or other service providers required to deliver that feature. Connected third-party accounts and integrations are also subject to the third party’s own terms and privacy practices.',
        items: [
          {
            key: 'ai',
            title: 'AI processing',
            description:
              'Prompts and related context may be sent to configured AI providers when an AI feature requires model processing. AI outputs can be inaccurate and should be reviewed before being relied on for important decisions.',
          },
          {
            key: 'integrations',
            title: 'Connected services',
            description:
              'When you connect an external service, Mkety may process the information necessary to perform the actions you configure, subject to the permissions granted to that integration.',
          },
          {
            key: 'international',
            title: 'Provider locations',
            description:
              'Service providers may process information in countries different from your own. The location and safeguards can vary by provider and feature.',
          },
        ],
      },
      {
        eyebrow: 'Cookies and storage',
        title: 'Mkety uses storage needed for sessions and product continuity.',
        description:
          'Mkety may use cookies or similar browser storage for authentication, security, preferences, public AI continuity and other service functions. If optional analytics or marketing tracking is introduced, the public disclosure and consent experience should be updated before that tracking is enabled.',
        items: [],
      },
      {
        eyebrow: 'Retention and security',
        title: 'Retention varies by purpose; security controls protect access.',
        description:
          'Mkety keeps information for as long as reasonably necessary for the feature, account, security, billing, support, contractual or legal purpose involved. Different records can have different retention needs. Mkety uses technical and organizational controls intended to protect access, but no online service can guarantee absolute security.',
        items: [],
      },
      {
        eyebrow: 'Your choices',
        title: 'You can contact Mkety about privacy or account information.',
        description:
          'You may contact Mkety to ask questions about this policy or request access, correction or deletion where applicable. Some information may need to be retained for security, billing, dispute, legal or other legitimate operational reasons.',
        items: [
          {
            key: 'contact',
            title: 'Privacy contact',
            description:
              'Use the Mkety contact page or email support@mkety.com for privacy and account-data enquiries.',
            href: '/contact#mkety-ai',
          },
        ],
        cta: { label: 'Contact Mkety', href: '/contact#mkety-ai' },
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Mkety Terms of Service',
    seoTitle: 'Mkety Terms of Service | Usage, billing and acceptable use',
    seoDescription: 'Read the terms governing use of Mkety Platform, public services, Academy entry points and Enterprise services.',
    eyebrow: 'Terms of Service',
    headline: 'Terms for using Mkety services.',
    intro:
      'Effective 22 September 2026. These Terms govern access to Mkety public services and Mkety Platform unless a separate written agreement, Enterprise statement of work, Academy agreement or product-specific term applies. By creating an account, purchasing a service, or using Mkety, you agree to the applicable terms.',
    sections: [
      {
        eyebrow: 'Accounts and access',
        title: 'Use only the access granted to you.',
        description:
          'You are responsible for the accuracy of information you provide, for keeping credentials and recovery methods secure, and for activity performed through your account or organization unless applicable law requires otherwise.',
        items: [
          {
            key: 'authorized-access',
            title: 'Authorized access only',
            description:
              'Use only organizations, projects, workspaces, billing records, integrations and services you are permitted to access.',
          },
          {
            key: 'account-security',
            title: 'Protect credentials',
            description:
              'Do not share passwords, session tokens, private keys, API credentials or other secrets with unauthorized people or through public support channels.',
          },
        ],
      },
      {
        eyebrow: 'Acceptable use',
        title: 'Use Mkety lawfully and do not abuse the platform.',
        description:
          'You must not use Mkety to commit fraud, phishing, malware distribution, unauthorized access, spam, unlawful surveillance, intellectual-property infringement or other illegal activity. You must not bypass tenant isolation, authorization, usage restrictions, rate limits, security controls or provider safeguards.',
        items: [
          {
            key: 'security',
            title: 'No security circumvention',
            description:
              'Do not probe, disrupt, overload, reverse engineer security controls, or attempt to access data or infrastructure you are not authorized to use.',
          },
          {
            key: 'content',
            title: 'You are responsible for your content and instructions',
            description:
              'You must have the rights and permissions required for content, data, credentials, integrations and instructions you provide to Mkety.',
          },
        ],
      },
      {
        eyebrow: 'AI, automation and integrations',
        title: 'Automated systems require human review and responsible configuration.',
        description:
          'AI outputs can be inaccurate or incomplete. Automated workflows and connected integrations can perform actions based on your configuration. You are responsible for reviewing important outputs, setting appropriate permissions and ensuring your use complies with third-party terms and applicable law.',
        items: [
          {
            key: 'ai-outputs',
            title: 'AI outputs are not guaranteed to be correct',
            description:
              'Do not rely on AI-generated output as the sole basis for legal, medical, financial, safety-critical or other high-impact decisions without appropriate independent review.',
          },
          {
            key: 'third-parties',
            title: 'Third-party services have their own rules',
            description:
              'External AI providers, payment providers, communications tools and other integrations may change, limit, suspend or discontinue their services independently of Mkety.',
          },
        ],
      },
      {
        eyebrow: 'Plans, billing and cancellation',
        title: 'Commercial terms come from the applicable Mkety offer and billing record.',
        description:
          'Prices, included features, usage, credits, billing periods and renewal behavior are determined by the applicable offer, checkout, invoice, subscription record or written agreement. Taxes, exchange-rate effects and provider charges may apply where relevant.',
        items: [
          {
            key: 'subscriptions',
            title: 'Subscriptions',
            description:
              'Self-service subscriptions remain subject to the billing period and status shown in Mkety Billing. Access or entitlements are granted only after the required verified billing state is reached.',
          },
          {
            key: 'cancellation',
            title: 'Cancellation',
            description:
              'Where cancellation is available, it prevents future renewal according to the applicable billing rules; it does not automatically reverse charges already settled or services already delivered.',
          },
          {
            key: 'refunds',
            title: 'Refunds',
            description:
              'Payments are generally non-refundable once access, digital delivery, reserved capacity or services have been provided, except where the applicable offer, written agreement, payment-provider rule or law requires otherwise. Approved refunds, credits or adjustments are recorded through Mkety Billing.',
          },
        ],
      },
      {
        eyebrow: 'Academy, Enterprise and Trading',
        title: 'Specialized services may have additional written terms.',
        description:
          'Academy programmes, Enterprise projects and Trading solutions can involve separate scope, delivery, risk, payment or access conditions. Where a separate written agreement conflicts with these general Terms, the separate agreement controls for that service.',
        items: [
          {
            key: 'academy',
            title: 'Mkety Academy',
            description:
              'Programme schedules, tuition, attendance, course access, transfer rules and refund conditions are governed by the applicable Academy offer or enrolment agreement.',
            href: '/academy#mkety-ai',
          },
          {
            key: 'enterprise',
            title: 'Enterprise delivery',
            description:
              'Custom systems and managed implementations are governed by the accepted scope, price, milestones and any service commitments stated in the applicable written agreement.',
            href: '/enterprise',
          },
          {
            key: 'trading',
            title: 'Trading solutions',
            description:
              'Trading products are Custom / Enterprise services. Markets involve risk and Mkety does not guarantee trading performance, profit or loss avoidance.',
            href: '/enterprise',
          },
        ],
      },
      {
        eyebrow: 'Intellectual property',
        title: 'Mkety and customer content remain subject to their respective rights.',
        description:
          'Mkety retains rights in its platform, software, branding, documentation and service materials. You retain rights you hold in content you provide, while granting Mkety the permissions reasonably required to process that content for the services you request.',
        items: [],
      },
      {
        eyebrow: 'Availability and changes',
        title: 'Services can evolve and may depend on external providers.',
        description:
          'Mkety may add, change, limit or discontinue product features as the service evolves. Public descriptions should reflect current capabilities but do not create an uptime, support, roadmap or service-level guarantee unless one is stated in an applicable written agreement.',
        items: [],
      },
      {
        eyebrow: 'Suspension and termination',
        title: 'Access may be restricted for security, abuse or non-payment.',
        description:
          'Mkety may suspend or terminate access where reasonably necessary to address unlawful activity, security risk, abuse, material breach, unpaid amounts, provider restrictions or threats to the service or other users. Where appropriate, Mkety may provide notice or an opportunity to remedy the issue.',
        items: [],
      },
      {
        eyebrow: 'Disclaimers and liability',
        title: 'Use Mkety with appropriate judgment and safeguards.',
        description:
          'To the extent permitted by applicable law, Mkety services are provided without guarantees that every feature will be uninterrupted, error-free or suitable for every purpose. Liability, indemnity, warranty and service-level terms may be further defined in a separate written agreement for Enterprise or other specialized services.',
        items: [],
      },
      {
        eyebrow: 'Contact and updates',
        title: 'Questions about these Terms can be sent to Mkety.',
        description:
          'Mkety may update these Terms as services, providers or legal requirements change. Material updates should be reflected on this page with a revised effective date. Continued use after an update may be subject to the revised Terms where permitted by applicable law.',
        items: [
          {
            key: 'contact',
            title: 'Contact',
            description: 'Use the Mkety contact page or email support@mkety.com for Terms, billing or account questions.',
            href: '/contact#mkety-ai',
          },
        ],
        cta: { label: 'Contact Mkety', href: '/contact#mkety-ai' },
      },
    ],
  },
] as const;

export function getDefaultLegalPage(slug: string): MketyPublicPageDefault | null {
  return MKETY_LEGAL_PAGE_DEFAULTS.find((page) => page.slug === slug) ?? null;
}
