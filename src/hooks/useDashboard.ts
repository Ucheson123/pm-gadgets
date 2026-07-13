import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ==========================================
// TYPES (mirroring the RPC JSON shapes)
// ==========================================
export interface DailyPoint { date: string; revenue: number }
export interface MonthlyPoint { month: string; revenue: number }
export interface WalletPoint { date: string; credits: number; debits: number }
export interface RecentTx {
  id: string; type: 'credit' | 'debit'; amount: number;
  description: string; created_at: string;
}

export interface DashboardStats {
  wallet_balance: number;
  total_revenue: number;
  total_expenses: number;
  sales_count: number;
  products_sold: number;
  pending_orders: number;
  completed_orders: number;
  inventory_value: number;
  low_stock_count: number;
  daily_sales: DailyPoint[];
  monthly_revenue: MonthlyPoint[];
  wallet_activity: WalletPoint[];
  recent_transactions: RecentTx[];
}

export interface BranchStat {
  branch_id: string;
  name: string;
  revenue: number;
  expenses: number;
  sales_count: number;
  orders_count: number;
  wallet_balance: number;
  inventory_value: number;
}

// ==========================================
// QUERIES
// ==========================================
export const useDashboardStats = (start: Date, end: Date) =>
  useQuery({
    queryKey: ['dashboard-stats', start.toISOString(), end.toISOString()],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      });
      if (error) throw error;
      return data as DashboardStats;
    },
  });

export const useCompanyStats = (start: Date, end: Date) =>
  useQuery({
    queryKey: ['company-stats', start.toISOString(), end.toISOString()],
    queryFn: async (): Promise<BranchStat[]> => {
      const { data, error } = await supabase.rpc('get_company_stats', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      });
      if (error) throw error;
      return (data?.branches ?? []) as BranchStat[];
    },
  });

// ==========================================
// AUDIT LOGS
// ==========================================
export interface AuditLogRow {
  id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user_name: string;
  record_label: string;
  user_role: string | null;
}

export const useAuditLogs = (table: string | null) =>
  useQuery({
    queryKey: ['audit-logs', table],
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await supabase.rpc('get_audit_logs', {
        p_table: table,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as AuditLogRow[];
    },
  });