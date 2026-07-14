import { useMemo, useState } from 'react';
import {
  Banknote, Building2, Loader2, Package, ReceiptText,
  TrendingDown, TrendingUp, Truck, Wallet as WalletIcon, AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { formatNaira, useBranchStock, LOW_STOCK_THRESHOLD } from '../../hooks/useInventory';
import { presetToRange } from '../../hooks/useWallet';
import type { RangePreset } from '../../hooks/useWallet';
import { useDashboardStats, useCompanyStats } from '../../hooks/useDashboard';

const PRESETS: { id: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
];

const compactNaira = (v: number) =>
  '₦' + Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

// KPI money: amounts of ₦1M+ display compact (₦10.26M) so they always fit
// on one line; smaller amounts keep full precision. The exact figure is
// always available via tooltip (title attribute on the card value).
const kpiMoney = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? '₦' + Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 2 }).format(v)
    : formatNaira(v);

const KpiCard = ({
  label, value, fullValue, icon: Icon, accent = 'text-slate-900 dark:text-white',
}: {
  label: string;
  value: string;
  fullValue?: string; // exact amount, shown as tooltip when value is compact
  icon: typeof Banknote;
  accent?: string;
}) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 min-w-0 transition-colors duration-200 hover:bg-red-50 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/20 group">
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-2 min-w-0 transition-colors group-hover:text-red-600 dark:group-hover:text-red-400">
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
    </div>
    <p
      title={fullValue ?? value}
      className={`text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap ${accent}`}
    >
      {value}
    </p>
  </div>
);

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0 transition-colors duration-200 hover:bg-red-50 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/20">
    <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">{title}</h3>
    <div className="h-56">{children}</div>
  </div>
);

const chartTooltip = {
  contentStyle: {
    background: 'rgb(15 23 42)', border: '1px solid rgb(51 65 85)',
    borderRadius: 12, color: 'white', fontSize: 12,
  },
};

