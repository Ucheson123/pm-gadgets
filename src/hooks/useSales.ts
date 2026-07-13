import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ==========================================
// TYPES
// ==========================================
export interface SaleItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  imeis: string[] | null;
  product: { name: string; sku: string } | null;
}

export interface SaleRow {
  id: string;
  receipt_number: string;
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total_amount: number;
  created_at: string;
  customer: { full_name: string; phone: string | null } | null;
  salesperson: { full_name: string } | null;
  sale_items: SaleItemRow[];
}

export interface CustomerOption {
  id: string;
  full_name: string;
  phone: string | null;
}

const SALES_KEY = ['sales'];
const SALE_SELECT = `id, receipt_number, subtotal, discount_amount, vat_amount, total_amount, created_at,
  customer:customers(full_name, phone),
  salesperson:users!sales_salesperson_id_fkey(full_name),
  sale_items(id, quantity, unit_price, imeis, product:products(name, sku))`;

// ==========================================
// QUERIES
// ==========================================
// RLS: staff see only their branch's sales (PRD §18)
export const useSales = () =>
  useQuery({
    queryKey: SALES_KEY,
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from('sales')
        .select(SALE_SELECT)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

// Single sale (for the receipt right after checkout)
export const useSaleDetail = (saleId: string | null) =>
  useQuery({
    queryKey: ['sale', saleId],
    enabled: !!saleId,
    queryFn: async (): Promise<SaleRow> => {
      const { data, error } = await supabase
        .from('sales')
        .select(SALE_SELECT)
        .eq('id', saleId)
        .single();
      if (error) throw error;
      return data as unknown as SaleRow;
    },
  });

// Existing branch customers, for quick reuse at the POS
export const useCustomers = () =>
  useQuery({
    queryKey: ['customers'],
    queryFn: async (): Promise<CustomerOption[]> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as CustomerOption[];
    },
  });

// ==========================================
// MUTATION: checkout via the create_sale RPC.
// The database enforces salesperson role, branch scope, zero-stock
// blocking, IMEI/quantity match, discount <= subtotal, and price+cost
// snapshotting — atomically.
// ==========================================
export interface CheckoutInput {
  customer: { id: string } | { full_name: string; phone: string; email: string };
  items: { product_id: string; quantity: number; imeis?: string[] }[];
  applyVat: boolean;
  discount: number;
}

export const useCreateSale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      const { data, error } = await supabase.rpc('create_sale', {
        p_customer: input.customer,
        p_items: input.items,
        p_apply_vat: input.applyVat,
        p_discount: input.discount,
      });
      if (error) throw error;
      return data as { sale_id: string; receipt_number: string; total_amount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SALES_KEY });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
    },
  });
};