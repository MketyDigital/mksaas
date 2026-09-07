import type { BillingGatewayAdapter } from './types';

export class BillingGatewayRegistry {
  private readonly adapters = new Map<string, BillingGatewayAdapter>();

  register(adapter: BillingGatewayAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`Billing gateway provider already registered: ${adapter.provider}`);
    }

    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: string): BillingGatewayAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Unknown billing gateway provider: ${provider}`);
    }

    return adapter;
  }
}
