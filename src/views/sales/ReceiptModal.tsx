import { useRef } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { Download, Loader2, Printer } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { formatNaira } from '../../hooks/useInventory';
import { useSaleDetail } from '../../hooks/useSales';
import type { SaleRow } from '../../hooks/useSales';

interface ReceiptModalProps {
  saleId: string | null; // null = closed
  onClose: () => void;
}

// ==========================================
// BRANCH ADDRESSES (shown under the branch name)
// ==========================================
const BRANCH_ADDRESSES: Record<string, string> = {
  Abraka:
    'No. 2 Donrex Camp, Opp. Iyke Supermarket, Along Police Station Road, Abraka, Delta State.',
  Warri:
    'Shop G144, Second Floor, Robinson Plaza, PTI, Effurun, Warri.',
  Abuja:
    'Shop J2-99 block J, GSM village Wuse Abuja.'
  // Add the Abuja address here when available, e.g.:
  // Abuja: 'Suite ..., ..., Abuja, FCT.',
};

// Replace the placeholders with each branch's real number
const BRANCH_PHONES: Record<string, string> = {
  Abraka: '08105509942',
  Warri: '08165150318',
  Abuja: '09036848120',
};

// ==========================================
// SHOP CONDITIONS (printed on every receipt)
// ==========================================
const SHOP_TERMS = [
  'We offer a 7-day warranty on all used gadgets, and 7-day warranty on brand-new gadgets as given by the manufacturer. Claims that you travelled or kept the item without using it do not extend the 7-day warranty period.',
  'We do not offer water-resistance warranty.',
  'We do not offer screen warranty.',
  "Manufacturer's warranty does not cover non-mechanical damage, physical/screen damage, or liquid damage (dead device) caused by negligent use of the device.",
  'Please test your device properly before leaving the sales premises.',
  'All sales are final. We do not offer refunds.',
  'If a device is found to be stolen or involved in fraud, the buyer agrees to be handed over to the appropriate authorities.',
  "If a device has a manufacturer's fault identified at the place and time of purchase, it can be returned for replacement.",
];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

// The naira sign (₦) isn't in jsPDF's built-in fonts, so the PDF uses "NGN"
const pdfMoney = (v: number) =>
  'NGN ' + v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ==========================================
