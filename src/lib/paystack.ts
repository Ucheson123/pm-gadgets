// ==========================================
// PAYSTACK INLINE CHECKOUT HELPER
// Loads Paystack's inline.js once, then opens the payment popup.
// Resolves when the user completes payment; rejects if they close it.
// NOTE: this only means "the popup reported success" — the wallet is
// credited ONLY after the verify-deposit Edge Function confirms with
// Paystack's servers.
// ==========================================

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

const SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';
let scriptPromise: Promise<void> | null = null;

const loadPaystackScript = (): Promise<void> => {
  if (window.PaystackPop) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null; // allow retry on next attempt
        reject(new Error('Could not load Paystack. Check your internet connection.'));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
};

export class PaymentWindowClosedError extends Error {
  constructor() {
    super('Payment window was closed before completing payment.');
    this.name = 'PaymentWindowClosedError';
  }
}

interface CheckoutOptions {
  email: string;
  amountNaira: number;
  reference: string;
}

export const openPaystackCheckout = async ({
  email,
  amountNaira,
  reference,
}: CheckoutOptions): Promise<void> => {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('Paystack public key is missing. Check VITE_PAYSTACK_PUBLIC_KEY in .env.local.');
  }

  await loadPaystackScript();
  if (!window.PaystackPop) throw new Error('Paystack failed to initialize.');

  return new Promise<void>((resolve, reject) => {
    const handler = window.PaystackPop!.setup({
      key: publicKey,
      email,
      amount: Math.round(amountNaira * 100), // Paystack expects KOBO
      currency: 'NGN',
      ref: reference,
      channels: ['card', 'bank', 'bank_transfer', 'ussd'],
      callback: () => resolve(),
      onClose: () => reject(new PaymentWindowClosedError()),
    });
    handler.openIframe();
  });
};