import { useMemo, useState } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ReceiptText,
} from 'lucide-react';
import {
  useWallet,
  useWalletStatement,
  presetToRange,
} from '../../hooks/useWallet';
import type { RangePreset } from '../../hooks/useWallet';
import { formatNaira } from '../../hooks/useInventory';
import { DepositModal } from './DepositModal';

const PRESETS: { id: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const toDateInputValue = (d: Date) => d.toISOString().slice(0, 10);

export const WalletView = () => {
  const wallet = useWallet();
  const [preset, setPreset] = useState<RangePreset>('last7');
  const [customStart, setCustomStart] = useState(toDateInputValue(new Date()));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));
  const [showDeposit, setShowDeposit] = useState(false);

  const range = useMemo(() => {
    if (preset === 'custom') {
      const start = new Date(customStart + 'T00:00:00');
      const end = new Date(customEnd + 'T23:59:59.999');
      return { start, end };
    }
    return presetToRange(preset);
  }, [preset, customStart, customEnd]);

  const statement = useWalletStatement(range.start, range.end);
  const stmt = statement.data;

  return (
    <div className="space-y-6">
      {/* Balance + period summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 dark:bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <WalletIcon size={16} /> Branch Wallet Balance
            </div>
            <p className="text-3xl font-black tracking-tight">
              {wallet.isLoading ? '···' : formatNaira(wallet.data?.balance ?? 0)}
            </p>
            <button
              onClick={() => setShowDeposit(true)}
              disabled={!wallet.data}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
            >
              <Plus size={16} /> Deposit Funds
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <ArrowDownLeft size={16} className="text-emerald-600" /> Credits (period)
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {stmt ? formatNaira(stmt.total_credits) : '···'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <ArrowUpRight size={16} className="text-red-600" /> Debits (period)
          </div>
          <p className="text-2xl font-bold text-red-600">
            {stmt ? formatNaira(stmt.total_debits) : '···'}
          </p>
        </div>
      </div>

      {/* Statement */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 dark:text-white">Account Statement</h2>
            {stmt && (
              <p className="text-sm text-slate-500">
                Opening:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatNaira(stmt.opening_balance)}
                </span>{' '}
                · Closing:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatNaira(stmt.closing_balance)}
                </span>
              </p>
            )}
          </div>

          {/* Range filters (PRD §11) */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  preset === p.id
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === 'custom'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Custom
            </button>
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Transactions list */}
        {statement.isLoading && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-5 animate-pulse flex justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {statement.isError && (
          <div className="p-12 text-center text-slate-500">
            <p className="font-medium text-red-600 dark:text-red-400 mb-1">
              Failed to load statement
            </p>
            <p className="text-sm">{statement.error?.message}</p>
          </div>
        )}

        {stmt && stmt.transactions.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <ReceiptText className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>No transactions in this period.</p>
          </div>
        )}

        {stmt && stmt.transactions.length > 0 && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {stmt.transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'credit'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                    }`}
                  >
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {tx.description}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDateTime(tx.created_at)} · Balance after:{' '}
                      {formatNaira(tx.balance_after)}
                    </p>
                  </div>
                </div>
                <p
                  className={`font-bold shrink-0 ${
                    tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {tx.type === 'credit' ? '+' : '−'}
                  {formatNaira(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {wallet.data && (
        <DepositModal
          isOpen={showDeposit}
          walletId={wallet.data.id}
          onClose={() => setShowDeposit(false)}
        />
      )}
    </div>
  );
};