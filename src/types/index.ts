export type CarrierId = 'mtn' | 'airtel' | 'glo' | '9mobile' | 'other';

export interface CarrierPlan {
  id: string;
  name: string;
  dataGB: number;
  priceNaira: number;
  validityDays: number;
  /** Naira per MB derived from plan */
  nairaPerMB: number;
  /** Naira per KB */
  nairaPerKB: number;
}

export interface Carrier {
  id: CarrierId;
  name: string;
  color: string;
  plans: CarrierPlan[];
}

export interface ActiveBundle {
  id: string;
  carrierId: CarrierId;
  planId: string;
  planName: string;
  totalMB: number;
  usedMB: number;
  purchasedAt: string; // ISO date
  expiresAt: string;   // ISO date
  priceNaira: number;
  nairaPerMB: number;
}

export interface SpeedTestResult {
  id: string;
  timestamp: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  carrierId: CarrierId;
  networkType: string; // '4G' | '3G' | 'WiFi' etc.
}

export interface UsageSession {
  id: string;
  startTime: string;
  endTime: string | null;
  downloadedMB: number;
  uploadedMB: number;
  totalMB: number;
  costNaira: number;
  networkType: string;
  carrierId: CarrierId;
  note: string;
}

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  downloadedMB: number;
  uploadedMB: number;
  totalMB: number;
  costNaira: number;
  sessions: number;
}

export interface AuditEntry {
  id: string;
  date: string;
  yourTrackedMB: number;
  carrierClaimedMB: number;
  discrepancyMB: number;
  discrepancyNaira: number;
  carrierId: CarrierId;
  note: string;
}

export interface AppSettings {
  selectedCarrierId: CarrierId;
  selectedPlanId: string;
  customNairaPerMB: number | null; // override rate
  activeBundleId: string | null;
  alertThresholdPercent: number; // warn at X% of bundle used
  currency: 'NGN'; // always NGN for now
  darkMode: boolean;
}

// ── New types for BurnRate v2 ──────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'burn_spike' | 'approaching_limit' | 'bundle_depleted' | 'weekend_warrior' | 'low_balance';

export interface SmartAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
}

export interface DataTip {
  id: string;
  title: string;
  body: string;
  savingsEstimateMB: number; // estimated MB saved per day
  category: 'video' | 'social' | 'system' | 'browser' | 'messaging';
  icon: string; // Ionicons name
}

export interface BundleRecommendation {
  carrierId: CarrierId;
  carrierName: string;
  plan: CarrierPlan;
  type: 'best_fit' | 'safe_choice' | 'budget_pick';
  label: string;
  projectedUsageMB: number;
  savingsNaira: number; // vs current plan, negative = more expensive
}

export interface UssdBalanceCheck {
  id: string;
  carrierId: CarrierId;
  timestamp: string;
  balanceMB: number;
  method: 'ussd' | 'manual';
}

export interface ExportConfig {
  period: 'week' | 'month' | 'all';
  includeCharts: boolean;
  includeBundleStatus: boolean;
  includeAudit: boolean;
}
