import { useMemo, useState } from 'react';
import { Loader2, ScanBarcode, Store, Wrench } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import {
  useBranchStock, useUnitsInStock, formatNaira,
} from '../../hooks/useInventory';
import { useBranches } from '../../hooks/useOrders';
import { useCreateRepair } from '../../hooks/useRepairs';

interface CreateRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRepairModal = ({ isOpen, onClose }: CreateRepairModalProps) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const branches = useBranches();
  const stock = useBranchStock();
  const createRepair = useCreateRepair();

  const [repairerBranchId, setRepairerBranchId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [selectedImeis, setSelectedImeis] = useState<string[]>([]);
  const [fault, setFault] = useState('');

  const otherBranches = (branches.data ?? []).filter((b) => b.id !== user?.branch_id);
  const sendable = useMemo(
    () => (stock.data ?? []).filter((r) => r.quantity > 0),
    [stock.data]
  );
  const product = sendable.find((r) => r.id === productId) ?? null;
  const tracked = product?.track_imei ?? false;
  const units = useUnitsInStock(tracked ? productId : null);

  // Tracked products: the selected IMEIs ARE the quantity
  const quantity = tracked ? selectedImeis.length : parseInt(quantityText, 10);
  const quantityValid =
    !isNaN(quantity) && quantity > 0 && (product ? quantity <= product.quantity : false);

  const toggleImei = (imei: string) =>
    setSelectedImeis((prev) =>
      prev.includes(imei) ? prev.filter((x) => x !== imei) : [...prev, imei]
    );

  const resetAndClose = () => {
    setRepairerBranchId('');
    setProductId('');
    setQuantityText('1');
    setSelectedImeis([]);
    setFault('');
    onClose();
  };

  const handleSubmit = () => {
    if (!repairerBranchId) return addToast('Choose the branch that will repair the item.', 'error');
    if (!product) return addToast('Choose the faulty product.', 'error');
    if (!quantityValid) return addToast('Quantity is invalid or exceeds your stock.', 'error');
    if (!fault.trim()) return addToast('Describe the fault so the workshop knows what to fix.', 'error');

    createRepair.mutate(
      {
        repairerBranchId,
        productId: product.id,
        quantity,
        ...(tracked ? { imeis: selectedImeis } : {}),
        fault: fault.trim(),
      },
      {
        onSuccess: (repair) => {
          addToast(
            `${repair.repair_number} created — ${quantity} unit(s) dispatched for repair. Your stock was reduced until they return.`,
            'success'
          );
          resetAndClose();
        },
        onError: (error) => addToast(error.message, 'error'),
      }
    );
  };

  const inputClass =
    'w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50';

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Send Item for Repair">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Repairing branch
          </label>
          <div className="relative">
            <Store className="absolute left-3 top-3 text-slate-400" size={18} />
            <select
              value={repairerBranchId}
              onChange={(e) => setRepairerBranchId(e.target.value)}
              disabled={createRepair.isPending}
              className={`${inputClass} pl-10 appearance-none`}
            >
              <option value="">Select a branch...</option>
              {otherBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Faulty product
          </label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setSelectedImeis([]);
              setQuantityText('1');
            }}
            disabled={createRepair.isPending}
            className={`${inputClass} appearance-none`}
          >
            <option value="">Select from your stock...</option>
            {sendable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.quantity} in stock)
              </option>
            ))}
          </select>
        </div>

        {product && !tracked && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Quantity to send (max {product.quantity})
            </label>
            <input
              type="number"
              value={quantityText}
              onChange={(e) => setQuantityText(e.target.value)}
              min="1"
              max={product.quantity}
              step="1"
              disabled={createRepair.isPending}
              className={inputClass}
            />
          </div>
        )}

        {product && tracked && (
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <ScanBarcode size={15} className="text-red-600" />
              Select the faulty unit(s) ({selectedImeis.length} selected)
            </label>
            {units.isLoading && (
              <div className="p-3 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
            {!units.isLoading && (units.data ?? []).length === 0 && (
              <p className="text-sm text-slate-500 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                No in-stock units registered for this product.
              </p>
            )}
            {(units.data ?? []).length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {(units.data ?? []).map((u) => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input
                      type="checkbox"
                      checked={selectedImeis.includes(u.imei)}
                      onChange={() => toggleImei(u.imei)}
                      disabled={createRepair.isPending}
                      className="rounded accent-red-600"
                    />
                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{u.imei}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Fault description
          </label>
          <textarea
            value={fault}
            onChange={(e) => setFault(e.target.value)}
            rows={3}
            disabled={createRepair.isPending}
            className={inputClass}
            placeholder="e.g. Screen cracked, does not power on, battery drains in minutes..."
          />
        </div>

        {product && quantityValid && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-600 dark:text-slate-300">
            <Wrench size={16} className="text-slate-400 shrink-0" />
            <span>
              {quantity} × {product.name} ({formatNaira(product.price)} each) will leave your
              sellable stock until repaired and returned. The repair cost is set by the
              workshop after assessment.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={createRepair.isPending}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createRepair.isPending || !repairerBranchId || !product || !quantityValid || !fault.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {createRepair.isPending && <Loader2 size={16} className="animate-spin" />}
            Dispatch for Repair
          </button>
        </div>
      </div>
    </Modal>
  );
};