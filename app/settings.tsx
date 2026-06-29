import { CARRIER_COLORS } from '../src/components/ui/colors';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { CARRIERS, getCarrier, getPlan } from '../src/lib/carriers';
import { getSettings, saveSettings, clearAllData } from '../src/lib/storage';
import { formatNaira } from '../src/lib/dataCalc';
import { GDBalancePill } from '../src/components/GDBalancePill';
import type { AppSettings, CarrierId } from '../src/types';

export default function SettingsScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [customRate, setCustomRate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    setCustomRate(s.customNairaPerMB != null ? String(s.customNairaPerMB) : '');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function update(changes: Partial<AppSettings>) {
    setSaving(true);
    await saveSettings(changes);
    await load();
    setSaving(false);
  }

  async function applyCustomRate() {
    const rate = parseFloat(customRate);
    if (customRate === '') {
      await update({ customNairaPerMB: null });
    } else if (!isNaN(rate) && rate > 0) {
      await update({ customNairaPerMB: rate });
    } else {
      Alert.alert('Invalid', 'Enter a valid rate (₦ per MB)');
    }
  }

  async function clearData() {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your bundles, sessions, and audit entries. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            load();
          },
        },
      ]
    );
  }

  if (!settings) return null;

  const activeCarrier = getCarrier(settings.selectedCarrierId);
  const activePlan = getPlan(settings.selectedCarrierId, settings.selectedPlanId);
  const effectiveRate = settings.customNairaPerMB ?? activePlan?.nairaPerMB ?? 0.293;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text variant="h1">Settings</Text>
          <GDBalancePill />
        </View>
        <Text variant="body">Configure your carrier and pricing</Text>

        {/* Appearance */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 12 }}>Appearance</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.threshChip,
                  { flex: 1 },
                  mode === m && {
                    backgroundColor: colors.accent + '18',
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => setMode(m)}
              >
                <Text style={{ color: mode === m ? colors.accent : colors.textMuted, fontWeight: '700', textTransform: 'capitalize' }}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Carrier selection */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 12 }}>Your Network</Text>
          <View style={styles.carrierGrid}>
            {CARRIERS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.carrierCard,
                  settings.selectedCarrierId === c.id && {
                    borderColor: CARRIER_COLORS[c.id],
                    backgroundColor: CARRIER_COLORS[c.id] + '18',
                  },
                ]}
                onPress={() => update({ selectedCarrierId: c.id as CarrierId })}
              >
                <View style={[styles.carrierDot, { backgroundColor: CARRIER_COLORS[c.id] }]} />
                <Text style={{ color: settings.selectedCarrierId === c.id ? CARRIER_COLORS[c.id] : colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Plan selection */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 12 }}>Your Plan</Text>
          <Text variant="body" style={{ marginBottom: 10 }}>
            Choose your active data plan to set the ₦/MB rate automatically
          </Text>
          <ScrollView style={{ maxHeight: 220 }}>
            {activeCarrier.plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planRow,
                  settings.selectedPlanId === plan.id && {
                    backgroundColor: CARRIER_COLORS[settings.selectedCarrierId] + '18',
                    borderColor: CARRIER_COLORS[settings.selectedCarrierId],
                  },
                ]}
                onPress={() => update({ selectedPlanId: plan.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>{plan.name}</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>
                    {plan.validityDays} days · {formatNaira(plan.nairaPerMB)}/MB
                  </Text>
                </View>
                {settings.selectedPlanId === plan.id && (
                  <Ionicons name="checkmark-outline" size={16} color={CARRIER_COLORS[settings.selectedCarrierId]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>

        {/* Custom rate */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 4 }}>Custom ₦/MB Rate</Text>
          <Text variant="body" style={{ marginBottom: 12 }}>
            Override the automatic rate from your plan. Leave blank to use plan rate.
          </Text>
          <View style={styles.rateRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={`Auto: ₦${activePlan?.nairaPerMB.toFixed(4) ?? '0.293'}/MB`}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={customRate}
              onChangeText={setCustomRate}
            />
            <Button label="Apply" size="sm" onPress={applyCustomRate} loading={saving} />
          </View>
          <View style={styles.effectiveRate}>
            <Text variant="caption">Effective rate:</Text>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>
              {formatNaira(effectiveRate)}/MB = {formatNaira(effectiveRate * 1024)}/GB
            </Text>
          </View>
          {settings.customNairaPerMB != null && (
            <TouchableOpacity onPress={() => { setCustomRate(''); update({ customNairaPerMB: null }); }}>
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>× Remove custom rate</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Alert threshold */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 4 }}>Usage Alert</Text>
          <Text variant="body" style={{ marginBottom: 12 }}>
            Alert when bundle reaches this usage percentage
          </Text>
          <View style={styles.thresholdRow}>
            {[50, 70, 80, 90].map((pct) => (
              <TouchableOpacity
                key={pct}
                style={[
                  styles.threshChip,
                  settings.alertThresholdPercent === pct && {
                    backgroundColor: colors.accent + '18',
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => update({ alertThresholdPercent: pct })}
              >
                <Text style={{ color: settings.alertThresholdPercent === pct ? colors.accent : colors.textMuted, fontWeight: '700' }}>
                  {pct}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>



        {/* Carrier data comparison */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 12 }}>All Plans Comparison</Text>
          <Text variant="body" style={{ marginBottom: 12 }}>Rate per MB across all Nigerian carriers</Text>
          {CARRIERS.flatMap((c) =>
            c.plans.slice(0, 3).map((p) => ({
              carrier: c,
              plan: p,
              key: p.id,
            }))
          )
            .sort((a, b) => a.plan.nairaPerMB - b.plan.nairaPerMB)
            .slice(0, 10)
            .map(({ carrier, plan, key }) => (
              <View key={key} style={styles.compareRow}>
                <Badge label={carrier.name} color={CARRIER_COLORS[carrier.id]} size="sm" />
                <Text style={{ flex: 1, marginLeft: 8, fontSize: 12, color: colors.textSecondary }}>
                  {plan.name}
                </Text>
                <Text style={{ fontWeight: '700', color: colors.textPrimary, fontSize: 12 }}>
                  {formatNaira(plan.nairaPerMB)}/MB
                </Text>
              </View>
            ))}
        </Card>

        {/* Danger zone */}
        <Card style={styles.dangerCard}>
          <Text variant="h3" color={colors.danger}>Danger Zone</Text>
          <Text variant="body" style={{ marginTop: 4 }}>
            Clear all your saved bundles, sessions, audit entries, and speed test history.
            This cannot be undone.
          </Text>
          <Button
            label="Clear All Data"
            variant="danger"
            onPress={clearData}
            style={{ marginTop: 12 }}
          />
        </Card>

        {/* App info */}
        <View style={styles.appInfo}>
          <Text variant="caption" style={{ textAlign: 'center' }}>DataGauge v2.0</Text>
          <Text variant="body" style={{ textAlign: 'center' }}>
            Track. Alert. Save. Built for Nigerians and Africans who want data transparency.
            NCC complaints: ncc.gov.ng
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' as const },
  carrierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  carrierCard: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  carrierDot: { width: 10, height: 10, borderRadius: 5 },
  planRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  rateRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  effectiveRate: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  thresholdRow: { flexDirection: 'row', gap: 10 },
  threshChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  dangerCard: { borderColor: colors.danger + '44', borderWidth: 1 },
  appInfo: { gap: 6, paddingVertical: 8 },
});
