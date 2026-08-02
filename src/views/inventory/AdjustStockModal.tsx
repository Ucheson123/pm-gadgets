import { useMemo, useState } from 'react';
import { Loader2, PackagePlus, PackageMinus, ScanBarcode } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useAdjustStock, useUnitsInStock, parseImeiText,
} from '../../hooks/useInventory';
import type { StockRow } from '../../hooks/useInventory';

interface AdjustStockModalProps {
  product: StockRow | null; // null = closed
  onClose: () => void;
}

export const AdjustStockModal = ({ product, onClose }: AdjustStockModalProps) => {
  const { addToast } = useToast();
  const adjustStock = useAdjustStock();

  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amountText, setAmountText] = useState('1');
  const [imeiText, setImeiText] = useState('');            // tracked + add
  const [selectedImeis, setSelectedImeis] = useState<string[]>([]); // tracked + remove

  const tracked = product?.track_imei ?? false;
  const units = useUnitsInStock(tracked && direction === 'remove' ? product?.id ?? null : null);

  const addImeis = useMemo(() => parseImeiText(imeiText), [imeiText]);

  // For tracked products the quantity is DERIVED from the IMEIs —
  // one IMEI, one physical unit, no ambiguity.
  const amount = tracked
    ? (direction === 'add' ? addImeis.length : selectedImeis.length)
    : parseInt(amountText, 10);

  const currentQty = product?.quantity ?? 0;
  const amountIsValid = !isNaN(amount) && amount > 0;
  const newQty = direction === 'add' ? currentQty + (amount || 0) : currentQty - (amount || 0);
  const wouldGoNegative = amountIsValid && newQty < 0;
  const canSubmit = amountIsValid && !wouldGoNegative;

  const reset = () => {
    setDirection('add');
    setAmountText('1');
    setImeiText('');
    setSelectedImeis([]);
  };
  const closeAndReset = () => { reset(); onClose(); };

  const toggleImei = (imei: string) =>
    setSelectedImeis((prev) =>
      prev.includes(imei) ? prev.filter((x) => x !== imei) : [...prev, imei]
    );

  const handleSubmit = () => {
    if (!product || !canSubmit) return;
    adjustStock.mutate(
      {
        productId: product.id,
        quantityChange: direction === 'add' ? amount : -amount,
        ...(tracked
          ? { imeis: direction === 'add' ? addImeis : selectedImeis }
          : {}),
      },
      {
        onSuccess: (row) => {
          addToast(
            `Stock ${direction === 'add' ? 'added' : 'removed'} — "${product.name}" now has ${row.quantity} unit(s).`,
            'success'
          );
          closeAndReset();
        },
        onError: (error) => addToast(error.message, 'error'),
      }
    );
  };

  const inputClass =
    'w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50';

  return (
    <Modal isOpen={product !== null} onClose={closeAndReset} title={`Adjust Stock — ${product?.name ?? ''}`}>
      {product && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm">
            <span className="text-slate-500">Current stock</span>
            <span className="font-bold text-slate-900 dark:text-white">{currentQty} unit(s)</span>
          </div>

          {tracked && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ScanBarcode size={14} className="text-red-600" />
              IMEI-tracked product — quantity follows the IMEIs you provide.
            </div>
          )}

          {/* Direction */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            {([
              { id: 'add', label: 'Add Stock', icon: PackagePlus },
              { id: 'remove', label: 'Remove Stock', icon: PackageMinus },
            ] as const).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { setDirection(d.id); setSelectedImeis([]); setImeiText(''); }}
                disabled={adjustStock.isPending}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  direction === d.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                <d.icon size={15} /> {d.label}
              </button>
            ))}
          </div>

          {/* Quantity input — untracked products only */}
          {!tracked && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Quantity to {direction}
              </label>
              <input
                type="number"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                min="1"
                step="1"
                disabled={adjustStock.isPending}
                className={inputClass}
              />
            </div>
          )}

          {/* Tracked + ADD: register new devices by IMEI */}
          {tracked && direction === 'add' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                IMEIs of the new units — one per line ({addImeis.length} entered)
              </label>
              <textarea
                value={imeiText}
                onChange={(e) => setImeiText(e.target.value)}
                rows={4}
                disabled={adjustStock.isPending}
                className={`${inputClass} font-mono text-sm`}
                placeholder={'356789104563217\n356789104563218'}
              />
            </div>
          )}

          {/* Tracked + REMOVE: pick the SPECIFIC devices leaving stock */}
          {tracked && direction === 'remove' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Select the unit(s) to remove ({selectedImeis.length} selected)
              </label>
              {units.isLoading && (
                <div className="p-4 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              )}
              {!units.isLoading && (units.data ?? []).length === 0 && (
                <p className="text-sm text-slate-500 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  No in-stock units registered for this product at your branch.
                </p>
              )}
              {(units.data ?? []).length > 0 && (
                <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {(units.data ?? []).map((u) => (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={selectedImeis.includes(u.imei)}
                        onChange={() => toggleImei(u.imei)}
                        disabled={adjustStock.isPending}
                        className="rounded accent-red-600"
                      />
                      <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{u.imei}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-1.5">
                For damage, loss, or corrections. Removed IMEIs stay in the permanent record as "removed".
              </p>
            </div>
          )}

          {/* Live preview */}
          <div className={`flex items-center justify-between p-3 rounded-xl text-sm ${
            wouldGoNegative
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : 'bg-slate-50 dark:bg-slate-800/50'
          }`}>
            <span className={wouldGoNegative ? '' : 'text-slate-500'}>
              {wouldGoNegative ? `Cannot remove ${amount} — only ${currentQty} available` : 'New stock level'}
            </span>
            {!wouldGoNegative && (
              <span className="font-bold text-slate-900 dark:text-white">
                {amountIsValid ? newQty : '—'} unit(s)
              </span>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={closeAndReset} disabled={adjustStock.isPending}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={adjustStock.isPending || !canSubmit}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors">
              {adjustStock.isPending && <Loader2 size={16} className="animate-spin" />}
              Confirm {direction === 'add' ? 'Addition' : 'Removal'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};