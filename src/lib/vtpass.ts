// VTPass API — Nigerian data vending
// Docs: https://vtpass.com/documentation/
// Get keys at: https://vtpass.com/developer

const IS_SANDBOX = process.env.EXPO_PUBLIC_VTPASS_SANDBOX !== 'false';
const BASE = IS_SANDBOX
  ? 'https://sandbox.vtpass.com/api'
  : 'https://vtpass.com/api';

const API_KEY = process.env.EXPO_PUBLIC_VTPASS_API_KEY ?? '';
const SECRET_KEY = process.env.EXPO_PUBLIC_VTPASS_SECRET_KEY ?? '';
const PUB_KEY = process.env.EXPO_PUBLIC_VTPASS_PUBLIC_KEY ?? '';

// Carrier → VTPass service ID
export const CARRIER_SERVICE: Record<string, string> = {
  mtn: 'mtn-data',
  airtel: 'airtel-data',
  glo: 'glo-data',
  '9mobile': 'etisalat-data',
};

export interface VTVariation {
  variation_code: string;
  name: string;
  variation_amount: string; // "300.00"
  fixedPrice: 'Yes' | 'No';
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  message: string;
}

function headers() {
  return {
    'api-key': API_KEY,
    'secret-key': SECRET_KEY,
    'public-key': PUB_KEY,
    'Content-Type': 'application/json',
  };
}

function requestId(): string {
  const d = new Date();
  return `DM${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}${Date.now()}`;
}

export async function getVariations(carrierId: string): Promise<VTVariation[]> {
  const serviceID = CARRIER_SERVICE[carrierId];
  if (!serviceID) return [];

  if (IS_SANDBOX || !API_KEY) return getMockVariations(carrierId);

  try {
    const res = await fetch(`${BASE}/service-variations?serviceID=${serviceID}`, {
      headers: headers(),
    });
    if (!res.ok) {
      console.error(`[VTPass] getVariations failed: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    return (data as { content?: { variations?: VTVariation[] } }).content?.variations ?? [];
  } catch (err) {
    console.error('[VTPass] getVariations network error:', err);
    return [];
  }
}

export async function buyData(
  carrierId: string,
  phoneNumber: string,
  variationCode: string,
  amountNGN: number
): Promise<PurchaseResult> {
  const serviceID = CARRIER_SERVICE[carrierId];
  if (!serviceID) return { success: false, message: 'Unsupported carrier' };

  if (IS_SANDBOX || !API_KEY) return mockPurchase(carrierId, phoneNumber, amountNGN);

  try {
    const body = {
      request_id: requestId(),
      serviceID,
      billersCode: phoneNumber,
      variation_code: variationCode,
      amount: amountNGN,
      phone: phoneNumber,
    };

    const res = await fetch(`${BASE}/pay`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`[VTPass] buyData failed: HTTP ${res.status} ${res.statusText}`);
      return { success: false, message: `Payment request failed (HTTP ${res.status}) — please try again` };
    }

    const data = await res.json();
    const d = data as {
      code?: string;
      response_description?: string;
      content?: { transactions?: { transactionId?: string } };
    };

    if (d.code === '000') {
      return {
        success: true,
        transactionId: d.content?.transactions?.transactionId,
        message: 'Data purchased successfully!',
      };
    }

    console.error(`[VTPass] buyData API error: code=${d.code} message=${d.response_description}`);
    return { success: false, message: d.response_description ?? 'Purchase failed' };
  } catch (err) {
    console.error('[VTPass] buyData network error:', err);
    return { success: false, message: 'Network error — please try again' };
  }
}

// ── Mock data for sandbox / demo ───────────────────────────
function getMockVariations(carrierId: string): VTVariation[] {
  const plans: Record<string, VTVariation[]> = {
    mtn: [
      { variation_code: 'mtn-data-100MB', name: '100MB (24hrs)', variation_amount: '50.00', fixedPrice: 'Yes' },
      { variation_code: 'mtn-data-500MB', name: '500MB (2 weeks)', variation_amount: '100.00', fixedPrice: 'Yes' },
      { variation_code: 'mtn-data-1GB', name: '1GB (30 days)', variation_amount: '300.00', fixedPrice: 'Yes' },
      { variation_code: 'mtn-data-2GB', name: '2GB (30 days)', variation_amount: '500.00', fixedPrice: 'Yes' },
      { variation_code: 'mtn-data-5GB', name: '5GB (30 days)', variation_amount: '1500.00', fixedPrice: 'Yes' },
      { variation_code: 'mtn-data-10GB', name: '10GB (30 days)', variation_amount: '2000.00', fixedPrice: 'Yes' },
    ],
    airtel: [
      { variation_code: 'airtel-data-500MB', name: '500MB (2 weeks)', variation_amount: '100.00', fixedPrice: 'Yes' },
      { variation_code: 'airtel-data-1GB', name: '1GB (30 days)', variation_amount: '300.00', fixedPrice: 'Yes' },
      { variation_code: 'airtel-data-2GB', name: '2GB (30 days)', variation_amount: '500.00', fixedPrice: 'Yes' },
      { variation_code: 'airtel-data-5GB', name: '5GB (30 days)', variation_amount: '1500.00', fixedPrice: 'Yes' },
    ],
    glo: [
      { variation_code: 'glo-data-1GB', name: '1GB (30 days)', variation_amount: '300.00', fixedPrice: 'Yes' },
      { variation_code: 'glo-data-2GB', name: '2GB (30 days)', variation_amount: '500.00', fixedPrice: 'Yes' },
      { variation_code: 'glo-data-5GB', name: '5GB (30 days)', variation_amount: '1500.00', fixedPrice: 'Yes' },
    ],
    '9mobile': [
      { variation_code: '9mobile-data-1GB', name: '1GB (30 days)', variation_amount: '300.00', fixedPrice: 'Yes' },
      { variation_code: '9mobile-data-2GB', name: '2GB (30 days)', variation_amount: '500.00', fixedPrice: 'Yes' },
      { variation_code: '9mobile-data-11GB', name: '11GB (30 days)', variation_amount: '2000.00', fixedPrice: 'Yes' },
    ],
  };
  return plans[carrierId] ?? [];
}

async function mockPurchase(
  carrierId: string,
  phone: string,
  amount: number
): Promise<PurchaseResult> {
  await new Promise((r) => setTimeout(r, 2000)); // simulate network delay
  return {
    success: true,
    transactionId: `MOCK_${Date.now()}`,
    message: `[SANDBOX] ${amount} NGN data sent to ${phone} on ${carrierId.toUpperCase()}`,
  };
}