// ==========================================
// MANAGER DASHBOARD
// ==========================================
const ManagerDashboard = () => {
  const [preset, setPreset] = useState<Exclude<RangePreset, 'custom'>>('last7');
  const [scope, setScope] = useState<'branch' | 'company'>('branch');
  const range = useMemo(() => presetToRange(preset), [preset]);
  const stats = useDashboardStats(range.start, range.end);
  const company = useCompanyStats(range.start, range.end);
  const s = stats.data;

  const shortDate = (d: string) =>
    new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });

  const combined = useMemo(() => {
    const rows = company.data ?? [];
    return {
      revenue: rows.reduce((a, b) => a + b.revenue, 0),
      expenses: rows.reduce((a, b) => a + b.expenses, 0),
      wallets: rows.reduce((a, b) => a + b.wallet_balance, 0),
      sales: rows.reduce((a, b) => a + b.sales_count, 0),
      inventory: rows.reduce((a, b) => a + b.inventory_value, 0),
    };
  }, [company.data]);

  return (
    <div className="space-y-6">
      {/* Scope + range filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1">
          {(['branch', 'company'] as const).map((sc) => (
            <button
              key={sc}
              onClick={() => setScope(sc)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                scope === sc
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400'
              }`}
            >
              <Building2 size={15} /> {sc === 'branch' ? 'My Branch' : 'Company'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p.id
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {(stats.isLoading || (scope === 'company' && company.isLoading)) && (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}

      {stats.isError && (
        <p className="p-8 text-center text-sm text-red-600">{stats.error?.message}</p>
      )}

      {/* ============ MY BRANCH ============ */}
      {scope === 'branch' && s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              label="Wallet Balance"
              value={kpiMoney(s.wallet_balance)}
              fullValue={formatNaira(s.wallet_balance)}
              icon={WalletIcon}
            />
            <KpiCard
              label="Total Revenue"
              value={kpiMoney(s.total_revenue)}
              fullValue={formatNaira(s.total_revenue)}
              icon={TrendingUp}
              accent="text-emerald-600"
            />
            <KpiCard
              label="Total Expenses (COGS)"
              value={kpiMoney(s.total_expenses)}
              fullValue={formatNaira(s.total_expenses)}
              icon={TrendingDown}
              accent="text-red-600"
            />
            <KpiCard
              label="Net Profit"
              value={kpiMoney(s.total_revenue - s.total_expenses)}
              fullValue={formatNaira(s.total_revenue - s.total_expenses)}
              icon={Banknote}
              accent={s.total_revenue - s.total_expenses >= 0 ? 'text-emerald-600' : 'text-red-600'}
            />
            <KpiCard label="Products Sold" value={String(s.products_sold)} icon={ReceiptText} />
            <KpiCard
              label="Pending / Completed Orders"
              value={`${s.pending_orders} / ${s.completed_orders}`}
              icon={Truck}
            />
            <KpiCard
              label="Inventory Value (at cost)"
              value={kpiMoney(s.inventory_value)}
              fullValue={formatNaira(s.inventory_value)}
              icon={Package}
            />
            <KpiCard
              label="Low Stock Products"
              value={String(s.low_stock_count)}
              icon={AlertTriangle}
              accent={s.low_stock_count > 0 ? 'text-orange-600' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Daily Sales">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.daily_sales}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis tickFormatter={compactNaira} fontSize={11} width={70} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(v) => formatNaira(Number(v))}
                    labelFormatter={(d) => shortDate(String(d))}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2.5} dot={false} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Monthly Revenue (last 6 months)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.monthly_revenue}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="month" fontSize={11} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis tickFormatter={compactNaira} fontSize={11} width={70} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <Tooltip {...chartTooltip} formatter={(v) => formatNaira(Number(v))} />
                  <Bar dataKey="revenue" fill="#dc2626" radius={[6, 6, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Wallet Activity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s.wallet_activity}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis tickFormatter={compactNaira} fontSize={11} width={70} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(v) => formatNaira(Number(v))}
                    labelFormatter={(d) => shortDate(String(d))}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="credits" stroke="#059669" fill="#05966922" strokeWidth={2} name="Credits" />
                  <Area type="monotone" dataKey="debits" stroke="#dc2626" fill="#dc262622" strokeWidth={2} name="Debits" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-w-0 transition-colors duration-200 hover:bg-red-50 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/20">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">
                Recent Transactions
              </h3>
              {s.recent_transactions.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No transactions yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {s.recent_transactions.map((tx) => (
                    <div key={tx.id} className="py-2.5 flex justify-between gap-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-300 truncate">
                        {tx.description}
                      </span>
                      <span
                        title={formatNaira(tx.amount)}
                        className={`font-semibold shrink-0 whitespace-nowrap ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {tx.type === 'credit' ? '+' : '−'}{kpiMoney(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ============ COMPANY (PRD §17) ============ */}
      {scope === 'company' && company.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <KpiCard
              label="Combined Revenue"
              value={kpiMoney(combined.revenue)}
              fullValue={formatNaira(combined.revenue)}
              icon={TrendingUp}
              accent="text-emerald-600"
            />
            <KpiCard
              label="Combined Expenses"
              value={kpiMoney(combined.expenses)}
              fullValue={formatNaira(combined.expenses)}
              icon={TrendingDown}
              accent="text-red-600"
            />
            <KpiCard
              label="Combined Wallets"
              value={kpiMoney(combined.wallets)}
              fullValue={formatNaira(combined.wallets)}
              icon={WalletIcon}
            />
            <KpiCard label="Combined Sales" value={String(combined.sales)} icon={ReceiptText} />
            <KpiCard
              label="Combined Inventory"
              value={kpiMoney(combined.inventory)}
              fullValue={formatNaira(combined.inventory)}
              icon={Package}
            />
          </div>

          <ChartCard title="Branch Comparison — Revenue vs Expenses">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={company.data}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" fontSize={11} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <YAxis tickFormatter={compactNaira} fontSize={11} width={70} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <Tooltip {...chartTooltip} formatter={(v) => formatNaira(Number(v))} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="revenue" fill="#059669" radius={[6, 6, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#dc2626" radius={[6, 6, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors duration-200 hover:bg-red-50 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/20">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Branch Breakdown</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {company.data.map((b) => (
                <div key={b.branch_id} className="p-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white">{b.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap" title={formatNaira(b.revenue)}>
                    Rev: <span className="text-emerald-600 font-medium">{kpiMoney(b.revenue)}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap" title={formatNaira(b.wallet_balance)}>
                    Wallet: <span className="text-slate-900 dark:text-white font-medium">{kpiMoney(b.wallet_balance)}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    Sales: <span className="text-slate-900 dark:text-white font-medium">{b.sales_count}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap" title={formatNaira(b.inventory_value)}>
                    Stock: <span className="text-slate-900 dark:text-white font-medium">{kpiMoney(b.inventory_value)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ==========================================
// SALESPERSON DASHBOARD (non-financial, PRD §3)
// ==========================================
const SalespersonDashboard = () => {
  const { user } = useAuth();
  const stock = useBranchStock();
  const rows = stock.data ?? [];
  const inStock = rows.filter((r) => r.quantity > 0).length;
  const lowStock = rows.filter((r) => r.quantity > 0 && r.quantity < LOW_STOCK_THRESHOLD).length;
  const outOfStock = rows.filter((r) => r.quantity === 0).length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-white relative overflow-hidden transition-colors duration-200 hover:bg-red-50 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/20">
        <div className="absolute top-0 right-0 w-40 h-40 bg-red-100 dark:bg-red-600/20 rounded-full blur-3xl transition-colors" />
        <div className="relative z-10">
          <h2 className="text-xl font-bold">Welcome back, {user?.full_name?.split(' ')[0]}!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">
            Ready to record sales for {user?.branch_name} branch.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Products In Stock" value={String(inStock)} icon={Package} />
        <KpiCard label="Low Stock" value={String(lowStock)} icon={AlertTriangle} accent={lowStock > 0 ? 'text-orange-600' : undefined} />
        <KpiCard label="Out of Stock" value={String(outOfStock)} icon={TrendingDown} accent={outOfStock > 0 ? 'text-red-600' : undefined} />
      </div>
    </div>
  );
};

export const DashboardView = () => {
  const { user } = useAuth();
  return user?.role === 'manager' ? <ManagerDashboard /> : <SalespersonDashboard />;
};