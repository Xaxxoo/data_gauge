import { CARRIER_COLORS } from '../src/components/ui/colors';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../src/components/ScreenHeader';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { useGoodDollar } from '../src/hooks/useGoodDollar';
import { getVariations, buyData, type VTVariation } from '../src/lib/vtpass';
import { CARRIERS, getCarrier } from '../src/lib/carriers';
import {
  saveGDPurchase,
  getGDPurchases,
  generateId,
  type GDPurchase,
} from '../src/lib/storage';
import { formatNaira } from '../src/lib/dataCalc';
import type { CarrierId } from '../src/types';

const GD_GREEN = '#00C853';

const PLATFORM_WALLET = process.env.EXPO_PUBLIC_PLATFORM_WALLET ?? null;
const WALLET_CONFIGURED =
  !!PLATFORM_WALLET &&
  !/^0x0+$/.test(PLATFORM_WALLET) &&
  PLATFORM_WALLET.length === 42;

const IS_SANDBOX = process.env.EXPO_PUBLIC_VTPASS_SANDBOX !== 'false';

/** Parse a VTPass variation_amount string; returns 0 if the value is not a valid number. */
function parseAmount(raw: string): number {
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

type Step = 'select' | 'confirm' | 'paying' | 'done' | 'failed';

export default function BuyDataScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const gd = useGoodDollar();
  const [carrierId, setCarrierId] = useState<CarrierId>('mtn');
  const [variations, setVariations] = useState<VTVariation[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<VTVariation | null>(null);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [activePurchase, setActivePurchase] = useState<GDPurchase | null>(null);
  const [history, setHistory] = useState<GDPurchase[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const unwatchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoadingPlans(true);
    setSelectedPlan(null);
    getVariations(carrierId).then((v) => {
      setVariations(v);
      setLoadingPlans(false);
    });
  }, [carrierId]);

  const loadHistory = useCallback(async () => {
    const h = await getGDPurchases();
    setHistory(h.slice(0, 10));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    return () => {
      if (unwatchRef.current) unwatchRef.current();
    };
  }, []);

  const planCostG = selectedPlan
    ? gd.toG(parseAmount(selectedPlan.variation_amount))
    : 0;

  // Use contract credits if available, fall back to wallet balance
  const useContractCredits = gd.contractConfigured && gd.contractCredits >= planCostG;
  const canAfford = useContractCredits
    ? gd.contractCredits >= planCostG
    : gd.balance >= planCostG;

  function handleConfirm() {
    if (!WALLET_CONFIGURED) {
      Alert.alert('Not Configured', 'EXPO_PUBLIC_PLATFORM_WALLET is not set. The app cannot accept payments.');
      return;
    }
    if (!selectedPlan || !phone.trim()) {
      Alert.alert('Missing info', 'Select a plan and enter your phone number');
      return;
    }
    if (!/^0[789]\d{9}$/.test(phone.replace(/\s|-/g, ''))) {
      Alert.alert('Invalid number', 'Enter an 11-digit Nigerian number starting with 07, 08, or 09 (e.g. 08012345678)');
      return;
    }
    if (!canAfford) {
      Alert.alert(
        'Insufficient G$',
        `You need ${planCostG.toFixed(0)} G$ but only have ${gd.balance.toFixed(0)} G$. Claim more from the Earn tab.`
      );
      return;
    }
    setStep('confirm');
  }

  async function handlePay() {
    if (!selectedPlan) return;

    const purchase: GDPurchase = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      carrierId,
      planName: selectedPlan.name,
      amountNGN: parseAmount(selectedPlan.variation_amount),
      amountG: planCostG,
      phoneNumber: phone.trim(),
      status: 'pending',
    };
    await saveGDPurchase(purchase);
    setActivePurchase(purchase);
    setStep('paying');

    try {
      let txHash: string | undefined;

      if (useContractCredits && !IS_SANDBOX) {
        // ── On-chain spend via DataGaugeCredits contract ─────────
        const result = await gd.spendCredits(
          planCostG,
          selectedPlan.variation_code,
          phone.trim()
        );
        txHash = result.txHash;
        await saveGDPurchase({ ...purchase, status: 'paid', txHash });
      } else if (!IS_SANDBOX && WALLET_CONFIGURED) {
        // ── Legacy: manual send — watch blockchain for payment ───
        await saveGDPurchase({ ...purchase, status: 'paid', txHash: 'manual_send' });
        txHash = 'manual_send';
      }
      // Sandbox: skip on-chain step entirely

      // ── Call VTPass to deliver data ───────────────────────────
      const vtResult = await buyData(
        carrierId,
        purchase.phoneNumber,
        selectedPlan.variation_code,
        purchase.amountNGN
      );

      const final: GDPurchase = {
        ...purchase,
        status: vtResult.success ? 'delivered' : 'failed',
        transactionId: vtResult.transactionId,
        txHash,
      };
      await saveGDPurchase(final);
      setActivePurchase(final);
      setStep(vtResult.success ? 'done' : 'failed');
    } catch (err) {
      console.error('[BuyData] payment failed:', err);
      const failed: GDPurchase = { ...purchase, status: 'failed' };
      await saveGDPurchase(failed).catch(() => {});
      setActivePurchase(failed);
      setStep('failed');
      Alert.alert(
        'Payment failed',
        err instanceof Error ? err.message : 'Please try again'
      );
    }

    loadHistory();
    gd.refresh();
  }

  function reset() {
    setStep('select');
    setSelectedPlan(null);
    setPhone('');
    setActivePurchase(null);
    if (unwatchRef.current) {
      unwatchRef.current();
      unwatchRef.current = null;
    }
  }

  const carrierColor = CARRIER_COLORS[carrierId];

  // POST-PURCHASE RESULT
  if (step === 'done' || step === 'failed') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Buy Data" />
        <View style={styles.resultScreen}>
          <Ionicons
            name={step === 'done' ? 'checkmark-outline' : 'close-outline'}
            size={56}
            color={step === 'done' ? colors.success : colors.danger}
          />
          <Text variant="h2" style={{ textAlign: 'center' }}>
            {step === 'done' ? 'Data Delivered!' : 'Purchase Failed'}
          </Text>
          {activePurchase && (
            <Card style={styles.resultCard}>
              <Text variant="body">
                {step === 'done'
                  ? `${activePurchase.planName} sent to ${activePurchase.phoneNumber}`
                  : 'Your G$ was not charged. Please try again.'}
              </Text>
              {activePurchase.transactionId && (
                <Text style={styles.txId}>Ref: {activePurchase.transactionId}</Text>
              )}
            </Card>
          )}
          <Button label="Buy More Data" onPress={reset} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  // PAYING (on-chain tx + VTPass)
  if (step === 'paying') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Buy Data" />
        <View style={styles.resultScreen}>
          <ActivityIndicator size="large" color={GD_GREEN} />
          <Text variant="h3" style={{ textAlign: 'center', marginTop: 16 }}>
            {useContractCredits ? 'Signing transaction...' : 'Processing payment...'}
          </Text>
          <Text variant="body" style={{ textAlign: 'center' }}>
            {useContractCredits
              ? 'Confirm the transaction in your wallet. Delivery follows automatically.'
              : 'Calling VTPass to deliver your data bundle.'}
          </Text>
          {IS_SANDBOX && (
            <Badge label="SANDBOX MODE" color={colors.warning} size="md" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Buy Data" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="h1">Buy Data with G$</Text>
          <Text variant="body">
            Spend your GoodDollar earnings on real mobile data — MTN, Airtel, Glo, 9mobile
          </Text>

          {/* Wallet misconfiguration warning */}
          {!WALLET_CONFIGURED && (
            <Card style={styles.walletErrorCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning-outline" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>
                  Payments unavailable
                </Text>
              </View>
              <Text variant="body" style={{ marginTop: 4 }}>
                EXPO_PUBLIC_PLATFORM_WALLET is not configured. Set it in your .env file and rebuild the app before accepting payments.
              </Text>
            </Card>
          )}

          {/* Sandbox mode banner */}
          {IS_SANDBOX && (
            <Card style={styles.sandboxBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="flask-outline" size={16} color={colors.warning} />
                <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>
                  Sandbox mode — no real purchases
                </Text>
              </View>
              <Text variant="body" style={{ marginTop: 4 }}>
                Payments are simulated. Set EXPO_PUBLIC_VTPASS_SANDBOX=false and rebuild to go live.
              </Text>
            </Card>
          )}

          {/* G$ Balance + Contract Credits */}
          {gd.walletAddress ? (
            <View style={{ gap: 8 }}>
              <View style={styles.balancePill}>
                <Ionicons name="wallet-outline" size={13} color={GD_GREEN} />
                <Text style={styles.pillText}>
                  Wallet: {gd.balance.toFixed(0)} G$ ≈ ₦{gd.balanceNGN.toFixed(0)}
                </Text>
              </View>
              {gd.contractConfigured && (
                <View style={[styles.balancePill, { borderColor: gd.contractCredits > 0 ? GD_GREEN : '#444' }]}>
                  <Ionicons name="layers-outline" size={13} color={GD_GREEN} />
                  <Text style={styles.pillText}>
                    Credits: {gd.contractCredits.toFixed(0)} G$ ≈ ₦{gd.contractCreditsNGN.toFixed(0)}
                  </Text>
                  {gd.contractCredits > 0 && (
                    <Text style={{ fontSize: 10, color: GD_GREEN, fontWeight: '700' }}>● READY</Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <Card style={styles.noWalletCard}>
              <Text variant="body" style={{ textAlign: 'center' }}>
                Go to the <Text style={{ color: GD_GREEN, fontWeight: '700' }}>Earn</Text> tab first to connect your wallet
              </Text>
            </Card>
          )}

          {/* Carrier selector */}
          <Card>
            <Text variant="h3" style={{ marginBottom: 10 }}>Choose Carrier</Text>
            <View style={styles.carrierRow}>
              {CARRIERS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.carrierChip,
                    carrierId === c.id && {
                      backgroundColor: CARRIER_COLORS[c.id] + '18',
                      borderColor: CARRIER_COLORS[c.id],
                    },
                  ]}
                  onPress={() => setCarrierId(c.id as CarrierId)}
                >
                  <View style={[styles.carrierDot, { backgroundColor: CARRIER_COLORS[c.id] }]} />
                  <Text style={{
                    color: carrierId === c.id ? CARRIER_COLORS[c.id] : colors.textMuted,
                    fontWeight: '700',
                    fontSize: 12,
                  }}>
                    {c.name.replace(' Nigeria', '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Plan selector */}
          <Card>
            <Text variant="h3" style={{ marginBottom: 10 }}>Choose Bundle</Text>
            {loadingPlans ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              variations.map((v) => {
                const costG = gd.toG(parseAmount(v.variation_amount));
                const affordable = gd.balance >= costG;
                const isSelected = selectedPlan?.variation_code === v.variation_code;
                return (
                  <TouchableOpacity
                    key={v.variation_code}
                    style={[
                      styles.planRow,
                      isSelected && { backgroundColor: carrierColor + '18', borderColor: carrierColor },
                      !affordable && styles.planDisabled,
                    ]}
                    onPress={() => affordable && setSelectedPlan(v)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: affordable ? colors.textPrimary : colors.textMuted, fontWeight: '600', fontSize: 13 }}>
                        {v.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {formatNaira(parseAmount(v.variation_amount))}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: GD_GREEN, fontWeight: '800', fontSize: 14 }}>
                        {costG.toFixed(0)} G$
                      </Text>
                      {!affordable && (
                        <Text style={{ fontSize: 10, color: colors.danger }}>Need more G$</Text>
                      )}
                    </View>
                    {isSelected && <Ionicons name="checkmark-outline" size={16} color={carrierColor} style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              })
            )}
          </Card>

          {/* Phone number */}
          <Card>
            <Text variant="h3" style={{ marginBottom: 8 }}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 08012345678"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={14}
            />
            <Text variant="body" style={{ marginTop: 6 }}>
              Data will be delivered to this number on {getCarrier(carrierId).name}
            </Text>
          </Card>

          {/* Summary */}
          {selectedPlan && (
            <Card glow={carrierColor}>
              <Text variant="h3" style={{ marginBottom: 8 }}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text variant="body">Bundle</Text>
                <Text style={styles.summaryVal}>{selectedPlan.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="body">Network</Text>
                <Badge label={getCarrier(carrierId).name} color={carrierColor} size="sm" />
              </View>
              <View style={styles.summaryRow}>
                <Text variant="body">Price (NGN)</Text>
                <Text style={styles.summaryVal}>{formatNaira(parseAmount(selectedPlan.variation_amount))}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>You Pay (G$)</Text>
                <Text style={[styles.summaryVal, { color: GD_GREEN, fontSize: 20 }]}>
                  {planCostG.toFixed(0)} G$
                </Text>
              </View>
            </Card>
          )}

          <Button
            label="Continue to Payment"
            size="lg"
            onPress={handleConfirm}
            disabled={!selectedPlan || !phone.trim() || !gd.walletAddress || !WALLET_CONFIGURED}
          />

          {/* Purchase history */}
          {history.length > 0 && (
            <Card>
              <Text variant="h3" style={{ marginBottom: 10 }}>Recent Purchases</Text>
              {history.map((p) => (
                <View key={p.id} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: colors.textPrimary, fontSize: 13 }}>
                      {p.planName}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      {p.phoneNumber} · {new Date(p.timestamp).toLocaleDateString('en-NG')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: GD_GREEN, fontWeight: '700', fontSize: 12 }}>
                      {p.amountG.toFixed(0)} G$
                    </Text>
                    <Badge
                      label={p.status}
                      color={
                        p.status === 'delivered' ? colors.success
                        : p.status === 'failed' ? colors.danger
                        : colors.warning
                      }
                      size="sm"
                    />
                  </View>
                </View>
              ))}
            </Card>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirm modal */}
      <Modal visible={step === 'confirm'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedPlan && (
              <>
                <Text variant="h2" style={{ marginBottom: 4 }}>Confirm Purchase</Text>
                <Text variant="body" style={{ marginBottom: 16 }}>
                  {useContractCredits
                    ? 'Your wallet will sign one transaction to spend G$ credits, then data is delivered automatically.'
                    : IS_SANDBOX
                    ? 'Sandbox mode — no real G$ will be spent.'
                    : 'You\'re about to buy data using your G$ tokens.'}
                </Text>

                <Card style={styles.confirmSummary}>
                  <View style={styles.summaryRow}>
                    <Text variant="body">Bundle</Text>
                    <Text style={styles.summaryVal}>{selectedPlan.name}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text variant="body">Network</Text>
                    <Text style={[styles.summaryVal, { color: carrierColor }]}>
                      {getCarrier(carrierId).name}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text variant="body">Phone</Text>
                    <Text style={styles.summaryVal}>{phone}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text variant="body">Payment method</Text>
                    <Text style={[styles.summaryVal, { color: GD_GREEN, fontSize: 11 }]}>
                      {useContractCredits ? '● Contract Credits' : '● Wallet G$'}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Pay</Text>
                    <Text style={{ fontWeight: '900', color: GD_GREEN, fontSize: 22 }}>
                      {planCostG.toFixed(0)} G$
                    </Text>
                  </View>
                </Card>

                <View style={styles.modalActions}>
                  <Button label="Cancel" variant="ghost" onPress={() => setStep('select')} />
                  <Button label={useContractCredits ? 'Pay with Credits' : 'Confirm & Pay'} onPress={handlePay} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  resultScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  resultCard: { width: '100%' },
  txId: { fontSize: 10, color: colors.textMuted, marginTop: 4, fontFamily: 'monospace' },
  balancePill: { backgroundColor: GD_GREEN + '18', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: GD_GREEN + '55' },
  pillText: { color: GD_GREEN, fontWeight: '700', fontSize: 13 },
  noWalletCard: { alignItems: 'center', padding: 16 },
  carrierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carrierChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  carrierDot: { width: 8, height: 8, borderRadius: 4 },
  planRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  planDisabled: { opacity: 0.4 },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryTotal: { borderBottomWidth: 0, paddingTop: 10 },
  summaryVal: { fontWeight: '700', color: colors.textPrimary },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  confirmSummary: { marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  addressCard: { backgroundColor: colors.surface, borderColor: GD_GREEN + '44', borderWidth: 1, marginBottom: 16, alignItems: 'center', gap: 10 },
  platformAddr: { fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  copyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: GD_GREEN },
  payInstructions: { gap: 10, marginBottom: 16 },
  payStep: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  payStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: GD_GREEN, alignItems: 'center', justifyContent: 'center' },
  sandboxNote: { padding: 10, backgroundColor: colors.warning + '18', borderRadius: 8, marginBottom: 8 },
  walletErrorCard: { borderColor: colors.danger + '55', borderWidth: 1, backgroundColor: colors.danger + '0D' },
  sandboxBanner: { borderColor: colors.warning + '55', borderWidth: 1, backgroundColor: colors.warning + '0D' },
});
