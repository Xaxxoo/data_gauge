/** Convert bytes to human-readable string */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

export function gbToMB(gb: number): number {
  return gb * 1024;
}

/** Cost in Naira for a given MB at a given rate */
export function mbToNaira(mb: number, nairaPerMB: number): number {
  return mb * nairaPerMB;
}

/** Cost in Naira for a given bytes at a given rate */
export function bytesToNaira(bytes: number, nairaPerMB: number): number {
  return bytesToMB(bytes) * nairaPerMB;
}

/** Format Naira with commas */
export function formatNaira(amount: number): string {
  if (amount < 1) return `₦${amount.toFixed(4)}`;
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** How many days until bundle expires */
export function daysUntilExpiry(expiresAt: string): number {
  const now = new Date();
  const exp = new Date(expiresAt);
  const diff = exp.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Percent of bundle used */
export function bundleUsedPercent(usedMB: number, totalMB: number): number {
  if (totalMB === 0) return 0;
  return Math.min(100, (usedMB / totalMB) * 100);
}

/** Remaining MB in bundle */
export function bundleRemainingMB(usedMB: number, totalMB: number): number {
  return Math.max(0, totalMB - usedMB);
}

/** Projected monthly usage based on daily average */
export function projectedMonthlyMB(dailyAverageMB: number): number {
  return dailyAverageMB * 30;
}

/** At current consumption rate, how many days of bundle left */
export function daysOfDataLeft(remainingMB: number, dailyAverageMB: number): number {
  if (dailyAverageMB <= 0) return Infinity;
  return remainingMB / dailyAverageMB;
}

/** Generate a daily burn rate label */
export function burnRateLabel(mbPerHour: number): string {
  if (mbPerHour > 100) return 'Very High';
  if (mbPerHour > 50) return 'High';
  if (mbPerHour > 10) return 'Moderate';
  if (mbPerHour > 1) return 'Low';
  return 'Idle';
}

/** How much the carrier "stole" in Naira */
export function discrepancyNaira(
  discrepancyMB: number,
  nairaPerMB: number
): number {
  return discrepancyMB * nairaPerMB;
}
