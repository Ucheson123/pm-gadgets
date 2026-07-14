import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePlus, Loader2, ReceiptText, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatNaira } from '../../hooks/useInventory';
import { useSales } from '../../hooks/useSales';
import { ReceiptModal } from './ReceiptModal';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const SalesHistoryView = () => {
  const { user } = useAuth();
  const sales = useSales();
  const [search, setSearch] = useState('');
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  // PRD §18 search: receipt number, customer, product, IMEI
  const filtered = useMemo(() => {
    const rows = sales.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((s) => {
      if (s.receipt_number.toLowerCase().includes(term)) return true;
      if (s.customer?.full_name.toLowerCase().includes(term)) return true;
      return s.sale_items.some(
        (item) =>
          item.product?.name.toLowerCase().includes(term) ||
          (item.imeis ?? []).some((imei) => imei.toLowerCase().includes(term))
      );
    });
  }, [sales.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400 dark:text-slate-500 transition-colors" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 hover:border-red-100 dark:hover:border-red-500/30"
            placeholder="Search by receipt number, customer, product, or IMEI..."
          />
        </div>
        {user?.role === 'salesperson' && (
          <Link
            to="/pos"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-600/20 transition-all duration-200 active:scale-[0.98]"
          >
            <BadgePlus size={18} /> New Sale
          </Link>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-200">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors duration-200">
          <h2 className="font-bold text-slate-900 dark:text-white transition-colors">Sales History</h2>
          {sales.data && (
            <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
              {filtered.length} of {sales.data.length} sale(s)
            </span>
          )}
        </div>

        {sales.isLoading && (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {sales.isError && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
            <p className="font-medium text-red-600 dark:text-red-400 mb-1">Failed to load sales</p>
            <p className="text-sm">{sales.error?.message}</p>
          </div>
        )}

        {!sales.isLoading && !sales.isError && filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
            <ReceiptText className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700 transition-colors" />
            <p>
              {sales.data && sales.data.length > 0
                ? `No sales match "${search}".`
                : 'No sales recorded yet.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors duration-200">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setReceiptSaleId(s.id)}
              className="w-full p-5 flex items-center justify-between gap-3 text-left hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-all duration-200 group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white transition-colors duration-200">
                    {s.receipt_number}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors duration-200">
                    · {s.customer?.full_name ?? 'Customer'}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 transition-colors duration-200">
                  {formatDate(s.created_at)} · {s.sale_items.length} item(s) · by{' '}
                  {s.salesperson?.full_name ?? '—'}
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white shrink-0 transition-colors duration-200 group-hover:text-red-600 dark:group-hover:text-red-400">
                {formatNaira(s.total_amount)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ReceiptModal saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />
    </div>
  );
};