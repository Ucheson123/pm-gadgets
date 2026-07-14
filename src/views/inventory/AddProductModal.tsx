import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAddProduct, formatNaira } from '../../hooks/useInventory';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30';

export const AddProductModal = ({ isOpen, onClose }: AddProductModalProps) => {
  const { addToast } = useToast();
  const addProduct = useAddProduct();
  // Key to reset the uncontrolled fields after a successful submit
  const [formKey, setFormKey] = useState(0);
  // Prices are controlled so we can show the live margin warning
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const parsedCost = parseFloat(costPrice);
  const parsedSelling = parseFloat(sellingPrice);
  const costIsValid = !isNaN(parsedCost) && parsedCost >= 0;
  const sellingIsValid = !isNaN(parsedSelling) && parsedSelling >= 0;
  const sellingBelowCost = costIsValid && sellingIsValid && parsedSelling < parsedCost;

  const resetForm = () => {
    setFormKey((k) => k + 1);
    setCostPrice('');
    setSellingPrice('');
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const initialStock = parseInt((formData.get('initialStock') as string) || '0', 10);

    if (!costIsValid) {
      addToast('Buying price must be a valid non-negative number.', 'error');
      return;
    }
    if (!sellingIsValid) {
      addToast('Selling price must be a valid non-negative number.', 'error');
      return;
    }
    if (isNaN(initialStock) || initialStock < 0) {
      addToast('Initial stock must be zero or more.', 'error');
      return;
    }

    addProduct.mutate(
      {
        sku: formData.get('sku') as string,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) ?? '',
        price: parsedSelling,
        costPrice: parsedCost,
        initialStock,
      },
      {
        onSuccess: (product) => {
          addToast(`"${product.name}" added to catalog.`, 'success');
          resetForm();
          onClose();
        },
        onError: (error) => {
          // Duplicate SKU is the most common failure — make it readable
          const message = error.message.includes('duplicate key')
            ? 'A product with that SKU already exists.'
            : error.message;
          addToast(message, 'error');
        },
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Product">
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Product Name
          </label>
          <input
            type="text"
            name="name"
            required
            disabled={addProduct.isPending}
            className={inputClass}
            placeholder="iPhone 15 Pro Max 256GB"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            SKU
          </label>
          <input
            type="text"
            name="sku"
            required
            disabled={addProduct.isPending}
            className={inputClass}
            placeholder="IP15PM-256-BLK"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            name="description"
            rows={2}
            disabled={addProduct.isPending}
            className={inputClass}
            placeholder="Colour, storage, condition..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
              Buying Price (₦)
            </label>
            <input
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
              min="0"
              step="0.01"
              disabled={addProduct.isPending}
              className={inputClass}
              placeholder="1000000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
              Selling Price (₦)
            </label>
            <input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
              min="0"
              step="0.01"
              disabled={addProduct.isPending}
              className={inputClass}
              placeholder="1250000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Initial Stock
          </label>
          <input
            type="number"
            name="initialStock"
            min="0"
            step="1"
            defaultValue="0"
            disabled={addProduct.isPending}
            className={inputClass}
          />
        </div>

        {sellingBelowCost && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm transition-colors duration-200">
            <AlertTriangle size={18} className="shrink-0" />
            <span>
              Selling price ({formatNaira(parsedSelling)}) is below buying price (
              {formatNaira(parsedCost)}) — this product would sell at a loss.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={addProduct.isPending}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={addProduct.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-600/30"
          >
            {addProduct.isPending && <Loader2 size={16} className="animate-spin" />}
            Add Product
          </button>
        </div>
      </form>
    </Modal>
  );
};