import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppSettings,
  ActiveBundle,
  UsageSession,
  DailyUsage,
  AuditEntry,
  SpeedTestResult,
  CarrierId,
} from '../types';

const KEYS = {
  SETTINGS: '@dm:settings',
  BUNDLES: '@dm:bundles',
  SESSIONS: '@dm:sessions',
  GD_PURCHASES: '@dm:gd_purchases',
  DAILY_USAGE: '@dm:daily_usage',
  AUDIT: '@dm:audit',
  SPEED_TESTS: '@dm:speed_tests',
};

const DEFAULT_SETTINGS: AppSettings = {
  selectedCarrierId: 'mtn',
  selectedPlanId: 'mtn-1gb-300',
  customNairaPerMB: null,
  activeBundleId: null,
  alertThresholdPercent: 80,
  currency: 'NGN',
  darkMode: true,
};

// ── Settings ───────────────────────────────────────────────
export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
}

// ── Bundles ────────────────────────────────────────────────
export async function getBundles(): Promise<ActiveBundle[]> {
  const raw = await AsyncStorage.getItem(KEYS.BUNDLES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveBundle(bundle: ActiveBundle): Promise<void> {
  const bundles = await getBundles();
  const idx = bundles.findIndex((b) => b.id === bundle.id);
  if (idx >= 0) bundles[idx] = bundle;
  else bundles.unshift(bundle);
  await AsyncStorage.setItem(KEYS.BUNDLES, JSON.stringify(bundles));
}

export async function deleteBundle(id: string): Promise<void> {
  const bundles = await getBundles();
  await AsyncStorage.setItem(
    KEYS.BUNDLES,
    JSON.stringify(bundles.filter((b) => b.id !== id))
  );
}

export async function updateBundleUsage(id: string, usedMB: number): Promise<void> {
  const bundles = await getBundles();
  const bundle = bundles.find((b) => b.id === id);
  if (bundle) {
    bundle.usedMB = usedMB;
    await AsyncStorage.setItem(KEYS.BUNDLES, JSON.stringify(bundles));
  }
}

// ── Usage Sessions ─────────────────────────────────────────
export async function getSessions(limit = 100): Promise<UsageSession[]> {
  const raw = await AsyncStorage.getItem(KEYS.SESSIONS);
  const all: UsageSession[] = raw ? JSON.parse(raw) : [];
  return all.slice(0, limit);
}

export async function saveSession(session: UsageSession): Promise<void> {
  const sessions = await getSessions(500);
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  // Keep last 500 sessions
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions.slice(0, 500)));
}

// ── Daily Usage ────────────────────────────────────────────
export async function getDailyUsage(days = 30): Promise<DailyUsage[]> {
  const raw = await AsyncStorage.getItem(KEYS.DAILY_USAGE);
  const all: DailyUsage[] = raw ? JSON.parse(raw) : [];
  return all.slice(0, days);
}

export async function recordDailyUsage(
  date: string,
  downloadedMB: number,
  uploadedMB: number,
  costNaira: number
): Promise<void> {
  const all = await getDailyUsage(90);
  const idx = all.findIndex((d) => d.date === date);
  if (idx >= 0) {
    all[idx].downloadedMB += downloadedMB;
    all[idx].uploadedMB += uploadedMB;
    all[idx].totalMB = all[idx].downloadedMB + all[idx].uploadedMB;
    all[idx].costNaira += costNaira;
    all[idx].sessions += 1;
  } else {
    all.unshift({
      date,
      downloadedMB,
      uploadedMB,
      totalMB: downloadedMB + uploadedMB,
      costNaira,
      sessions: 1,
    });
  }
  await AsyncStorage.setItem(KEYS.DAILY_USAGE, JSON.stringify(all.slice(0, 90)));
}

// ── Audit ──────────────────────────────────────────────────
export async function getAuditEntries(): Promise<AuditEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.AUDIT);
  return raw ? JSON.parse(raw) : [];
}

export async function saveAuditEntry(entry: AuditEntry): Promise<void> {
  const entries = await getAuditEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  await AsyncStorage.setItem(KEYS.AUDIT, JSON.stringify(entries.slice(0, 200)));
}

export async function deleteAuditEntry(id: string): Promise<void> {
  const entries = await getAuditEntries();
  await AsyncStorage.setItem(
    KEYS.AUDIT,
    JSON.stringify(entries.filter((e) => e.id !== id))
  );
}

// ── Speed Tests ────────────────────────────────────────────
export async function getSpeedTests(limit = 50): Promise<SpeedTestResult[]> {
  const raw = await AsyncStorage.getItem(KEYS.SPEED_TESTS);
  const all: SpeedTestResult[] = raw ? JSON.parse(raw) : [];
  return all.slice(0, limit);
}

export async function saveSpeedTest(result: SpeedTestResult): Promise<void> {
  const tests = await getSpeedTests(100);
  tests.unshift(result);
  await AsyncStorage.setItem(KEYS.SPEED_TESTS, JSON.stringify(tests.slice(0, 100)));
}

// ── GoodDollar purchases ───────────────────────────────────
export interface GDPurchase {
  id: string;
  timestamp: string;
  carrierId: string;
  planName: string;
  amountNGN: number;
  amountG: number;
  phoneNumber: string;
  transactionId?: string;
  txHash?: string;          // on-chain G$ send tx
  status: 'pending' | 'paid' | 'delivered' | 'failed';
}

export async function getGDPurchases(): Promise<GDPurchase[]> {
  const raw = await AsyncStorage.getItem(KEYS.GD_PURCHASES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveGDPurchase(p: GDPurchase): Promise<void> {
  const all = await getGDPurchases();
  const idx = all.findIndex((x) => x.id === p.id);
  if (idx >= 0) all[idx] = p;
  else all.unshift(p);
  await AsyncStorage.setItem(KEYS.GD_PURCHASES, JSON.stringify(all.slice(0, 100)));
}

// ── Helpers ────────────────────────────────────────────────
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
