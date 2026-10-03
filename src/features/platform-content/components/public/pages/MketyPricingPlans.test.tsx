import { fireEvent, render, screen } from '@testing-library/react';

import { MketyPricingPlans } from './MketyPricingPlans';

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    priceLabel: 'Start simple',
    description: 'For focused projects.',
    highlighted: false,
    ctaLabel: 'Get started',
    ctaHref: '/signup?plan=starter',
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
    expect(screen.getByText('$5.99')).toBeInTheDocument();
    expect(screen.getByText('Trading available through Custom / Enterprise engagement')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Mkety' })).toHaveAttribute('href', '/contact');
    expect(screen.getByText('$5.99')).toHaveAttribute('data-plan-price', 'starter:$5.99');
  });

  it('sends public self-service pricing to account creation with the selected billing term', () => {
    render(<MketyPricingPlans plans={plans} />);

    fireEvent.click(screen.getByRole('button', { name: '12 months · Save 15%' }));

    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/signup?plan=starter&term=12m',
    );
  });
});
