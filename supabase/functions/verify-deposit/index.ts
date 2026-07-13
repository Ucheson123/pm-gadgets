// ==========================================
// VERIFY-DEPOSIT EDGE FUNCTION
// The ONLY code path that can trigger a wallet credit from a deposit.
// Flow: authenticated user sends a reference → we ask Paystack (with the
// secret key, server-side only) → if genuinely paid in NGN, we call
// process_deposit() with the service role. The SQL function re-checks the
// amount and is idempotent, so even a replayed request can't double-credit.
// ==========================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- 1. Parse and validate input ----
    const { reference } = await req.json().catch(() => ({}));
    if (!reference || typeof reference !== 'string' || reference.length > 100) {
      return json({ error: 'A valid deposit reference is required' }, 400);
    }

    // ---- 2. Require a logged-in user (JWT comes from the app) ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);

    const supabaseAsUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabaseAsUser.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    // ---- 3. Verify with Paystack using the SECRET key ----
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) {
      console.error('PAYSTACK_SECRET_KEY is not set in Edge Function secrets');
      return json({ error: 'Payment verification is not configured' }, 500);
    }

    const psRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } }
    );
    const ps = await psRes.json();

    if (!psRes.ok || !ps?.status || !ps?.data) {
      return json(
        { error: 'Paystack could not verify this reference', detail: ps?.message },
        400
      );
    }

    const tx = ps.data;

    // Must be a genuinely successful NGN payment
    if (tx.status !== 'success') {
      return json(
        { status: 'not_paid', gateway_status: tx.status ?? 'unknown' },
        200
      );
    }
    if (tx.currency !== 'NGN') {
      return json({ error: `Unexpected currency: ${tx.currency}` }, 400);
    }

    // Paystack amounts are in KOBO — convert to naira for the ledger
    const verifiedAmountNaira = Number(tx.amount) / 100;
    if (!Number.isFinite(verifiedAmountNaira) || verifiedAmountNaira <= 0) {
      return json({ error: 'Invalid amount from gateway' }, 400);
    }

    // ---- 4. Credit the wallet via the locked-down SQL function ----
    // Service role is required: process_deposit is revoked from all
    // client roles. It re-validates the amount and handles idempotency.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await admin.rpc('process_deposit', {
      p_reference: reference,
      p_verified_amount: verifiedAmountNaira,
    });

    if (error) {
      console.error('process_deposit failed:', error.message);
      return json({ error: error.message }, 400);
    }

    return json(data, 200);
  } catch (err) {
    console.error('verify-deposit unexpected error:', err);
    return json({ error: 'Unexpected error during verification' }, 500);
  }
});