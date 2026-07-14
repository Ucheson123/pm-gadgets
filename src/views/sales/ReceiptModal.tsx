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

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

// The naira sign (₦) isn't in jsPDF's built-in fonts, so the PDF uses "NGN"
const pdfMoney = (v: number) =>
  'NGN ' + v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ==========================================
// Shared receipt markup — rendered twice:
// 1. inside the modal (visible on screen)
// 2. in a body-level portal (used ONLY when printing, so the print
//    engine never has to fight the modal's positioning)
// ==========================================
const ReceiptContent = ({
  sale,
  branchName,
  qrWrapRef,
}: {
  sale: SaleRow;
  branchName: string;
  qrWrapRef?: RefObject<HTMLDivElement | null>;
}) => (
  <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm transition-colors duration-200">
    <div className="text-center mb-4">
      <p className="font-black text-lg tracking-tight">
        <span className="text-red-600">P</span>M{' '}
        <span className="tracking-widest text-xs font-bold text-slate-900 dark:text-white transition-colors duration-200">GADGETS</span>
      </p>
      <p className="text-slate-500 dark:text-slate-400 text-xs transition-colors duration-200">{branchName} Branch</p>
    </div>

    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-y border-dashed border-slate-300 dark:border-slate-700 py-2 mb-3 transition-colors duration-200">
      <span>{sale.receipt_number}</span>
      <span>{formatDateTime(sale.created_at)}</span>
    </div>

    <div className="space-y-0.5 text-xs mb-3">
      <p>
        <span className="text-slate-500 dark:text-slate-400 transition-colors duration-200">Customer:</span>{' '}
        <span className="text-slate-900 dark:text-slate-200 font-medium transition-colors duration-200">{sale.customer?.full_name ?? '—'}</span>
        {sale.customer?.phone ? ` (${sale.customer.phone})` : ''}
      </p>
      <p>
        <span className="text-slate-500 dark:text-slate-400 transition-colors duration-200">Served by:</span>{' '}
        <span className="text-slate-900 dark:text-slate-200 font-medium transition-colors duration-200">{sale.salesperson?.full_name ?? '—'}</span>
      </p>
    </div>

    <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 space-y-2 mb-3 transition-colors duration-200">
      {sale.sale_items.map((item) => (
        <div key={item.id}>
          <p className="font-medium text-slate-900 dark:text-white transition-colors duration-200">{item.product?.name ?? 'Item'}</p>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 transition-colors duration-200">
              {item.quantity} × {formatNaira(item.unit_price)}
            </span>
            <span className="font-medium text-sm text-slate-900 dark:text-white transition-colors duration-200">
              {formatNaira(item.unit_price * item.quantity)}
            </span>
          </div>
          {item.imeis && item.imeis.length > 0 && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 break-all mt-0.5 font-mono transition-colors duration-200">
              IMEI: {item.imeis.join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>

    <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 space-y-1 transition-colors duration-200">
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <span>Subtotal</span>
        <span>{formatNaira(sale.subtotal)}</span>
      </div>
      {sale.discount_amount > 0 && (
        <div className="flex justify-between text-xs text-amber-600 dark:text-amber-500 font-medium transition-colors duration-200">
          <span>Discount</span>
          <span>−{formatNaira(sale.discount_amount)}</span>
        </div>
      )}
      {sale.vat_amount > 0 && (
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
          <span>VAT (7.5%)</span>
          <span>{formatNaira(sale.vat_amount)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white transition-colors duration-200">
        <span>TOTAL</span>
        <span>{formatNaira(sale.total_amount)}</span>
      </div>
    </div>

    <div ref={qrWrapRef} className="flex flex-col items-center mt-4 gap-1 p-2 bg-white rounded-lg inline-block mx-auto max-w-fit">
      <QRCodeCanvas
        value={JSON.stringify({
          receipt: sale.receipt_number,
          total: sale.total_amount,
          date: sale.created_at,
        })}
        size={88}
      />
      <p className="text-[10px] text-slate-400 text-center mt-1 select-none">
        Scan to verify · Thank you for shopping with PM Gadgets
      </p>
    </div>
  </div>
);

// ==========================================
// PDF: generated as real vector text on an 80mm receipt roll,
// with the QR embedded from the on-screen canvas.
// ==========================================
const buildReceiptPdf = (
  sale: SaleRow,
  branchName: string,
  qrDataUrl: string | null
) => {
  const W = 80; // receipt width in mm
  const M = 6;  // margin
  const CW = W - M * 2;

  // Pre-measure so the page height fits the content
  let height = 34; // header block
  const probe = new jsPDF({ unit: 'mm', format: [W, 500] });
  probe.setFontSize(8);
  for (const item of sale.sale_items) {
    height += probe.splitTextToSize(item.product?.name ?? 'Item', CW - 20).length * 3.5 + 4;
    for (const imei of item.imeis ?? []) {
      height += probe.splitTextToSize(`IMEI: ${imei}`, CW).length * 3;
    }
  }
  height += 26; // totals block
  if (sale.discount_amount > 0) height += 4;
  if (sale.vat_amount > 0) height += 4;
  if (qrDataUrl) height += 30;
  height += 12; // footer

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
  y += 5;
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

  // QR + footer
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', center - 11, y, 22, 22);
    y += 25;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Scan to verify - Thank you for shopping with PM Gadgets', center, y, {
    align: 'center',
  });

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
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 rounded-xl text-sm font-medium transition-all duration-200"
              >
                Close
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-transparent hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all duration-200"
              >
                <Download size={16} /> Download PDF
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-600/20 active:scale-[0.98]"
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Body-level print copy: invisible on screen (display:none via CSS),
          becomes the only visible element during printing. No modal
          ancestors = no clipping, no mid-page offset. */}
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