import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ==========================================
// TYPES
// ==========================================
export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;       // selling price
  cost_price: number;  // buying price (manager-facing)
}

/** A catalog product merged with this branch's stock level */
export interface StockRow extends Product {
  quantity: number;
  stock_updated_at: string | null;
}

export interface NewProductInput {
  sku: string;
  name: string;
  description: string;
  price: number;
  costPrice: number;
  initialStock: number;
}

const STOCK_QUERY_KEY = ['branch-stock'];

// ==========================================
// QUERY: catalog + branch stock, merged
// ==========================================
// Products are a global catalog (readable by all staff); inventory rows are
// branch-scoped and RLS automatically filters them to the user's branch.
// Products the branch hasn't stocked yet show up with quantity 0.
const fetchBranchStock = async (): Promise<StockRow[]> => {
  const [productsRes, inventoryRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, sku, name, description, price, cost_price')
      .order('name'),
    supabase.from('inventory').select('product_id, quantity, updated_at'),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (inventoryRes.error) throw inventoryRes.error;

  const stockByProduct = new Map(
    (inventoryRes.data ?? []).map((row) => [row.product_id, row])
  );

  return (productsRes.data ?? []).map((product) => {
    const stock = stockByProduct.get(product.id);
    return {
      ...product,
      quantity: stock?.quantity ?? 0,
      stock_updated_at: stock?.updated_at ?? null,
    };
  });
};

export const useBranchStock = () =>
  useQuery({ queryKey: STOCK_QUERY_KEY, queryFn: fetchBranchStock });

// ==========================================
// MUTATION: add a product to the catalog
// ==========================================
// Inserts the product (manager-only via RLS), then stocks it through the
// adjust_inventory RPC if an initial quantity was given — so even the very
// first stock movement goes through the audited, race-safe path.
export const useAddProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewProductInput) => {
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          sku: input.sku.trim(),
          name: input.name.trim(),
          description: input.description.trim() || null,
          price: input.price,
          cost_price: input.costPrice,
        })
        .select('id, sku, name, description, price, cost_price')
        .single();

      if (error) throw error;

      if (input.initialStock > 0) {
        const { error: stockError } = await supabase.rpc('adjust_inventory', {
          p_product_id: product.id,
          p_quantity_change: input.initialStock,
        });
        // Product was created but stocking failed — surface a precise message
        if (stockError) {
          throw new Error(
            `Product created, but adding stock failed: ${stockError.message}`
          );
        }
      }

      return product as Product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STOCK_QUERY_KEY }),
  });
};

// ==========================================
// MUTATION: adjust stock via the Postgres RPC
// ==========================================
// The RPC enforces manager-only, branch scope, row locking, and the
// zero-stock floor. Errors (e.g. "Insufficient stock") come back as
// messages we can toast directly.
export const useAdjustStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { productId: string; quantityChange: number }) => {
      const { data, error } = await supabase.rpc('adjust_inventory', {
        p_product_id: input.productId,
        p_quantity_change: input.quantityChange,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STOCK_QUERY_KEY }),
  });
};

// ==========================================
// MUTATION: edit product details (prices etc.)
// ==========================================
// .select().single() is our zero-row-update guard: if RLS silently blocks
// the write (e.g. not an active manager), no row comes back and we throw
// instead of showing a false success. Changes are captured in audit_logs
// by the products_audit_trigger.
export interface UpdateProductInput {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  costPrice: number;
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      const { data, error } = await supabase
        .from('products')
        .update({
          sku: input.sku.trim(),
          name: input.name.trim(),
          description: input.description.trim() || null,
          price: input.price,
          cost_price: input.costPrice,
        })
        .eq('id', input.id)
        .select('id, sku, name, description, price, cost_price')
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error('No change was made. You may not have permission to edit products.');
      }
      return data as Product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STOCK_QUERY_KEY }),
  });
};

// ==========================================
// SHARED HELPERS
// ==========================================
export const formatNaira = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(value);

export const LOW_STOCK_THRESHOLD = 5;