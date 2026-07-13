import { useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import { useAuditLogs } from '../../hooks/useDashboard';
import type { AuditLogRow } from '../../hooks/useDashboard';

const TABLES = [
  { id: null, label: 'All Tables' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'products', label: 'Products' },
  { id: 'wallets', label: 'Wallets' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'deposits', label: 'Deposits' },
  { id: 'orders', label: 'Orders' },
  { id: 'order_items', label: 'Order Items' },
  { id: 'sales', label: 'Sales' },
  { id: 'sale_items', label: 'Sale Items' },
  { id: 'customers', label: 'Customers' },
];

const ACTION_STYLES: Record<string, string> = {
  INSERT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ==========================================
// SUMMARIES
// ==========================================
// Hide raw UUID references, timestamps, and actor columns — the
// record_label from the RPC already says WHAT the row is about, and the
// header already says WHO acted.
const isNoiseKey = (key: string) =>
  key === 'id' || key.endsWith('_id') || key.endsWith('_at') || key.endsWith('_by');

// Fields worth showing for INSERT/DELETE, in display priority order
const INTERESTING_KEYS = [
  'name', 'sku', 'full_name', 'receipt_number', 'order_number', 'reference',
  'status', 'type', 'role', 'quantity', 'unit_price', 'unit_cost', 'price',
  'cost_price', 'amount', 'subtotal', 'discount_amount', 'vat_amount',
  'total_amount', 'balance', 'balance_before', 'balance_after',
  'description', 'phone', 'email', 'imeis', 'location',
];

const displayValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 60 ? text.slice(0, 57) + '...' : text;
};

const summarize = (log: AuditLogRow): string[] => {
  const lines: string[] = [];

  // A salesperson can only touch inventory through the create_sale RPC,
  // so this context label is always truthful — it distinguishes automatic
  // POS deductions from a manager's manual stock adjustments.
  if (log.table_name === 'inventory' && log.user_role === 'salesperson') {
    lines.push('⚙ Automatic stock deduction from a POS sale');
  }

  if (log.action === 'UPDATE') {
    const oldData = log.old_data ?? {};
    const newData = log.new_data ?? {};
    let changeCount = 0;
    for (const key of Object.keys(newData)) {
      if (isNoiseKey(key)) continue;
      const before = JSON.stringify(oldData[key]);
      const after = JSON.stringify(newData[key]);
      if (before !== after) {
        lines.push(`${key}: ${displayValue(oldData[key])} → ${displayValue(newData[key])}`);
        changeCount++;
      }
      if (changeCount >= 4) break;
    }
    if (changeCount === 0) lines.push('Updated');
    return lines;
  }

  // INSERT shows the new record's details; DELETE shows what was removed
  const data = (log.action === 'INSERT' ? log.new_data : log.old_data) ?? {};
  let detailCount = 0;
  for (const key of INTERESTING_KEYS) {
    if (!(key in data) || data[key] === null || data[key] === undefined || data[key] === '') continue;
    lines.push(`${key}: ${displayValue(data[key])}`);
    detailCount++;
    if (detailCount >= 5) break;
  }
  if (detailCount === 0) {
    lines.push(log.action === 'INSERT' ? 'Record created' : 'Record deleted');
  }
  return lines;
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

export const AuditLogsView = () => {
  const [table, setTable] = useState<string | null>(null);
  const logs = useAuditLogs(table);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABLES.map((t) => (
          <button
            key={t.label}
            onClick={() => setTable(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              table === t.id
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-slate-900 dark:text-white">Audit Trail</h2>
          {logs.data && (
            <span className="text-sm text-slate-500">
              Latest {logs.data.length} event(s)
            </span>
          )}
        </div>

        {logs.isLoading && (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {logs.isError && (
          <p className="p-8 text-center text-sm text-red-600">{logs.error?.message}</p>
        )}

        {!logs.isLoading && !logs.isError && (logs.data ?? []).length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <ScrollText className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>No audit events for this filter.</p>
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {(logs.data ?? []).map((log) => (
            <div key={log.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ACTION_STYLES[log.action] ?? ''}`}>
                  {log.action}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                  {log.table_name.replace('_', ' ')}
                </span>
                {log.record_label && (
                  <span className="text-sm font-medium text-red-600 dark:text-red-400 truncate max-w-xs">
                    {log.record_label}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  by {log.user_name}
                  {log.user_role && <span className="capitalize"> ({log.user_role})</span>}
                  {' '}· {formatDateTime(log.created_at)}
                </span>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5">
                {summarize(log).map((line, i) => (
                  <p key={i} className="font-mono break-all">{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};