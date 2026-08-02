import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, AlertTriangle, Layers, Box, Trash2, Plus, ScanBarcode } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useAddProduct, useAddVariantProduct, formatNaira, parseImeiText,
} from '../../hooks/useInventory';
import type { VariantDef } from '../../hooks/useInventory';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50';
const smallInput =
  'w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm text-slate-900 dark:text-white transition-all disabled:opacity-50';

interface AttributeRow {
  name: string;
  values: string; // comma-separated
}

interface ComboState {
  key: string;
  attributes: Record<string, string>;
  include: boolean;
  sku: string;
  cost: string;
  price: string;
}

// Cartesian product of attribute values → all variant combinations
const buildCombos = (attrs: AttributeRow[], baseSku: string): ComboState[] => {
  const clean = attrs
    .map((a) => ({
      name: a.name.trim(),
      values: a.values.split(',').map((v) => v.trim()).filter(Boolean),
    }))
    .filter((a) => a.name && a.values.length > 0);
  if (clean.length === 0) return [];

  let combos: Record<string, string>[] = [{}];
  for (const attr of clean) {
    combos = combos.flatMap((c) => attr.values.map((v) => ({ ...c, [attr.name]: v })));
  }
  if (combos.length > 30) return []; // guard against attribute explosions

  return combos.map((attributes) => {
    const suffix = Object.values(attributes)
      .map((v) => v.replace(/\s+/g, '').toUpperCase().slice(0, 6))
      .join('-');
    return {
      key: JSON.stringify(attributes),
      attributes,
      include: true,
      sku: baseSku ? `${baseSku.trim()}-${suffix}` : suffix,
      cost: '',
      price: '',
    };
  });
};

