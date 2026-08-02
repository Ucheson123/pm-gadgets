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
  parent_id: string | null;                      // set on variants
  variant_attributes: Record<string, string> | null; // e.g. {"Color":"Black","Storage":"256GB"}
  track_imei: boolean;
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
  trackImei: boolean;
  imeis?: string[]; // required when trackImei && initialStock > 0
}

export interface VariantDef {
  sku: string;
  name: string; // composed: "iPhone 12 — Black / 256GB"
  attributes: Record<string, string>;
  price: number;
  costPrice: number;
}

export interface NewVariantProductInput {
  parentName: string;
  description: string;
  trackImei: boolean;
  variants: VariantDef[];
}

export interface UnitRow {
  id: string;
  imei: string;
}

const STOCK_QUERY_KEY = ['branch-stock'];
const PRODUCT_COLS =
  'id, sku, name, description, price, cost_price, parent_id, variant_attributes, track_imei';

// ==========================================
// QUERY: catalog + branch stock, merged
// ==========================================
const fetchBranchStock = async (): Promise<StockRow[]> => {
  const [productsRes, inventoryRes] = await Promise.all([
    supabase.from('products').select(PRODUCT_COLS).order('name'),
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
  }) as StockRow[];
};

export const useBranchStock = () =>
  useQuery({ queryKey: STOCK_QUERY_KEY, queryFn: fetchBranchStock });

// ==========================================
// QUERY: in-stock serialized units for an IMEI-tracked product
// (RLS scopes to the user's branch — used by the POS picker and
// the remove-stock picker)
// ==========================================
export const useUnitsInStock = (productId: string | null) =>
  useQuery({
    queryKey: ['units-in-stock', productId],
    enabled: !!productId,
    queryFn: async (): Promise<UnitRow[]> => {
      const { data, error } = await supabase
        .from('product_units')
        .select('id, imei')
        .eq('product_id', productId)
        .eq('status', 'in_stock')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as UnitRow[];
    },
  });

// ==========================================
// MUTATION: add a standard (non-variant) product
// ==========================================
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
          track_imei: input.trackImei,
        })
        .select(PRODUCT_COLS)
        .single();

      if (error) throw error;

      if (input.initialStock > 0) {
        const { error: stockError } = await supabase.rpc('adjust_inventory', {
          p_product_id: product.id,
          p_quantity_change: input.initialStock,
          p_imeis: input.trackImei ? (input.imeis ?? []) : null,
        });
        if (stockError) {
          throw new Error(
            `Product created, but adding stock failed: ${stockError.message}`
          );
        }
      }

      return product as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOCK_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['units-in-stock'] });
    },
  });
};

// ==========================================
// MUTATION: add a parent product with variants
// Variants are created with ZERO stock — each is then stocked via
// Adjust (which enforces IMEIs for tracked products).
// ==========================================
export const useAddVariantProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewVariantProductInput) => {
      // 1. Parent: a grouping label — carries no stock, no sellable price
      const { data: parent, error: parentError } = await supabase
        .from('products')
        .insert({
          sku: `GRP-${Date.now().toString(36).toUpperCase()}`,
          name: input.parentName.trim(),
          description: input.description.trim() || null,
          price: 0,
          cost_price: 0,
          track_imei: input.trackImei,
        })
        .select('id')
        .single();
      if (parentError) throw parentError;

      // 2. Variants in one atomic insert
      const { error: variantsError } = await supabase.from('products').insert(
        input.variants.map((v) => ({
          sku: v.sku.trim(),
          name: v.name,
          description: null,
          price: v.price,
          cost_price: v.costPrice,
          parent_id: parent.id,
          variant_attributes: v.attributes,
          track_imei: input.trackImei,
        }))
      );
      if (variantsError) {
        // Best-effort cleanup so a failed batch doesn't strand an empty parent
        await supabase.from('products').delete().eq('id', parent.id);
        throw variantsError;
      }

      return parent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STOCK_QUERY_KEY }),
  });
};

// ==========================================
// MUTATION: adjust stock (IMEI-aware)
// ==========================================
export const useAdjustStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      productId: string;
      quantityChange: number;
      imeis?: string[]; // required for IMEI-tracked products
    }) => {
      const { data, error } = await supabase.rpc('adjust_inventory', {
        p_product_id: input.productId,
        p_quantity_change: input.quantityChange,
        p_imeis: input.imeis ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOCK_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['units-in-stock'] });
    },
  });
};

// ==========================================
// MUTATION: edit product details
// ==========================================
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
        .select(PRODUCT_COLS)
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

export const parseImeiText = (raw: string): string[] => {
  const seen = new Set<string>();
  for (const piece of raw.split(/[\n,]+/)) {
    const trimmed = piece.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
};

export const variantLabel = (attrs: Record<string, string> | null): string =>
  attrs ? Object.values(attrs).join(' · ') : '';