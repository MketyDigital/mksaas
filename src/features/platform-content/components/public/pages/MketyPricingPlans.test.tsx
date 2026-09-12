import { render, screen } from '@testing-library/react';

import { MketyPricingPlans } from './MketyPricingPlans';

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    priceLabel: 'Start simple',
    description: 'For focused projects.',
    highlighted: false,
    ctaLabel: 'Get started',
    ctaHref: '/create-workspace',
    features: ['AI workspace'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    description: 'For specialized implementations.',
    highlighted: true,
    ctaLabel: 'Contact Mkety',
    ctaHref: '/contact',
    features: ['Trading available through Custom / Enterprise engagement'],
  },
];

describe('MketyPricingPlans', () => {
  it('renders published plan data and keeps Trading custom/enterprise', () => {
    render(<MketyPricingPlans plans={plans} />);

    expect(screen.getByRole('heading', { name: 'Starter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument();
    expect(screen.getByText('Trading available through Custom / Enterprise engagement')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Mkety' })).toHaveAttribute('href', '/contact');
  });
});