export const AddProductModal = ({ isOpen, onClose }: AddProductModalProps) => {
  const { addToast } = useToast();
  const addProduct = useAddProduct();
  const addVariantProduct = useAddVariantProduct();
  const busy = addProduct.isPending || addVariantProduct.isPending;

  const [mode, setMode] = useState<'standard' | 'variants'>('standard');
  const [trackImei, setTrackImei] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Standard-mode controlled fields
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [imeiText, setImeiText] = useState('');

  // Variant-mode fields
  const [parentName, setParentName] = useState('');
  const [parentDesc, setParentDesc] = useState('');
  const [baseSku, setBaseSku] = useState('');
  const [attrs, setAttrs] = useState<AttributeRow[]>([{ name: 'Color', values: '' }]);
  const [combos, setCombos] = useState<ComboState[]>([]);

  const parsedCost = parseFloat(costPrice);
  const parsedSelling = parseFloat(sellingPrice);
  const parsedStock = parseInt(initialStock || '0', 10);
  const costIsValid = !isNaN(parsedCost) && parsedCost >= 0;
  const sellingIsValid = !isNaN(parsedSelling) && parsedSelling >= 0;
  const sellingBelowCost = costIsValid && sellingIsValid && parsedSelling < parsedCost;
  const imeis = useMemo(() => parseImeiText(imeiText), [imeiText]);
  const needsImeis = trackImei && parsedStock > 0;
  const imeiCountOk = !needsImeis || imeis.length === parsedStock;

  const resetAll = () => {
    setFormKey((k) => k + 1);
    setMode('standard');
    setTrackImei(false);
    setCostPrice(''); setSellingPrice(''); setInitialStock('0'); setImeiText('');
    setParentName(''); setParentDesc(''); setBaseSku('');
    setAttrs([{ name: 'Color', values: '' }]);
    setCombos([]);
  };

  const closeAndReset = () => { resetAll(); onClose(); };

  // ---------- STANDARD SUBMIT ----------
  const handleStandardSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!costIsValid) return addToast('Buying price must be a valid non-negative number.', 'error');
    if (!sellingIsValid) return addToast('Selling price must be a valid non-negative number.', 'error');
    if (isNaN(parsedStock) || parsedStock < 0) return addToast('Initial stock must be zero or more.', 'error');
    if (needsImeis && !imeiCountOk) {
      return addToast(`This product is IMEI-tracked: enter exactly ${parsedStock} unique IMEI(s) — you entered ${imeis.length}.`, 'error');
    }

    addProduct.mutate(
      {
        sku: formData.get('sku') as string,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) ?? '',
        price: parsedSelling,
        costPrice: parsedCost,
        initialStock: parsedStock,
        trackImei,
        ...(needsImeis ? { imeis } : {}),
      },
      {
        onSuccess: (product) => {
          addToast(`"${product.name}" added to catalog.`, 'success');
          closeAndReset();
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

  // ---------- VARIANTS SUBMIT ----------
  const generateCombos = () => {
    const built = buildCombos(attrs, baseSku);
    if (built.length === 0) {
      addToast('Add at least one attribute with values (max 30 combinations).', 'error');
      return;
    }
    setCombos(built);
  };

  const updateCombo = (key: string, patch: Partial<ComboState>) =>
    setCombos((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const handleVariantsSubmit = () => {
    if (!parentName.trim()) return addToast('Enter the product (parent) name.', 'error');
    const included = combos.filter((c) => c.include);
    if (included.length === 0) return addToast('Include at least one variant.', 'error');

    const variants: VariantDef[] = [];
    const skus = new Set<string>();
    for (const c of included) {
      const cost = parseFloat(c.cost);
      const price = parseFloat(c.price);
      const label = Object.values(c.attributes).join(' / ');
      if (!c.sku.trim()) return addToast(`Variant "${label}": SKU is required.`, 'error');
      if (skus.has(c.sku.trim())) return addToast(`Duplicate SKU "${c.sku}" between variants.`, 'error');
      skus.add(c.sku.trim());
      if (isNaN(cost) || cost < 0) return addToast(`Variant "${label}": buying price is invalid.`, 'error');
      if (isNaN(price) || price < 0) return addToast(`Variant "${label}": selling price is invalid.`, 'error');
      variants.push({
        sku: c.sku,
        name: `${parentName.trim()} — ${label}`,
        attributes: c.attributes,
        price,
        costPrice: cost,
      });
    }

    addVariantProduct.mutate(
      { parentName, description: parentDesc, trackImei, variants },
      {
        onSuccess: () => {
          addToast(
            `"${parentName}" created with ${variants.length} variant(s). Stock each variant via its Adjust button${trackImei ? ' (IMEIs will be required)' : ''}.`,
            'success'
          );
          closeAndReset();
        },
        onError: (error) => {
          const message = error.message.includes('duplicate key')
            ? 'One of the SKUs already exists in the catalog.'
            : error.message;
          addToast(message, 'error');
        },
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={closeAndReset} title="Add New Product">
      <div key={formKey} className="space-y-4">
        {/* Mode toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {([
            { id: 'standard', label: 'Standard Item', icon: Box },
            { id: 'variants', label: 'Product with Variants', icon: Layers },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              disabled={busy}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === m.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <m.icon size={15} /> {m.label}
            </button>
          ))}
        </div>

        {/* IMEI tracking — applies to the product and all its variants */}
        <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={trackImei}
            onChange={(e) => setTrackImei(e.target.checked)}
            disabled={busy}
            className="mt-0.5 rounded accent-red-600"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5 font-semibold">
              <ScanBarcode size={15} /> Track by IMEI (serialized)
            </span>
            <span className="text-xs text-slate-500">
              For phones and devices: every unit's IMEI is registered on arrival, picked at the
              point of sale, and traceable forever. Cannot be changed after creation.
            </span>
          </span>
        </label>

        {/* ================= STANDARD MODE ================= */}
        {mode === 'standard' && (
          <form onSubmit={handleStandardSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Product Name</label>
              <input type="text" name="name" required disabled={busy} className={inputClass} placeholder="iPhone 15 Pro Max 256GB" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SKU</label>
              <input type="text" name="sku" required disabled={busy} className={inputClass} placeholder="IP15PM-256-BLK" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea name="description" rows={2} disabled={busy} className={inputClass} placeholder="Colour, storage, condition..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Buying Price (₦)</label>
                <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required min="0" step="0.01" disabled={busy} className={inputClass} placeholder="1000000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Selling Price (₦)</label>
                <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required min="0" step="0.01" disabled={busy} className={inputClass} placeholder="1250000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Initial Stock</label>
              <input type="number" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} min="0" step="1" disabled={busy} className={inputClass} />
            </div>

            {needsImeis && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  IMEIs — one per line ({imeis.length} / {parsedStock})
                </label>
                <textarea
                  value={imeiText}
                  onChange={(e) => setImeiText(e.target.value)}
                  rows={Math.min(Math.max(parsedStock, 2), 6)}
                  disabled={busy}
                  className={`${inputClass} font-mono text-sm ${!imeiCountOk ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder={'356789104563217\n356789104563218'}
                />
                {!imeiCountOk && (
                  <p className="text-xs text-red-600 mt-1">
                    Enter exactly {parsedStock} unique IMEI(s) to match the initial stock.
                  </p>
                )}
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
              <button type="button" onClick={closeAndReset} disabled={busy}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={busy || (needsImeis && !imeiCountOk)}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-colors">
                {addProduct.isPending && <Loader2 size={16} className="animate-spin" />}
                Add Product
              </button>
            </div>
          </form>
        )}

        {/* ================= VARIANTS MODE ================= */}
        {mode === 'variants' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Product Name (parent)</label>
              <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} disabled={busy} className={inputClass} placeholder="iPhone 12" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  SKU Prefix <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="text" value={baseSku} onChange={(e) => setBaseSku(e.target.value)} disabled={busy} className={inputClass} placeholder="IP12" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="text" value={parentDesc} onChange={(e) => setParentDesc(e.target.value)} disabled={busy} className={inputClass} />
              </div>
            </div>

            {/* Attribute builder */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Attributes <span className="text-slate-400 font-normal">(e.g. Color, Storage — values comma-separated)</span>
              </label>
              {attrs.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={a.name} disabled={busy}
                    onChange={(e) => setAttrs((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    className={`${smallInput} w-28`} placeholder="Color" />
                  <input type="text" value={a.values} disabled={busy}
                    onChange={(e) => setAttrs((p) => p.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))}
                    className={smallInput} placeholder="Black, Blue, White" />
                  <button type="button" disabled={busy || attrs.length === 1}
                    onClick={() => setAttrs((p) => p.filter((_, j) => j !== i))}
                    className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" disabled={busy || attrs.length >= 3}
                  onClick={() => setAttrs((p) => [...p, { name: '', values: '' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium disabled:opacity-40">
                  <Plus size={13} /> Add attribute
                </button>
                <button type="button" disabled={busy} onClick={generateCombos}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold">
                  Generate variants
                </button>
              </div>
            </div>

            {/* Generated combinations */}
            {combos.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span></span><span>Variant</span><span>SKU</span><span>Buy (₦)</span><span>Sell (₦)</span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {combos.map((c) => (
                    <div key={c.key}
                      className={`grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 ${!c.include ? 'opacity-40' : ''}`}>
                      <input type="checkbox" checked={c.include} disabled={busy}
                        onChange={(e) => updateCombo(c.key, { include: e.target.checked })}
                        className="rounded accent-red-600" />
                      <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {Object.values(c.attributes).join(' / ')}
                      </span>
                      <input type="text" value={c.sku} disabled={busy || !c.include}
                        onChange={(e) => updateCombo(c.key, { sku: e.target.value })} className={smallInput} />
                      <input type="number" value={c.cost} min="0" step="0.01" disabled={busy || !c.include}
                        onChange={(e) => updateCombo(c.key, { cost: e.target.value })} className={smallInput} placeholder="0" />
                      <input type="number" value={c.price} min="0" step="0.01" disabled={busy || !c.include}
                        onChange={(e) => updateCombo(c.key, { price: e.target.value })} className={smallInput} placeholder="0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Variants are created with zero stock. After creation, stock each variant with its
              <b> Adjust</b> button{trackImei ? ' — IMEIs will be required per unit' : ''}.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeAndReset} disabled={busy}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleVariantsSubmit} disabled={busy || combos.filter((c) => c.include).length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-colors">
                {addVariantProduct.isPending && <Loader2 size={16} className="animate-spin" />}
                Create {combos.filter((c) => c.include).length || ''} Variant(s)
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};