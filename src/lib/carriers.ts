import type { Carrier, CarrierPlan } from '../types';

function mkPlan(
  id: string,
  name: string,
  dataGB: number,
  priceNaira: number,
  validityDays: number
): CarrierPlan {
  const totalMB = dataGB * 1024;
  const nairaPerMB = priceNaira / totalMB;
  const nairaPerKB = nairaPerMB / 1024;
  return { id, name, dataGB, priceNaira, validityDays, nairaPerMB, nairaPerKB };
}

export const CARRIERS: Carrier[] = [
  {
    id: 'mtn',
    name: 'MTN Nigeria',
    color: '#FFCC00',
    plans: [
      mkPlan('mtn-500mb-100', '500MB (100 NGN)', 0.5, 100, 14),
      mkPlan('mtn-1gb-300', '1GB (₦300)', 1, 300, 30),
      mkPlan('mtn-1.5gb-400', '1.5GB (₦400)', 1.5, 400, 30),
      mkPlan('mtn-2gb-500', '2GB (₦500)', 2, 500, 30),
      mkPlan('mtn-3gb-1000', '3GB (₦1,000)', 3, 1000, 30),
      mkPlan('mtn-5gb-1500', '5GB (₦1,500)', 5, 1500, 30),
      mkPlan('mtn-10gb-2000', '10GB (₦2,000)', 10, 2000, 30),
      mkPlan('mtn-15gb-3000', '15GB (₦3,000)', 15, 3000, 30),
      mkPlan('mtn-20gb-4000', '20GB (₦4,000)', 20, 4000, 30),
      mkPlan('mtn-30gb-6000', '30GB (₦6,000)', 30, 6000, 30),
    ],
  },
  {
    id: 'airtel',
    name: 'Airtel Nigeria',
    color: '#E40000',
    plans: [
      mkPlan('airtel-500mb-100', '500MB (₦100)', 0.5, 100, 14),
      mkPlan('airtel-1gb-300', '1GB (₦300)', 1, 300, 30),
      mkPlan('airtel-2gb-500', '2GB (₦500)', 2, 500, 30),
      mkPlan('airtel-3gb-1000', '3GB (₦1,000)', 3, 1000, 30),
      mkPlan('airtel-5gb-1500', '5GB (₦1,500)', 5, 1500, 30),
      mkPlan('airtel-10gb-2500', '10GB (₦2,500)', 10, 2500, 30),
      mkPlan('airtel-15gb-3500', '15GB (₦3,500)', 15, 3500, 30),
      mkPlan('airtel-20gb-4500', '20GB (₦4,500)', 20, 4500, 30),
    ],
  },
  {
    id: 'glo',
    name: 'Glo Nigeria',
    color: '#009640',
    plans: [
      mkPlan('glo-500mb-100', '500MB (₦100)', 0.5, 100, 14),
      mkPlan('glo-1gb-300', '1GB (₦300)', 1, 300, 30),
      mkPlan('glo-2gb-500', '2GB (₦500)', 2, 500, 30),
      mkPlan('glo-5gb-1500', '5GB (₦1,500)', 5, 1500, 30),
      mkPlan('glo-10gb-2500', '10GB (₦2,500)', 10, 2500, 30),
      mkPlan('glo-15gb-3000', '15GB (₦3,000)', 15, 3000, 30),
      mkPlan('glo-25gb-5000', '25GB (₦5,000)', 25, 5000, 30),
    ],
  },
  {
    id: '9mobile',
    name: '9mobile',
    color: '#00B050',
    plans: [
      mkPlan('9m-500mb-100', '500MB (₦100)', 0.5, 100, 14),
      mkPlan('9m-1gb-300', '1GB (₦300)', 1, 300, 30),
      mkPlan('9m-2gb-500', '2GB (₦500)', 2, 500, 30),
      mkPlan('9m-5gb-1500', '5GB (₦1,500)', 5, 1500, 30),
      mkPlan('9m-11gb-2000', '11GB (₦2,000)', 11, 2000, 30),
    ],
  },
];

export function getCarrier(id: string): Carrier {
  return CARRIERS.find((c) => c.id === id) ?? CARRIERS[0];
}

export function getPlan(carrierId: string, planId: string): CarrierPlan | null {
  const carrier = getCarrier(carrierId);
  return carrier.plans.find((p) => p.id === planId) ?? null;
}

/** Best value plan per carrier (lowest ₦/MB) */
export function bestValuePlan(carrierId: string): CarrierPlan {
  const carrier = getCarrier(carrierId);
  return carrier.plans.reduce((best, plan) =>
    plan.nairaPerMB < best.nairaPerMB ? plan : best
  );
}

/** Compare same data tier across carriers */
export function comparePlansAtTier(dataGB: number): Array<{
  carrier: Carrier;
  plan: CarrierPlan | null;
}> {
  return CARRIERS.map((carrier) => {
    const plan =
      carrier.plans.find((p) => Math.abs(p.dataGB - dataGB) < 0.1) ?? null;
    return { carrier, plan };
  });
}
