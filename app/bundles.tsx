import { CARRIER_COLORS } from '../src/components/ui/colors';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { UsageBar } from '../src/components/UsageBar';
import { CARRIERS, getCarrier, comparePlansAtTier } from '../src/lib/carriers';
import { useBundleRecommendation } from '../src/hooks/useBundleRecommendation';
import { GDBalancePill } from '../src/components/GDBalancePill';
import {
  getBundles,
  saveBundle,
  deleteBundle,
  updateBundleUsage,
  getSettings,
  saveSettings,
  generateId,
} from '../src/lib/storage';
import { formatNaira, formatBytes, daysUntilExpiry, bundleRemainingMB } from '../src/lib/dataCalc';
import type { ActiveBundle, CarrierId } from '../src/types';

export default function BundlesScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [bundles, setBundles] = useState<ActiveBundle[]>([]);
  const [settings, setSettings] = useState<{ selectedCarrierId: CarrierId; selectedPlanId: string; activeBundleId: string | null } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLogUsage, setShowLogUsage] = useState<ActiveBundle | null>(null);
  const [form, setForm] = useState({
    carrierId: 'mtn' as CarrierId,
    planId: '',
    customGB: '',
    customPrice: '',
    usedMB: '',
    validityDays: '30',
  });
  const [logMB, setLogMB] = useState('');
  const { recommendations, projectedMonthlyMB, loading: recsLoading } = useBundleRecommendation();

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([getBundles(), getSettings()]);
    setBundles(b);
    setSettings({ selectedCarrierId: s.selectedCarrierId, selectedPlanId: s.selectedPlanId, activeBundleId: s.activeBundleId });
  }, []);

  useEffect(() => { load(); }, [load]);

  const carrier = getCarrier(form.carrierId);
  const selectedPlan = carrier.plans.find((p) => p.id === form.planId) ?? carrier.plans[0];

  async function addBundle() {
    const totalMB = form.customGB
      ? parseFloat(form.customGB) * 1024
      : (selectedPlan.dataGB * 1024);
    const price = form.customPrice
      ? parseFloat(form.customPrice)
      : selectedPlan.priceNaira;
    const usedMB = parseFloat(form.usedMB) || 0;
    const validity = parseInt(form.validityDays) || 30;

    if (isNaN(totalMB) || totalMB <= 0) {
      Alert.alert('Error', 'Enter a valid data amount');
      return;
    }

    const now = new Date();
    const expires = new Date(now.getTime() + validity * 24 * 60 * 60 * 1000);

    const bundle: ActiveBundle = {
      id: generateId(),
      carrierId: form.carrierId,
      planId: form.planId || selectedPlan.id,
      planName: form.customGB
        ? `${form.customGB}GB Custom`
        : selectedPlan.name,
      totalMB,
      usedMB,
      purchasedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      priceNaira: price,
      nairaPerMB: price / totalMB,
    };

    await saveBundle(bundle);
    await saveSettings({ activeBundleId: bundle.id });
    setShowAdd(false);
    setForm({ carrierId: 'mtn', planId: '', customGB: '', customPrice: '', usedMB: '', validityDays: '30' });
    load();
  }

  async function setActive(id: string) {
    await saveSettings({ activeBundleId: id });
    load();
  }

  async function remove(id: string) {
    Alert.alert('Delete Bundle', 'Remove this bundle?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteBundle(id); load(); },
      },
    ]);
  }

  async function logUsage() {
    if (!showLogUsage) return;
    const mb = parseFloat(logMB);
    if (isNaN(mb) || mb <= 0) return;
    await updateBundleUsage(showLogUsage.id, showLogUsage.usedMB + mb);
    setShowLogUsage(null);
    setLogMB('');
    load();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Bundles" right={<GDBalancePill />} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text variant="h1">My Bundles</Text>
          <Button label="+ Add" size="sm" onPress={() => setShowAdd(true)} />
        </View>
        <Text variant="body">Track your purchased data bundles and remaining balance</Text>

        {/* Recommended Plans */}
        {recommendations.length > 0 && (
          <Card glow={colors.success} style={styles.recsCard}>
            <View style={styles.recsHeader}>
              <Ionicons name="diamond-outline" size={16} color={colors.success} />
              <Text variant="h3">Recommended Plans</Text>
            </View>
            <Text variant="body" style={{ marginBottom: 12 }}>
              Based on your usage of {formatBytes(projectedMonthlyMB * 1024 * 1024)}/month:
            </Text>
            {recommendations.map((rec) => (
              <View key={`${rec.carrierId}-${rec.plan.id}-${rec.type}`} style={styles.recRow}>
                <View style={styles.recBadgeCol}>
                  <Badge
                    label={rec.label}
                    color={rec.type === 'budget_pick' ? colors.success : rec.type === 'best_fit' ? colors.accent : colors.warning}
                    size="sm"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recPlan}>{rec.plan.name}</Text>
                  <Text style={styles.recCarrier}>{rec.carrierName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recPrice}>{formatNaira(rec.plan.priceNaira)}</Text>
                  {rec.savingsNaira > 0 && (
                    <Text style={styles.recSavings}>Save {formatNaira(rec.savingsNaira)}/mo</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {bundles.length === 0 && (
          <Card style={styles.empty}>
            <Ionicons name="layers-outline" size={40} color={colors.textMuted} />
            <Text variant="h3" style={{ textAlign: 'center' }}>No bundles yet</Text>
            <Text variant="body" style={{ textAlign: 'center' }}>
              Add your active data bundle to track how much you've used
            </Text>
            <Button label="Add Bundle" onPress={() => setShowAdd(true)} style={{ marginTop: 8 }} />
          </Card>
        )}

        {bundles.map((bundle) => {
          const isActive = settings?.activeBundleId === bundle.id;
          const carrierColor = CARRIER_COLORS[bundle.carrierId];
          const daysLeft = daysUntilExpiry(bundle.expiresAt);
          const remainingMB = bundleRemainingMB(bundle.usedMB, bundle.totalMB);

          return (
            <Card key={bundle.id} glow={isActive ? carrierColor : undefined} style={styles.bundleCard}>
              <View style={styles.bundleHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.bundleNameRow}>
                    <Text variant="h3">{bundle.planName}</Text>
                    {isActive && <Badge label="Active" color={carrierColor} size="sm" />}
                  </View>
                  <Badge label={getCarrier(bundle.carrierId).name} color={carrierColor} size="sm" />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.daysLeft, { color: daysLeft <= 3 ? colors.danger : colors.textMuted }]}>
                    {daysLeft}d left
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {formatNaira(bundle.priceNaira)}
                  </Text>
                </View>
              </View>

              <UsageBar
                label=""
                usedMB={bundle.usedMB}
                totalMB={bundle.totalMB}
                nairaPerMB={bundle.nairaPerMB}
                color={carrierColor}
              />

              <View style={styles.bundleActions}>
                {!isActive && (
                  <Button label="Set Active" size="sm" variant="secondary" onPress={() => setActive(bundle.id)} />
                )}
                <Button
                  label="Log Usage"
                  size="sm"
                  variant="secondary"
                  onPress={() => setShowLogUsage(bundle)}
                />
                <Button label="Delete" size="sm" variant="danger" onPress={() => remove(bundle.id)} />
              </View>
            </Card>
          );
        })}

        {/* Carrier comparison */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 12 }}>1GB Price Comparison</Text>
          <Text variant="body" style={{ marginBottom: 12 }}>
            Compare what you'd pay per GB across all Nigerian carriers
          </Text>
          {comparePlansAtTier(1).map(({ carrier, plan }) => (
            <View key={carrier.id} style={styles.compareRow}>
              <Badge label={carrier.name} color={CARRIER_COLORS[carrier.id]} size="sm" />
              <View style={styles.compareRight}>
                {plan ? (
                  <>
                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                      {formatNaira(plan.priceNaira)}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted }}>
                      {formatNaira(plan.nairaPerMB)}/MB
                    </Text>
                  </>
                ) : (
                  <Text variant="body">—</Text>
                )}
              </View>
            </View>
          ))}
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add Bundle Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text variant="h2" style={{ marginBottom: 4 }}>Add Bundle</Text>
            <Text variant="body" style={{ marginBottom: 16 }}>Enter your purchased data bundle details</Text>

            <Text variant="caption" style={{ marginBottom: 6 }}>Carrier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={styles.carrierPicker}>
                {CARRIERS.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.carrierChip,
                      form.carrierId === c.id && { backgroundColor: CARRIER_COLORS[c.id] + '18', borderColor: CARRIER_COLORS[c.id] },
                    ]}
                    onPress={() => setForm((f) => ({ ...f, carrierId: c.id as CarrierId, planId: '' }))}
                  >
                    <Text style={{ color: form.carrierId === c.id ? CARRIER_COLORS[c.id] : colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text variant="caption" style={{ marginBottom: 6 }}>Plan</Text>
            <ScrollView style={{ maxHeight: 120, marginBottom: 12 }}>
              {getCarrier(form.carrierId).plans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planOption,
                    form.planId === plan.id && { backgroundColor: colors.accent + '12', borderColor: colors.accent },
                  ]}
                  onPress={() => setForm((f) => ({ ...f, planId: plan.id, customGB: '', customPrice: '' }))}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{plan.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{formatNaira(plan.nairaPerMB)}/MB</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text variant="caption" style={{ marginBottom: 4 }}>Or enter custom amount (GB)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1.5"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={form.customGB}
              onChangeText={(t) => setForm((f) => ({ ...f, customGB: t }))}
            />

            <Text variant="caption" style={{ marginBottom: 4, marginTop: 8 }}>Price paid (₦)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 300"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={form.customPrice}
              onChangeText={(t) => setForm((f) => ({ ...f, customPrice: t }))}
            />

            <Text variant="caption" style={{ marginBottom: 4, marginTop: 8 }}>Already used (MB, optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={form.usedMB}
              onChangeText={(t) => setForm((f) => ({ ...f, usedMB: t }))}
            />

            <Text variant="caption" style={{ marginBottom: 4, marginTop: 8 }}>Validity (days)</Text>
            <TextInput
              style={styles.input}
              placeholder="30"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={form.validityDays}
              onChangeText={(t) => setForm((f) => ({ ...f, validityDays: t }))}
            />

            <View style={styles.modalActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setShowAdd(false)} />
              <Button label="Add Bundle" onPress={addBundle} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Log Usage Modal */}
      <Modal visible={!!showLogUsage} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text variant="h2">Log Usage</Text>
            <Text variant="body" style={{ marginBottom: 16 }}>
              How much data did you use? (MB)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={logMB}
              onChangeText={setLogMB}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button label="Cancel" variant="ghost" onPress={() => { setShowLogUsage(null); setLogMB(''); }} />
              <Button label="Log It" onPress={logUsage} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  bundleCard: { gap: 12 },
  bundleHeader: { flexDirection: 'row', gap: 12 },
  bundleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  daysLeft: { fontSize: 12, fontWeight: '700' },
  bundleActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  compareRight: { alignItems: 'flex-end' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  carrierPicker: { flexDirection: 'row', gap: 8 },
  carrierChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  planOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  recsCard: { gap: 8 },
  recsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  recBadgeCol: { width: 80 },
  recPlan: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  recCarrier: { fontSize: 11, color: colors.textMuted },
  recPrice: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  recSavings: { fontSize: 11, color: colors.success, fontWeight: '600' },
});
