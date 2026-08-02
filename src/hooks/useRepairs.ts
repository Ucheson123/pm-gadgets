import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ==========================================
// TYPES
// ==========================================
export type RepairStatus =
  | 'sent' | 'received' | 'repaired' | 'returned'
  | 'awaiting_payment' | 'completed' | 'cancelled';

export interface RepairRow {
  id: string;
  repair_number: string;
  status: RepairStatus;
  quantity: number;
  imeis: string[] | null;
  fault_description: string;
  repair_cost: number | null;
  repair_notes: string | null;
  created_at: string;
  sender_branch_id: string;
  repairer_branch_id: string;
  sender_branch: { name: string } | null;
  repairer_branch: { name: string } | null;
  product: { name: string; sku: string; track_imei: boolean } | null;
}

const REPAIRS_KEY = ['repairs'];

// RLS returns only repairs where my branch is sender or repairer
export const useRepairs = () =>
  useQuery({
    queryKey: REPAIRS_KEY,
    queryFn: async (): Promise<RepairRow[]> => {
      const { data, error } = await supabase
        .from('repair_orders')
        .select(
          `id, repair_number, status, quantity, imeis, fault_description,
           repair_cost, repair_notes, created_at,
           sender_branch_id, repairer_branch_id,
           sender_branch:branches!repair_orders_sender_branch_id_fkey(name),
           repairer_branch:branches!repair_orders_repairer_branch_id_fkey(name),
           product:products(name, sku, track_imei)`
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RepairRow[];
    },
  });

const invalidateAll = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: REPAIRS_KEY });
  queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
  queryClient.invalidateQueries({ queryKey: ['units-in-stock'] });
  queryClient.invalidateQueries({ queryKey: ['wallet'] });
  queryClient.invalidateQueries({ queryKey: ['wallet-statement'] });
};

// Simple status-advancing actions (repair id only)
const useRepairAction = (fn: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repairId: string) => {
      const { data, error } = await supabase.rpc(fn, { p_repair_id: repairId });
      if (error) throw error;
      return data as RepairRow;
    },
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useReceiveRepair = () => useRepairAction('receive_repair');
export const useReturnRepair = () => useRepairAction('return_repair');
export const useReceiveRepaired = () => useRepairAction('receive_repaired');
export const usePayRepair = () => useRepairAction('pay_repair');
export const useCancelRepair = () => useRepairAction('cancel_repair');

// Workshop prices the job (cost may be 0 for warranty/unrepairable)
export const useCompleteRepair = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { repairId: string; cost: number; notes: string }) => {
      const { data, error } = await supabase.rpc('complete_repair', {
        p_repair_id: input.repairId,
        p_cost: input.cost,
        p_notes: input.notes || null,
      });
      if (error) throw error;
      return data as RepairRow;
    },
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useCreateRepair = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      repairerBranchId: string;
      productId: string;
      quantity: number;
      imeis?: string[];
      fault: string;
    }) => {
      const { data, error } = await supabase.rpc('create_repair_order', {
        p_repairer_branch_id: input.repairerBranchId,
        p_product_id: input.productId,
        p_quantity: input.quantity,
        p_imeis: input.imeis ?? null,
        p_fault: input.fault,
      });
      if (error) throw error;
      return data as RepairRow;
    },
    onSuccess: () => invalidateAll(queryClient),
  });
};