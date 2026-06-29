import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { useDataUsage } from '../src/hooks/useDataUsage';
import { useExportReport } from '../src/hooks/useExportReport';
import { GDBalancePill } from '../src/components/GDBalancePill';
import { formatBytes, formatNaira } from '../src/lib/dataCalc';
import type { DailyUsage, ExportConfig } from '../src/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = Math.min(SCREEN_WIDTH - 64, 400);

type ViewMode = 'daily' | 'weekly' | 'monthly';

function groupByWeek(daily: DailyUsage[]): Array<{ label: string; totalMB: number; costNaira: number; downloadMB: number; uploadMB: number; days: number }> {
  const weeks: Record<string, { totalMB: number; costNaira: number; downloadMB: number; uploadMB: number; days: number; startDate: string }> = {};

  for (const d of daily) {
    const date = new Date(d.date);
    // Week key: year + week number
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
    const key = `${date.getFullYear()}-W${weekNum}`;

    if (!weeks[key]) {
      weeks[key] = { totalMB: 0, costNaira: 0, downloadMB: 0, uploadMB: 0, days: 0, startDate: d.date };
    }
    weeks[key].totalMB += d.totalMB;
    weeks[key].costNaira += d.costNaira;
    weeks[key].downloadMB += d.downloadedMB;
    weeks[key].uploadMB += d.uploadedMB;
    weeks[key].days += 1;
  }

  return Object.entries(weeks).map(([key, val]) => ({
    label: `Week of ${new Date(val.startDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`,
    ...val,
  }));
}

