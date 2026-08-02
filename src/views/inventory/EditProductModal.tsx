import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, AlertTriangle, ScanBarcode, Lock } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useUpdateProduct, formatNaira, variantLabel } from '../../hooks/useInventory';
import type { StockRow } from '../../hooks/useInventory';

interface EditProductModalProps {
  product: StockRow | null; // null = closed
  onClose: () => void;
}

export const EditProductModal = ({ product, onClose }: EditProductModalProps) => {
  const { addToast } = useToast();
  const updateProduct = useUpdateProduct();

  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  useEffect(() => {
    if (product) {
      setCostPrice(String(product.cost_price));
      setSellingPrice(String(product.price));
    }
  }, [product]);

  const parsedCost = parseFloat(costPrice);
  const parsedSelling = parseFloat(sellingPrice);
  const costIsValid = !isNaN(parsedCost) && parsedCost >= 0;
  const sellingIsValid = !isNaN(parsedSelling) && parsedSelling >= 0;
  const sellingBelowCost = costIsValid && sellingIsValid && parsedSelling < parsedCost;
  const priceChanged = product && sellingIsValid && parsedSelling !== product.price;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;
    const formData = new FormData(e.currentTarget);

    if (!costIsValid) return addToast('Buying price must be a valid non-negative number.', 'error');
    if (!sellingIsValid) return addToast('Selling price must be a valid non-negative number.', 'error');

    updateProduct.mutate(
      {
        id: product.id,
        sku: formData.get('sku') as string,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) ?? '',
        price: parsedSelling,
        costPrice: parsedCost,
      },
      {
        onSuccess: (updated) => {
          addToast(`"${updated.name}" updated.`, 'success');
          onClose();
        },
        onError: (error) => {
          const message = error.message.includes('duplicate key')
            ? 'A product with that SKU already exists.'
            : error.message;
          addToast(message, 'error');
        },
      }
    );
  };

  const inputClass =
    'w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50';

  return (
    <Modal isOpen={product !== null} onClose={onClose} title={`Edit — ${product?.name ?? ''}`}>
      {product && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Locked characteristics */}
          {(product.track_imei || product.variant_attributes) && (
            <div className="flex flex-wrap gap-2">
              {product.track_imei && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <ScanBarcode size={13} /> IMEI-tracked
                  <Lock size={11} className="opacity-60" />
                </span>
              )}
              {product.variant_attributes && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Variant: {variantLabel(product.variant_attributes)}
                </span>
              )}
              {product.track_imei && (
                <p className="w-full text-[11px] text-slate-500">
                  IMEI tracking cannot be changed after creation — it defines how this product's
                  stock is counted.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Product Name</label>
            <input type="text" name="name" defaultValue={product.name} required disabled={updateProduct.isPending} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SKU</label>
            <input type="text" name="sku" defaultValue={product.sku} required disabled={updateProduct.isPending} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea name="description" rows={2} defaultValue={product.description ?? ''} disabled={updateProduct.isPending} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Buying Price (₦)</label>
              <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required min="0" step="0.01" disabled={updateProduct.isPending} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Selling Price (₦)</label>
              <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required min="0" step="0.01" disabled={updateProduct.isPending} className={inputClass} />
            </div>
          </div>

          {priceChanged && !sellingBelowCost && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm">
              Selling price will change from <b>{formatNaira(product.price)}</b> to{' '}
              <b>{formatNaira(parsedSelling)}</b>. This change is recorded in the audit trail.
            </div>
          )}
          {sellingBelowCost && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>
                Selling price ({formatNaira(parsedSelling)}) is below buying price (
                {formatNaira(parsedCost)}) — this product would sell at a loss.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={updateProduct.isPending}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={updateProduct.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-colors">
              {updateProduct.isPending && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};