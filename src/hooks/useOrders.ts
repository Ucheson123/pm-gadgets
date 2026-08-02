import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ==========================================
// TYPES
// ==========================================
export type OrderStatus =
  | 'pending_payment' | 'paid' | 'processing' | 'approved'
  | 'awaiting_payment' | 'completed' | 'cancelled';

export type PaymentTerms = 'prepaid' | 'on_delivery';

export interface OrderItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  product: { name: string; sku: string } | null;
}

export interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_terms: PaymentTerms;
  total_amount: number;
  created_at: string;
  buyer_branch_id: string;
  seller_branch_id: string;
  buyer_branch: { name: string } | null;
  seller_branch: { name: string } | null;
  order_items: OrderItemRow[];
}

export interface RemoteStockRow {
  product_id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

const ORDERS_KEY = ['orders'];

// ==========================================
// QUERIES
// ==========================================
// RLS returns only orders where my branch is buyer or seller
export const useOrders = () =>
  useQuery({
    queryKey: ORDERS_KEY,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `id, order_number, status, payment_terms, total_amount, created_at,
           buyer_branch_id, seller_branch_id,
           buyer_branch:branches!orders_buyer_branch_id_fkey(name),
           seller_branch:branches!orders_seller_branch_id_fkey(name),
           order_items(id, quantity, unit_price, product:products(name, sku))`
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

export const useBranches = () =>
  useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

// Seller-branch stock via the manager-only RPC (empty for non-managers)
export const useRemoteBranchStock = (branchId: string | null) =>
  useQuery({
    queryKey: ['remote-branch-stock', branchId],
    enabled: !!branchId,
    queryFn: async (): Promise<RemoteStockRow[]> => {
      const { data, error } = await supabase.rpc('get_branch_stock', {
        p_branch_id: branchId,
      });
      if (error) throw error;
      return (data ?? []) as RemoteStockRow[];
    },
  });

// ==========================================
// MUTATIONS — thin wrappers around the RPCs.
// The database enforces role, branch, status, terms, stock, and idempotency.
// ==========================================
const useOrderAction = (fn: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc(fn, { p_order_id: orderId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-statement'] });
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['units-in-stock'] });
    },
  });
};

export const usePayOrder = () => useOrderAction('pay_order');
export const useFulfillOrder = () => useOrderAction('fulfill_order');
export const useReceiveOrder = () => useOrderAction('receive_order');
export const useCancelOrder = () => useOrderAction('cancel_order');

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sellerBranchId: string;
      items: { product_id: string; quantity: number }[];
      paymentTerms: PaymentTerms;
    }) => {
      const { data, error } = await supabase.rpc('create_order', {
        p_seller_branch_id: input.sellerBranchId,
        p_items: input.items,
        p_payment_terms: input.paymentTerms,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
  });
};