// Shared receipt markup — rendered in the modal AND in the
// body-level print portal
// ==========================================
const ReceiptContent = ({
  sale,
  branchName,
  qrWrapRef,
}: {
  sale: SaleRow;
  branchName: string;
  qrWrapRef?: RefObject<HTMLDivElement | null>;
}) => {
  const address = BRANCH_ADDRESSES[branchName];
  const phone = BRANCH_PHONES[branchName];
  return (
    <div className="bg-white text-slate-900 p-5 rounded-xl border border-slate-200 text-sm">
      <div className="text-center mb-4">
        <p className="font-black text-lg tracking-tight">
          <span className="text-red-600">P</span>M{' '}
          <span className="tracking-widest text-xs font-bold">GADGETS</span>
        </p>
        <p className="text-slate-500 text-xs">{branchName} Branch</p>
        {address && (
          <p className="text-slate-500 text-[10px] leading-snug mt-0.5">
            <span className="font-semibold">Shop Address:</span> {address}
          </p>
        )}
        {phone && (
          <p className="text-slate-500 text-[10px] leading-snug mt-0.5">
            <span className="font-semibold">Phone/WhatsApp:</span> {phone}
          </p>
        )}
      </div>

      <div className="flex justify-between text-xs text-slate-500 border-y border-dashed border-slate-300 py-2 mb-3">
        <span>{sale.receipt_number}</span>
        <span>{formatDateTime(sale.created_at)}</span>
      </div>

      <div className="space-y-0.5 text-xs mb-3">
        <p>
          <span className="text-slate-500">Customer:</span>{' '}
          {sale.customer?.full_name ?? '—'}
          {sale.customer?.phone ? ` (${sale.customer.phone})` : ''}
        </p>
        <p>
          <span className="text-slate-500">Served by:</span>{' '}
          {sale.salesperson?.full_name ?? '—'}
        </p>
      </div>

      <div className="border-t border-dashed border-slate-300 pt-2 space-y-2 mb-3">
        {sale.sale_items.map((item) => (
          <div key={item.id}>
            <p className="font-medium">{item.product?.name ?? 'Item'}</p>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">
                {item.quantity} × {formatNaira(item.unit_price)}
              </span>
              <span className="font-medium text-sm">
                {formatNaira(item.unit_price * item.quantity)}
              </span>
            </div>
            {item.imeis && item.imeis.length > 0 && (
              <p className="text-[10px] text-slate-500 break-all">
                IMEI: {item.imeis.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Subtotal</span>
          <span>{formatNaira(sale.subtotal)}</span>
        </div>
        {sale.discount_amount > 0 && (
          <div className="flex justify-between text-xs text-amber-600">
            <span>Discount</span>
            <span>−{formatNaira(sale.discount_amount)}</span>
          </div>
        )}
        {sale.vat_amount > 0 && (
          <div className="flex justify-between text-xs text-slate-500">
            <span>VAT (7.5%)</span>
            <span>{formatNaira(sale.vat_amount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL</span>
          <span>{formatNaira(sale.total_amount)}</span>
        </div>
      </div>

      <div ref={qrWrapRef} className="flex flex-col items-center mt-4 gap-1">
        <QRCodeCanvas
          value={JSON.stringify({
            receipt: sale.receipt_number,
            total: sale.total_amount,
            date: sale.created_at,
          })}
          size={88}
        />
        <p className="text-[10px] text-slate-400">Scan to verify</p>
      </div>

      {/* Shop conditions — the customer signs beneath these */}
      <div className="mt-4 border-t border-dashed border-slate-300 pt-2">
        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wide mb-1">
          Terms &amp; Conditions
        </p>
        <ol className="list-decimal list-outside pl-4 space-y-0.5">
          {SHOP_TERMS.map((term, i) => (
            <li key={i} className="text-[9px] leading-snug text-slate-500">
              {term}
            </li>
          ))}
        </ol>
      </div>

      {/* Signatures: acceptance of the goods and the terms above */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <div className="text-center">
          <div className="border-t border-slate-400 pt-1">
            <p className="text-[10px] text-slate-600 font-medium">Customer Signature</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-400 pt-1">
            <p className="text-[10px] text-slate-600 font-medium">Manager Signature</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center mt-3">
        Thank you for shopping with PM Gadgets
      </p>
    </div>
  );
};

// ==========================================
// PDF: 80mm receipt roll, vector text, QR embedded from the canvas
// ==========================================
const buildReceiptPdf = (
  sale: SaleRow,
  branchName: string,
  qrDataUrl: string | null
) => {
  const W = 80; // receipt width in mm
  const M = 6;  // margin
  const CW = W - M * 2;
  const address = BRANCH_ADDRESSES[branchName];

  // Pre-measure so the page height fits the content
  const probe = new jsPDF({ unit: 'mm', format: [W, 500] });
  let height = 30; // header block
  const phone = BRANCH_PHONES[branchName];
  if (address) {
    probe.setFontSize(6.5);
    height += probe.splitTextToSize(`Shop Address: ${address}`, CW).length * 2.8 + 1;
  }
  if (phone) height += 3.2;
  probe.setFontSize(8);
  for (const item of sale.sale_items) {
    height += probe.splitTextToSize(item.product?.name ?? 'Item', CW - 20).length * 3.5 + 4;
    probe.setFontSize(6.5);
    for (const imei of item.imeis ?? []) {
      height += probe.splitTextToSize(`IMEI: ${imei}`, CW).length * 3;
    }
    probe.setFontSize(8);
  }
  height += 26; // totals block
  if (sale.discount_amount > 0) height += 4;
  if (sale.vat_amount > 0) height += 4;
  if (qrDataUrl) height += 30;
  probe.setFontSize(6);
  height += 6; // terms header
  for (let i = 0; i < SHOP_TERMS.length; i++) {
    height += probe.splitTextToSize(`${i + 1}. ${SHOP_TERMS[i]}`, CW).length * 2.4 + 0.8;
  }
  height += 26; // signatures + footer

  const doc = new jsPDF({ unit: 'mm', format: [W, height] });
  let y = 8;
  const center = W / 2;
  const line = () => {
    doc.setDrawColor(150);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M, y, W - M, y);
    y += 3.5;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PM GADGETS', center, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${branchName} Branch`, center, y, { align: 'center' });
  y += 3.5;
  if (address) {
    doc.setFontSize(6.5);
    const addrLines = doc.splitTextToSize(`Shop Address: ${address}`, CW);
    doc.text(addrLines, center, y, { align: 'center' });
    y += addrLines.length * 2.8 + 1;
    doc.setFontSize(8);
  }
  if (phone) {
    doc.setFontSize(6.5);
    doc.text(`Phone/WhatsApp: ${phone}`, center, y, { align: 'center' });
    y += 3.2;
    doc.setFontSize(8);
  }
  if (!address && !phone) {
    y += 1.5;
  }
  line();

  // Meta
  doc.text(sale.receipt_number, M, y);
  doc.text(formatDateTime(sale.created_at), W - M, y, { align: 'right' });
  y += 4;
  doc.text(
    `Customer: ${sale.customer?.full_name ?? '-'}${sale.customer?.phone ? ` (${sale.customer.phone})` : ''}`,
    M, y
  );
  y += 4;
  doc.text(`Served by: ${sale.salesperson?.full_name ?? '-'}`, M, y);
  y += 4;
  line();

  // Items
  for (const item of sale.sale_items) {
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(item.product?.name ?? 'Item', CW - 20);
    doc.text(nameLines, M, y);
    y += nameLines.length * 3.5;
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.quantity} x ${pdfMoney(item.unit_price)}`, M, y);
    doc.text(pdfMoney(item.unit_price * item.quantity), W - M, y, { align: 'right' });
    y += 4;
    doc.setFontSize(6.5);
    for (const imei of item.imeis ?? []) {
      const imeiLines = doc.splitTextToSize(`IMEI: ${imei}`, CW);
      doc.text(imeiLines, M, y);
      y += imeiLines.length * 3;
    }
    doc.setFontSize(8);
  }
  line();

  // Totals
  doc.text('Subtotal', M, y);
  doc.text(pdfMoney(sale.subtotal), W - M, y, { align: 'right' });
  y += 4;
  if (sale.discount_amount > 0) {
    doc.text('Discount', M, y);
    doc.text(`-${pdfMoney(sale.discount_amount)}`, W - M, y, { align: 'right' });
    y += 4;
  }
  if (sale.vat_amount > 0) {
    doc.text('VAT (7.5%)', M, y);
    doc.text(pdfMoney(sale.vat_amount), W - M, y, { align: 'right' });
    y += 4;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL', M, y + 1);
  doc.text(pdfMoney(sale.total_amount), W - M, y + 1, { align: 'right' });
  y += 7;

  // QR
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', center - 11, y, 22, 22);
    y += 23;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Scan to verify', center, y, { align: 'center' });
    y += 4;
  }

  // Terms & conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('TERMS & CONDITIONS', M, y);
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  for (let i = 0; i < SHOP_TERMS.length; i++) {
    const termLines = doc.splitTextToSize(`${i + 1}. ${SHOP_TERMS[i]}`, CW);
    doc.text(termLines, M, y);
    y += termLines.length * 2.4 + 0.8;
  }

  // Signature lines
  y += 12; // space to actually sign in
  const sigWidth = 28;
  doc.setDrawColor(90);
  doc.setLineDashPattern([], 0);
  doc.line(M, y, M + sigWidth, y);
  doc.line(W - M - sigWidth, y, W - M, y);
  y += 3;
  doc.setFontSize(6.5);
  doc.text('Customer Signature', M + sigWidth / 2, y, { align: 'center' });
  doc.text('Manager Signature', W - M - sigWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(6.5);
  doc.text('Thank you for shopping with PM Gadgets', center, y, { align: 'center' });

  doc.save(`${sale.receipt_number}.pdf`);
};

export const ReceiptModal = ({ saleId, onClose }: ReceiptModalProps) => {
  const { user } = useAuth();
  const sale = useSaleDetail(saleId);
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const s = sale.data;
  const branchName = user?.branch_name ?? '';

  const handleDownloadPdf = () => {
    if (!s) return;
    const canvas = qrWrapRef.current?.querySelector('canvas') ?? null;
    buildReceiptPdf(s, branchName, canvas ? canvas.toDataURL('image/png') : null);
  };

  return (
    <>
      <Modal isOpen={saleId !== null} onClose={onClose} title="Sale Receipt">
        {sale.isLoading && (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {s && (
          <>
            <ReceiptContent sale={s} branchName={branchName} qrWrapRef={qrWrapRef} />

            <div className="flex flex-wrap justify-end gap-3 pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors"
              >
                <Download size={16} /> Download PDF
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Body-level print copy — the only visible element while printing */}
      {s &&
        createPortal(
          <div className="print-receipt-root">
            <div className="max-w-sm mx-auto">
              <ReceiptContent sale={s} branchName={branchName} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};