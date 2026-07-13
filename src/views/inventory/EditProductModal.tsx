import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useUpdateProduct, formatNaira } from '../../hooks/useInventory';
import type { StockRow } from '../../hooks/useInventory';

interface EditProductModalProps {
  product: StockRow | null; // null = closed
  onClose: () => void;
}

const inputClass =
  'w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50';

export const EditProductModal = ({ product, onClose }: EditProductModalProps) => {
  const { addToast } = useToast();
  const updateProduct = useUpdateProduct();

  // Controlled fields so we can pre-fill and show live price notices
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');

  // Re-seed the form every time a (different) product is opened
  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setDescription(product.description ?? '');
      setPrice(String(product.price));
      setCostPrice(String(product.cost_price));
    }
  }, [product]);

  const parsedPrice = parseFloat(price);
  const parsedCost = parseFloat(costPrice);
  const priceIsValid = !isNaN(parsedPrice) && parsedPrice >= 0;
  const costIsValid = !isNaN(parsedCost) && parsedCost >= 0;
  const priceChanged = product !== null && priceIsValid && parsedPrice !== product.price;
  const sellingBelowCost = priceIsValid && costIsValid && parsedPrice < parsedCost;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;

    if (!costIsValid) {
      addToast('Buying price must be a valid non-negative number.', 'error');
      return;
    }
    if (!priceIsValid) {
      addToast('Selling price must be a valid non-negative number.', 'error');
      return;
    }

    updateProduct.mutate(
      {
        id: product.id,
        sku,
        name,
        description,
        price: parsedPrice,
        costPrice: parsedCost,
      },
      {
        onSuccess: (updated) => {
          addToast(`"${updated.name}" updated successfully.`, 'success');
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

  return (
    <Modal
      isOpen={product !== null}
      onClose={onClose}
      title={`Edit Product — ${product?.name ?? ''}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Product Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={updateProduct.isPending}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            SKU
          </label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
            disabled={updateProduct.isPending}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={updateProduct.isPending}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Buying Price (₦)
            </label>
            <input
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
              min="0"
              step="0.01"
              disabled={updateProduct.isPending}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Selling Price (₦)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min="0"
              step="0.01"
              disabled={updateProduct.isPending}
              className={inputClass}
            />
          </div>
        </div>

        {/* Selling-price-change notice: make repricing a conscious act, and
            remind the manager it's audited */}
        {priceChanged && product && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm">
            {parsedPrice > product.price ? (
              <TrendingUp size={18} className="shrink-0" />
            ) : (
              <TrendingDown size={18} className="shrink-0" />
            )}
            <span>
              Selling price change: <strong>{formatNaira(product.price)}</strong> →{' '}
              <strong>{formatNaira(parsedPrice)}</strong>. This change is recorded in the
              audit trail.
            </span>
          </div>
        )}

        {sellingBelowCost && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm">
            <AlertTriangle size={18} className="shrink-0" />
            <span>
              Selling price ({formatNaira(parsedPrice)}) is below buying price (
              {formatNaira(parsedCost)}) — this product would sell at a loss.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateProduct.isPending}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateProduct.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {updateProduct.isPending && <Loader2 size={16} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
};