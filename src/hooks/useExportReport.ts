import { useCallback, useState } from 'react';
import { Platform, Alert } from 'react-native';
import { getDailyUsage, getBundles, getSettings } from '../lib/storage';
import { getCarrier, getPlan } from '../lib/carriers';
import { formatBytes, formatNaira, daysUntilExpiry, bundleUsedPercent } from '../lib/dataCalc';
import type { ExportConfig } from '../types';

// expo-print and expo-sharing — optional deps
let Print: typeof import('expo-print') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;

try {
  Print = require('expo-print');
} catch {}
try {
  Sharing = require('expo-sharing');
} catch {}

/**
 * Hook to generate and share PDF usage reports.
 */
export function useExportReport() {
  const [exporting, setExporting] = useState(false);

  const exportReport = useCallback(async (config: ExportConfig) => {
    if (!Print || !Sharing) {
      Alert.alert('Unavailable', 'PDF export is not available in this environment.');
      return;
    }

    setExporting(true);

    try {
      const [settings, bundles] = await Promise.all([
        getSettings(),
        getBundles(),
      ]);

      // Determine date range
      let days = 30;
      let periodLabel = 'This Month';
      if (config.period === 'week') {
        days = 7;
        periodLabel = 'This Week';
      } else if (config.period === 'all') {
        days = 90;
        periodLabel = 'All Time';
      }

      const daily = await getDailyUsage(days);
      const carrier = getCarrier(settings.selectedCarrierId);
      const plan = getPlan(settings.selectedCarrierId, settings.selectedPlanId);

      // Calculate totals
      const totalMB = daily.reduce((s, d) => s + d.totalMB, 0);
      const totalNaira = daily.reduce((s, d) => s + d.costNaira, 0);
      const totalDownload = daily.reduce((s, d) => s + d.downloadedMB, 0);
      const totalUpload = daily.reduce((s, d) => s + d.uploadedMB, 0);
      const avgDaily = daily.length > 0 ? totalMB / daily.length : 0;
      const peakDay = daily.reduce((max, d) => d.totalMB > max.totalMB ? d : max, daily[0]);

      // Active bundle info
      const activeBundle = settings.activeBundleId
        ? bundles.find((b) => b.id === settings.activeBundleId)
        : null;

      // Generate HTML
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #000; }
    .header h1 { font-size: 28px; margin-bottom: 4px; }
    .header p { color: #666; font-size: 13px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .summary-card { flex: 1; background: #f5f5f5; border-radius: 12px; padding: 16px; text-align: center; }
    .summary-card .value { font-size: 22px; font-weight: 800; }
    .summary-card .label { font-size: 11px; color: #666; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f5f5f5; padding: 8px; text-align: left; font-weight: 700; border-bottom: 2px solid #ddd; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #fafafa; }
    .bundle-status { background: #f0f7ff; border-radius: 12px; padding: 16px; border-left: 4px solid #000; }
    .footer { margin-top: 32px; text-align: center; color: #999; font-size: 10px; }
    .highlight { color: #E74C3C; font-weight: 700; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔥 DataGauge Report</h1>
    <p>${periodLabel} · ${carrier.name} · Generated ${new Date().toLocaleDateString('en-NG', { dateStyle: 'long' })}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="value">${formatBytes(totalMB * 1024 * 1024)}</div>
      <div class="label">Total Data Used</div>
    </div>
    <div class="summary-card">
      <div class="value highlight">${formatNaira(totalNaira)}</div>
      <div class="label">Total Cost</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatBytes(avgDaily * 1024 * 1024)}</div>
      <div class="label">Daily Average</div>
    </div>
    <div class="summary-card">
      <div class="value">${daily.length}</div>
      <div class="label">Days Tracked</div>
    </div>
  </div>

  ${config.includeBundleStatus && activeBundle ? `
  <div class="section">
    <h2>📦 Active Bundle</h2>
    <div class="bundle-status">
      <strong>${activeBundle.planName}</strong> · ${carrier.name}<br/>
      Used: ${formatBytes(activeBundle.usedMB * 1024 * 1024)} / ${formatBytes(activeBundle.totalMB * 1024 * 1024)}
      (${bundleUsedPercent(activeBundle.usedMB, activeBundle.totalMB).toFixed(0)}%)<br/>
      Cost: ${formatNaira(activeBundle.priceNaira)} · Expires in ${daysUntilExpiry(activeBundle.expiresAt)} days
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>📊 Daily Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Download</th>
          <th>Upload</th>
          <th>Total</th>
          <th>Cost</th>
          <th>Sessions</th>
        </tr>
      </thead>
      <tbody>
        ${daily.map((d) => `
        <tr>
          <td>${new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
          <td>${formatBytes(d.downloadedMB * 1024 * 1024)}</td>
          <td>${formatBytes(d.uploadedMB * 1024 * 1024)}</td>
          <td><strong>${formatBytes(d.totalMB * 1024 * 1024)}</strong></td>
          <td class="highlight">${formatNaira(d.costNaira)}</td>
          <td>${d.sessions}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${peakDay ? `
  <div class="section">
    <h2>📈 Peak Usage Day</h2>
    <p><strong>${new Date(peakDay.date).toLocaleDateString('en-NG', { dateStyle: 'full' })}</strong> — 
    ${formatBytes(peakDay.totalMB * 1024 * 1024)} (${formatNaira(peakDay.costNaira)})</p>
  </div>
  ` : ''}

  <div class="section">
    <h2>📋 Breakdown</h2>
    <table>
      <tr><td>Total Download</td><td><strong>${formatBytes(totalDownload * 1024 * 1024)}</strong></td></tr>
      <tr><td>Total Upload</td><td><strong>${formatBytes(totalUpload * 1024 * 1024)}</strong></td></tr>
      <tr><td>Download/Upload Ratio</td><td><strong>${totalUpload > 0 ? (totalDownload / totalUpload).toFixed(1) : '∞'}:1</strong></td></tr>
      <tr><td>Rate</td><td><strong>${formatNaira(plan?.nairaPerMB ?? 0.293)}/MB</strong></td></tr>
    </table>
  </div>

  <div class="footer">
    Generated by DataGauge v2.0 · Track. Alert. Save.
  </div>
</body>
</html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html });

      // Share
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Share DataGauge Report',
        });
      } else {
        Alert.alert('Success', 'Report saved to: ' + uri);
      }
    } catch (err) {
      console.error('[DataGauge] Export error:', err);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportReport, exporting };
}