export default function HistoryScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { dailyUsage, loading, reload } = useDataUsage();
  const { exportReport, exporting } = useExportReport();
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const data = dailyUsage.slice(0, 30).reverse();

  // Summary stats
  const totalMB = data.reduce((s, d) => s + d.totalMB, 0);
  const totalNaira = data.reduce((s, d) => s + d.costNaira, 0);
  const avgDaily = data.length > 0 ? totalMB / data.length : 0;
  const peakDay = data.reduce<DailyUsage | null>((max, d) => (!max || d.totalMB > max.totalMB) ? d : max, null);
  const totalDownload = data.reduce((s, d) => s + d.downloadedMB, 0);
  const totalUpload = data.reduce((s, d) => s + d.uploadedMB, 0);

  const weeklyData = groupByWeek(data);

  const handleExport = useCallback((period: ExportConfig['period']) => {
    setShowExportMenu(false);
    exportReport({
      period,
      includeCharts: false,
      includeBundleStatus: true,
      includeAudit: false,
    });
  }, [exportReport]);

  const maxMB = Math.max(...data.map((d) => d.totalMB), 1);
  const maxWeeklyMB = Math.max(...weeklyData.map((w) => w.totalMB), 1);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text variant="h1">History</Text>
            <Text variant="body">Your data usage over time</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <GDBalancePill />
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => setShowExportMenu(!showExportMenu)}
            >
              <Ionicons name="share-outline" size={18} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Export menu */}
        {showExportMenu && (
          <Card style={styles.exportMenu}>
            <Text variant="h3" style={{ marginBottom: 8 }}>Export Report</Text>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('week')}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={styles.exportOptionText}>This Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('month')}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={styles.exportOptionText}>This Month</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('all')}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={styles.exportOptionText}>All Time</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Summary stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard} glow={colors.accent}>
            <Text variant="caption">Total</Text>
            <Text style={styles.bigStat}>{formatBytes(totalMB * 1024 * 1024)}</Text>
            <Text style={styles.costStat}>{formatNaira(totalNaira)}</Text>
          </Card>
          <Card style={styles.statCard} glow={colors.warning}>
            <Text variant="caption">Avg/Day</Text>
            <Text style={styles.bigStat}>{formatBytes(avgDaily * 1024 * 1024)}</Text>
            <Text style={styles.costStat}>{formatNaira(avgDaily * (totalNaira / (totalMB || 1)))}</Text>
          </Card>
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text variant="caption">Peak Day</Text>
            <Text style={styles.bigStat}>{peakDay ? formatBytes(peakDay.totalMB * 1024 * 1024) : '—'}</Text>
            <Text style={styles.costStat}>
              {peakDay ? new Date(peakDay.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text variant="caption">↓/↑ Split</Text>
            <Text style={styles.bigStat}>{totalMB > 0 ? `${((totalDownload / totalMB) * 100).toFixed(0)}/${((totalUpload / totalMB) * 100).toFixed(0)}` : '—'}</Text>
            <Text style={styles.costStat}>Download/Upload %</Text>
          </Card>
        </View>

        {/* View mode tabs */}
        <View style={styles.tabRow}>
          {(['daily', 'weekly'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.tab, viewMode === mode && styles.tabActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text
                style={[
                  styles.tabText,
                  viewMode === mode && styles.tabTextActive,
                ]}
              >
                {mode === 'daily' ? 'Daily' : 'Weekly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Daily chart */}
        {viewMode === 'daily' && (
          <Card>
            <Text variant="h3" style={{ marginBottom: 4 }}>Last {data.length} Days</Text>
            <Text variant="body" style={{ marginBottom: 16 }}>Tap a bar for details</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[styles.chartContainer, { width: Math.max(CHART_WIDTH, data.length * 28) }]}>
                {data.map((d, i) => {
                  const downloadH = Math.max(2, (d.downloadedMB / maxMB) * 120);
                  const uploadH = Math.max(1, (d.uploadedMB / maxMB) * 120);
                  const isToday = i === data.length - 1;
                  return (
                    <View key={d.date} style={styles.barCol}>
                      <Text style={styles.barValue}>
                        {formatBytes(d.totalMB * 1024 * 1024, 0).split(' ')[0]}
                      </Text>
                      <View style={styles.stackedBar}>
                        <View style={[styles.barSegment, { height: uploadH, backgroundColor: colors.warning + '88' }]} />
                        <View style={[styles.barSegment, { height: downloadH, backgroundColor: isToday ? colors.accent : colors.accent + '55' }]} />
                      </View>
                      <Text style={styles.barDay}>
                        {new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={styles.legendText}>Download</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.warning + '88' }]} />
                <Text style={styles.legendText}>Upload</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Weekly chart */}
        {viewMode === 'weekly' && (
          <Card>
            <Text variant="h3" style={{ marginBottom: 4 }}>Weekly Totals</Text>
            <Text variant="body" style={{ marginBottom: 16 }}>Aggregated by week</Text>
            {weeklyData.map((w, i) => {
              const pct = (w.totalMB / maxWeeklyMB) * 100;
              return (
                <View key={i} style={styles.weekRow}>
                  <Text style={styles.weekLabel}>{w.label}</Text>
                  <View style={styles.weekBarContainer}>
                    <View style={[styles.weekBar, { width: `${pct}%` }]}>
                      <View style={[styles.weekBarInner, { flex: w.downloadMB }]} />
                      <View style={[styles.weekBarUpload, { flex: w.uploadMB || 0.01 }]} />
                    </View>
                  </View>
                  <View style={styles.weekStats}>
                    <Text style={styles.weekStatVal}>{formatBytes(w.totalMB * 1024 * 1024, 1)}</Text>
                    <Text style={styles.weekStatCost}>{formatNaira(w.costNaira)}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Daily detail list */}
        {viewMode === 'daily' && (
          <Card>
            <Text variant="h3" style={{ marginBottom: 12 }}>Daily Detail</Text>
            {data.slice().reverse().slice(0, 14).map((d) => (
              <View key={d.date} style={styles.detailRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailDate}>
                    {new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.detailSub}>
                    ↓{formatBytes(d.downloadedMB * 1024 * 1024, 1)} · ↑{formatBytes(d.uploadedMB * 1024 * 1024, 1)} · {d.sessions} sessions
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.detailTotal}>{formatBytes(d.totalMB * 1024 * 1024)}</Text>
                  <Text style={styles.detailCost}>{formatNaira(d.costNaira)}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {loading && data.length === 0 && (
          <Card style={styles.empty}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text variant="body" style={{ textAlign: 'center', marginTop: 8 }}>Loading history...</Text>
          </Card>
        )}

        {!loading && data.length === 0 && (
          <Card style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} />
            <Text variant="h3" style={{ textAlign: 'center' }}>No usage data yet</Text>
            <Text variant="body" style={{ textAlign: 'center' }}>
              Start tracking your data usage to see charts and trends here.
            </Text>
          </Card>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' as const },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exportBtn: { padding: 10, backgroundColor: colors.surface, borderRadius: 12 },
  exportMenu: { gap: 4 },
  exportOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  exportOptionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, gap: 4 },
  bigStat: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  costStat: { fontSize: 11, color: colors.textMuted },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: colors.accent + '12', borderColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.accent },
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, paddingTop: 20 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, minWidth: 24 },
  barValue: { fontSize: 7, color: colors.textMuted },
  stackedBar: { width: '65%', borderRadius: 3, overflow: 'hidden' },
  barSegment: { width: '100%' },
  barDay: { fontSize: 9, color: colors.textMuted },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textMuted },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  weekLabel: { width: 80, fontSize: 11, color: colors.textSecondary },
  weekBarContainer: { flex: 1, height: 20, backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
  weekBar: { height: '100%', flexDirection: 'row', borderRadius: 10, overflow: 'hidden' },
  weekBarInner: { backgroundColor: colors.accent, height: '100%' },
  weekBarUpload: { backgroundColor: colors.warning + '88', height: '100%' },
  weekStats: { width: 80, alignItems: 'flex-end' },
  weekStatVal: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  weekStatCost: { fontSize: 10, color: colors.textMuted },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailDate: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  detailSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  detailTotal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  detailCost: { fontSize: 11, color: colors.warning, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
});
