import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Plus, Minus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAdjustStock } from '../../hooks/useInventory';
import type { StockRow } from '../../hooks/useInventory';

interface AdjustStockModalProps {
  product: StockRow | null; // null = closed
  onClose: () => void;
}

export const AdjustStockModal = ({ product, onClose }: AdjustStockModalProps) => {
  const { addToast } = useToast();
  const adjustStock = useAdjustStock();
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');

  const parsedAmount = parseInt(amount, 10);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const currentQty = product?.quantity ?? 0;
  const newQty = validAmount
    ? direction === 'add'
      ? currentQty + parsedAmount
      : currentQty - parsedAmount
    : currentQty;
  const wouldGoNegative = newQty < 0;

  const resetAndClose = () => {
    setDirection('add');
    setAmount('');
    onClose();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product || !validAmount || wouldGoNegative) return;

    adjustStock.mutate(
      {
        productId: product.id,
        quantityChange: direction === 'add' ? parsedAmount : -parsedAmount,
      },
      {
        onSuccess: () => {
          addToast(
            `Stock ${direction === 'add' ? 'added' : 'removed'}: ${product.name} is now at ${newQty} unit(s).`,
            'success'
          );
          resetAndClose();
        },
        // The RPC's errors (e.g. "Insufficient stock: only 3 unit(s)
        // available") are already human-readable — toast them directly.
        onError: (error) => addToast(error.message, 'error'),
      }
    );
  };

  const directionButton = (dir: 'add' | 'remove', label: string, Icon: typeof Plus) => (
    <button
      type="button"
      onClick={() => setDirection(dir)}
      disabled={adjustStock.isPending}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
        direction === dir
          ? dir === 'add'
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : 'bg-red-600 border-red-600 text-white'
          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <Modal
      isOpen={product !== null}
      onClose={resetAndClose}
      title={`Adjust Stock — ${product?.name ?? ''}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <span className="text-sm text-slate-500">Current stock</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {currentQty} unit(s)
          </span>
        </div>

        <div className="flex gap-3">
          {directionButton('add', 'Add Stock', Plus)}
          {directionButton('remove', 'Remove Stock', Minus)}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Quantity
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            step="1"
            required
            disabled={adjustStock.isPending}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50"
            placeholder="0"
          />
        </div>

        {validAmount && (
          <div
            className={`flex items-center justify-between p-4 rounded-xl text-sm font-medium ${
              wouldGoNegative
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            <span>{wouldGoNegative ? 'Not enough stock' : 'New stock level'}</span>
            <span className="font-bold">
              {wouldGoNegative ? `only ${currentQty} available` : `${newQty} unit(s)`}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={adjustStock.isPending}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={adjustStock.isPending || !validAmount || wouldGoNegative}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {adjustStock.isPending && <Loader2 size={16} className="animate-spin" />}
            Confirm Adjustment
          </button>
        </div>
      </form>
    </Modal>
  );
};