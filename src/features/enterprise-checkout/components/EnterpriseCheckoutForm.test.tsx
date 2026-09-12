import { render, screen } from '@testing-library/react';

import { EnterpriseCheckoutForm } from './EnterpriseCheckoutForm';

describe('EnterpriseCheckoutForm', () => {
  it('shows both approved providers and keeps fulfillment claims bounded', () => {
    render(<EnterpriseCheckoutForm />);

    expect(screen.getByRole('button', { name: /Crypto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Card \/ local payment/i })).toBeInTheDocument();
    expect(screen.getByText(/does not automatically activate a subscription/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to secure payment/i })).toBeInTheDocument();
  });

  it('requires customer, project, and agreed quote fields', () => {
    render(<EnterpriseCheckoutForm />);
    expect(screen.getByLabelText(/Full name/i)).toBeRequired();
    expect(screen.getByLabelText(/Company/i)).toBeRequired();
    expect(screen.getByLabelText(/Business email/i)).toBeRequired();
    expect(screen.getByLabelText(/Project name/i)).toBeRequired();
    expect(screen.getByLabelText(/Agreed project price/i)).toBeRequired();
  });
});
