import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { openPaystackCheckout } from '../lib/paystack';

// ==========================================
// TYPES
// ==========================================
export interface Wallet {
  id: string;
  balance: number;
  updated_at: string;
}

export interface StatementTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface WalletStatement {
  opening_balance: number;
  closing_balance: number;
  current_balance: number;
  total_credits: number;
  total_debits: number;
  transactions: StatementTransaction[];
}

const WALLET_KEY = ['wallet'];
const STATEMENT_KEY = 'wallet-statement';

// ==========================================
// QUERY: branch wallet (RLS returns only the manager's own branch wallet)
// ==========================================
export const useWallet = () =>
  useQuery({
    queryKey: WALLET_KEY,
    queryFn: async (): Promise<Wallet> => {
      const { data, error } = await supabase
        .from('wallets')
        .select('id, balance, updated_at')
        .single();
      if (error) throw error;
      return data as Wallet;
    },
  });

// ==========================================
// MUTATION: full deposit flow
// 1. Insert a PENDING deposit row (RLS: own branch, own user, pending only)
// 2. Open the Paystack popup and wait for the user to pay
// 3. Ask the verify-deposit Edge Function to confirm with Paystack
//    and credit the wallet (server-side, idempotent)
// ==========================================
export interface DepositResult {
  status: 'completed' | 'already_completed' | 'not_paid';
  new_balance?: number;
  gateway_status?: string;
}

export const useDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      walletId: string;
      amountNaira: number;
    }): Promise<DepositResult> => {
      // The manager's email is required by Paystack checkout
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Could not determine your account email.');

      // Unique reference = the idempotency anchor for this whole deposit
      const reference = `PMG-DEP-${crypto.randomUUID()}`;

      // Step 1: pending deposit row (audited, RLS-guarded)
      const { error: insertError } = await supabase.from('deposits').insert({
        wallet_id: input.walletId,
        reference,
        amount: input.amountNaira,
        created_by: user.id,
      });
      if (insertError) throw insertError;

      // Step 2: Paystack popup (throws PaymentWindowClosedError on close)
      await openPaystackCheckout({
        email: user.email,
        amountNaira: input.amountNaira,
        reference,
      });

      // Step 3: server-side verification + crediting
      const { data, error } = await supabase.functions.invoke('verify-deposit', {
        body: { reference },
      });
      if (error) {
        throw new Error(
          'Payment was made but verification failed. Do NOT pay again — ' +
            'contact support with this reference: ' + reference
        );
      }
      if (data?.error) throw new Error(data.error);

      return data as DepositResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WALLET_KEY });
      queryClient.invalidateQueries({ queryKey: [STATEMENT_KEY] });
    },
  });
};

// ==========================================
// QUERY: wallet statement for a date range (server-computed)
// ==========================================
export const useWalletStatement = (start: Date, end: Date) =>
  useQuery({
    queryKey: [STATEMENT_KEY, start.toISOString(), end.toISOString()],
    queryFn: async (): Promise<WalletStatement> => {
      const { data, error } = await supabase.rpc('get_wallet_statement', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      });
      if (error) throw error;
      return data as WalletStatement;
    },
  });

// ==========================================
// DATE RANGE HELPERS for the statement filters (PRD §11)
// ==========================================
export type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

export const presetToRange = (preset: Exclude<RangePreset, 'custom'>): { start: Date; end: Date } => {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: now };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case 'last7': {
      const s = new Date(now);
      s.setDate(s.getDate() - 7);
      return { start: s, end: now };
    }
    case 'last30': {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      return { start: s, end: now };
    }
  }
};