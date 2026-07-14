import { useState, useMemo } from 'react';
import { Loader2, Minus, Plus, Search, Store } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { formatNaira } from '../../hooks/useInventory';
import { useBranches, useCreateOrder, useRemoteBranchStock } from '../../hooks/useOrders';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrderModal = ({ isOpen, onClose }: CreateOrderModalProps) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const branches = useBranches();
  const createOrder = useCreateOrder();

  const [sellerBranchId, setSellerBranchId] = useState<string>('');
  const [search, setSearch] = useState('');
  // product_id -> ordered quantity
  const [cart, setCart] = useState<Record<string, number>>({});

  const stock = useRemoteBranchStock(sellerBranchId || null);

  const otherBranches = (branches.data ?? []).filter((b) => b.id !== user?.branch_id);

  const filteredStock = useMemo(() => {
    const rows = stock.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term)
    );
  }, [stock.data, search]);

  const setQty = (productId: string, qty: number, max: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const clamped = Math.max(0, Math.min(qty, max));
      if (clamped === 0) delete next[productId];
      else next[productId] = clamped;
      return next;
    });
  };

  const total = useMemo(() => {
    const rows = stock.data ?? [];
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const row = rows.find((r) => r.product_id === id);
      return sum + (row ? row.price * qty : 0);
    }, 0);
  }, [cart, stock.data]);

  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const resetAndClose = () => {
    setSellerBranchId('');
    setSearch('');
    setCart({});
    onClose();
  };

  const handleSubmit = () => {
    if (!sellerBranchId || itemCount === 0) return;
    createOrder.mutate(
      {
        sellerBranchId,
        items: Object.entries(cart).map(([product_id, quantity]) => ({
          product_id,
          quantity,
        })),
      },
      {
        onSuccess: (order) => {
          addToast(
            `Order ${order.order_number} created — total ${formatNaira(order.total_amount)}. It is now awaiting payment.`,
            'success'
          );
          resetAndClose();
        },
        onError: (error) => addToast(error.message, 'error'),
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Order From Another Branch">
      <div className="space-y-4">
        {/* Step 1: seller branch */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Order from
          </label>
          <div className="relative">
            <Store className="absolute left-3 top-3 text-slate-400 dark:text-slate-500 transition-colors" size={18} />
            <select
              value={sellerBranchId}
              onChange={(e) => {
                setSellerBranchId(e.target.value);
                setCart({});
              }}
              disabled={createOrder.isPending}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 appearance-none disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
            >
              <option value="">Select a branch...</option>
              {otherBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: products with live availability */}
        {sellerBranchId && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400 dark:text-slate-500 transition-colors" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm text-slate-900 dark:text-white transition-all duration-200 hover:border-red-100 dark:hover:border-red-500/30"
                placeholder="Search their stock..."
              />
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 transition-colors duration-200">
              {stock.isLoading && (
                <div className="p-6 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              )}
              {!stock.isLoading && filteredStock.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                  No sellable stock found at this branch.
                </p>
              )}
              {filteredStock.map((row) => {
                const qty = cart[row.product_id] ?? 0;
                return (
                  <div key={row.product_id} className="p-3 flex items-center justify-between gap-3 hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-colors duration-200">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate transition-colors">
                        {row.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                        {formatNaira(row.price)} · {row.quantity} available
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(row.product_id, qty - 1, row.quantity)}
                        disabled={qty === 0 || createOrder.isPending}
                        className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 disabled:opacity-40 transition-colors duration-200"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-slate-900 dark:text-white transition-colors">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(row.product_id, qty + 1, row.quantity)}
                        disabled={qty >= row.quantity || createOrder.isPending}
                        className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 disabled:opacity-40 transition-colors duration-200"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl transition-colors duration-200">
              <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
                {itemCount} item(s) selected
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white transition-colors">
                {formatNaira(total)}
              </span>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={createOrder.isPending}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createOrder.isPending || !sellerBranchId || itemCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-600/30"
          >
            {createOrder.isPending && <Loader2 size={16} className="animate-spin" />}
            Submit Order
          </button>
        </div>
      </div>
    </Modal>
  );
};