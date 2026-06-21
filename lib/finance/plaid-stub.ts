export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID?.trim() && process.env.PLAID_SECRET?.trim());
}

export interface PlaidReadStub {
  configured: boolean;
  mode: 'stub' | 'env_ready';
  message: string;
  balances?: Array<{ name: string; amount: number; currency: string }>;
}

export function readPlaidStub(): PlaidReadStub {
  if (!plaidConfigured()) {
    return {
      configured: false,
      mode: 'stub',
      message: 'Plaid not configured — set PLAID_CLIENT_ID and PLAID_SECRET, or track subscriptions in KB finance.subscriptions.',
    };
  }
  return {
    configured: true,
    mode: 'env_ready',
    message: 'Plaid credentials present — live read path deferred; use KB subscriptions for nudges until connector ships.',
    balances: [],
  };
}
