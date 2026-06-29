import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { useGoodDollar } from '../src/hooks/useGoodDollar';
import { GD_URLS } from '../src/lib/gooddollar';

const GD_GREEN = '#00C853';
const GD_BLUE = '#1976D2';

// Minimal EIP-1193 provider interface (MetaMask / MiniPay / Valora injected wallet)
interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export default function EarnScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const gd = useGoodDollar();
  const [showWalletInput, setShowWalletInput] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const openInBrowser = useCallback(async (url: string) => {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.surface,
      controlsColor: GD_GREEN,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
    });
    gd.refresh();
  }, [gd]);

  async function connectWeb3Wallet() {
    if (typeof window !== 'undefined' && window.ethereum) {
      setIsConnecting(true);
      try {
        const result = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = result as string[];
        if (accounts && accounts.length > 0) {
          await gd.setWallet(accounts[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not connect to wallet';
        Alert.alert('Connection Failed', message);
      } finally {
        setIsConnecting(false);
      }
    } else {
      setShowWalletInput(true);
    }
  }

  async function handleSetWallet() {
    if (!addressInput.trim()) return;
    setSaving(true);
    try {
      await gd.setWallet(addressInput.trim());
      setShowWalletInput(false);
      setAddressInput('');
    } catch (e) {
      Alert.alert('Invalid address', e instanceof Error ? e.message : 'Check the address and try again');
    }
    setSaving(false);
  }

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    setAddressInput(text ?? '');
  }

  const balanceNGN = gd.balanceNGN;
  const rate1000G = gd.toNGN(1000).toFixed(0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View>
          <Text variant="h1">Earn G$</Text>
          <Text variant="body">
            Claim free daily GoodDollar UBI — then use it to buy data
          </Text>
        </View>

        {/* What is G$? */}
        <Card style={styles.introCard}>
          <View style={styles.introHeader}>
            <View style={[styles.gdLogo, { backgroundColor: GD_GREEN + '18' }]}>
              <Text style={styles.gdLogoText}>G$</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">GoodDollar UBI</Text>
              <Text variant="body">Free money for verified humans</Text>
            </View>
          </View>
          <Text variant="body" style={{ marginTop: 8 }}>
            GoodDollar is a blockchain-based Universal Basic Income. Anyone who
            completes face verification gets a free daily claim of G$ tokens —
            no subscription, no payment required.
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: GD_GREEN }]}>500,000+</Text>
              <Text variant="caption">Verified users</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: GD_GREEN }]}>Daily</Text>
              <Text variant="caption">Claim frequency</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: GD_GREEN }]}>Celo</Text>
              <Text variant="caption">Blockchain</Text>
            </View>
          </View>
        </Card>

        {/* Wallet section */}
        {!gd.walletAddress ? (
          <Card glow={GD_GREEN} style={styles.connectCard}>
            <Ionicons name="link-outline" size={36} color={GD_GREEN} />
            <Text variant="h3" style={{ textAlign: 'center' }}>Connect your Celo wallet</Text>
            <Text variant="body" style={{ textAlign: 'center' }}>
              Connect via MiniPay, MetaMask, or paste your address manually.
            </Text>
            <Button
              label={typeof window !== 'undefined' && window.ethereum ? "Connect Web3 Wallet" : "Enter Wallet Address"}
              onPress={connectWeb3Wallet}
              loading={isConnecting}
              style={{ marginTop: 8, width: '100%' }}
            />
            {typeof window !== 'undefined' && window.ethereum && (
              <Button
                label="Enter Address Manually"
                variant="ghost"
                onPress={() => setShowWalletInput(true)}
                style={{ marginTop: 4, width: '100%' }}
              />
            )}
            <TouchableOpacity
              style={styles.noWalletLink}
              onPress={() => openInBrowser(GD_URLS.walletApp)}
            >
              <Text style={{ color: GD_GREEN, fontSize: 13 }}>
                Don't have a Celo wallet? Get one →
              </Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <>
            {/* G$ Balance card */}
            <Card glow={GD_GREEN}>
              <View style={styles.balanceHeader}>
                <View>
                  <Text variant="caption">Your G$ Balance</Text>
                  <Text style={styles.bigBalance}>
                    {gd.balance.toLocaleString('en-NG', { maximumFractionDigits: 2 })} G$
                  </Text>
                  <Text style={styles.ngnValue}>
                    ≈ ₦{balanceNGN.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
                <View style={styles.balanceRight}>
                  <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={gd.refresh}
                    disabled={gd.refreshing}
                  >
                    <Text style={{ color: GD_GREEN, fontSize: 12 }}>
                      {gd.refreshing ? 'Refreshing...' : '↻ Refresh'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.rateLabel}>
                    1,000 G$ ≈ ₦{rate1000G}
                  </Text>
                </View>
              </View>

              {/* Wallet address */}
              <View style={styles.addressRow}>
                <Text style={styles.addressText} numberOfLines={1}>
                  {gd.walletAddress}
                </Text>
                <TouchableOpacity onPress={() => { setAddressInput(gd.walletAddress ?? ''); setShowWalletInput(true); }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Change</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Verification status */}
            <Card glow={gd.verified ? GD_GREEN : colors.warning}>
              <View style={styles.verifyRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.verifyTitleRow}>
                    <Ionicons
                      name={gd.verified ? 'checkmark-outline' : 'alert-outline'}
                      size={18}
                      color={gd.verified ? GD_GREEN : colors.warning}
                    />
                    <Text variant="h3">
                      {gd.verified ? 'Identity Verified' : 'Verification Required'}
                    </Text>
                  </View>
                  <Text variant="body" style={{ marginTop: 4 }}>
                    {gd.verified
                      ? 'You are whitelisted on GoodDollar. You can claim daily G$.'
                      : 'Complete a 2-second face scan to unlock daily G$ claims. Free, private, one-time.'}
                  </Text>
                </View>
              </View>
              {!gd.verified && (
                <Button
                  label="Verify My Identity (Face Scan)"
                  onPress={() => openInBrowser(GD_URLS.verify)}
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>

            {/* Claimable today */}
            <Card glow={gd.claimable > 0 ? GD_GREEN : colors.border}>
              <View style={styles.claimRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption">Today's Claim</Text>
                  <Text style={[styles.claimAmount, { color: gd.claimable > 0 ? GD_GREEN : colors.textMuted }]}>
                    {gd.claimable > 0 ? `+${gd.claimable.toFixed(2)} G$` : 'Already claimed today'}
                  </Text>
                  {gd.claimable > 0 && (
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      ≈ ₦{gd.toNGN(gd.claimable).toFixed(0)}
                    </Text>
                  )}
                </View>
                <Button
                  label={gd.claimable > 0 ? 'Claim Now' : 'Come Back Tomorrow'}
                  size="sm"
                  variant={gd.claimable > 0 ? 'primary' : 'secondary'}
                  disabled={!gd.verified || gd.claimable === 0}
                  onPress={() => openInBrowser(GD_URLS.claim)}
                />
              </View>
              {!gd.verified && (
                <Text style={styles.claimHint}>Verify identity first to enable claiming</Text>
              )}
            </Card>
          </>
        )}

        {/* How it works */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 12 }}>How to earn G$ and buy data</Text>
          {([
            { n: '1', icon: 'link' as const, title: 'Connect wallet', desc: 'Add your Celo wallet address above' },
            { n: '2', icon: 'person-add-outline' as const, title: 'Verify identity', desc: '2-second face scan on GoodDollar — one time only' },
            { n: '3', icon: 'gift-outline' as const, title: 'Claim daily G$', desc: 'Get free G$ every day just for being human' },
            { n: '4', icon: 'newspaper-outline' as const, title: 'Buy data', desc: 'Use G$ to top up MTN, Airtel, Glo or 9mobile directly in DataMileage' },
          ]).map((step) => (
            <View key={step.n} style={styles.howStep}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={step.icon} size={14} color={colors.textPrimary} />
                  <Text style={styles.stepTitle}>{step.title}</Text>
                </View>
                <Text variant="body">{step.desc}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Rate info */}
        <Card style={styles.rateCard}>
          <Text variant="caption" color={GD_GREEN}>Current G$ Exchange Rate</Text>
          <View style={styles.rateGrid}>
            <View style={styles.rateItem}>
              <Text style={styles.rateVal}>${gd.priceUSD.toFixed(5)}</Text>
              <Text variant="caption">1 G$ in USD</Text>
            </View>
            <View style={styles.rateItem}>
              <Text style={styles.rateVal}>₦{gd.usdToNGN.toLocaleString()}</Text>
              <Text variant="caption">1 USD in NGN</Text>
            </View>
            <View style={styles.rateItem}>
              <Text style={[styles.rateVal, { color: GD_GREEN }]}>
                ₦{gd.toNGN(1).toFixed(4)}
              </Text>
              <Text variant="caption">1 G$ in NGN</Text>
            </View>
          </View>
          <Text style={styles.rateSrc}>Source: CoinGecko + ExchangeRate-API</Text>
        </Card>

        {/* Open GoodDollar */}
        <Button
          label="Open GoodDollar Website"
          variant="secondary"
          onPress={() => openInBrowser(GD_URLS.learnMore)}
        />

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Wallet input modal */}
      <Modal visible={showWalletInput} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text variant="h2">Celo Wallet Address</Text>
            <Text variant="body" style={{ marginBottom: 16 }}>
              Enter your Celo wallet address (starts with 0x). You can get one from
              Valora, MetaMask, or any Celo-compatible wallet.
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="0x..."
                placeholderTextColor={colors.textMuted}
                value={addressInput}
                onChangeText={setAddressInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button label="Paste" size="sm" variant="secondary" onPress={handlePaste} />
            </View>
            <Text variant="body" style={{ marginTop: 8, marginBottom: 4 }}>
              Your address is stored locally on your device only.
            </Text>
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => { setShowWalletInput(false); setAddressInput(''); }}
              />
              <Button
                label="Save"
                onPress={handleSetWallet}
                loading={saving}
                disabled={!addressInput.trim()}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' as const },
  introCard: {},
  introHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gdLogo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  gdLogoText: { fontSize: 16, fontWeight: '900', color: GD_GREEN },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: 16, fontWeight: '800' },
  connectCard: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  noWalletLink: { marginTop: 4 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bigBalance: { fontSize: 28, fontWeight: '900', color: GD_GREEN },
  ngnValue: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  balanceRight: { alignItems: 'flex-end', gap: 6 },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: GD_GREEN + '44' },
  rateLabel: { fontSize: 10, color: colors.textMuted },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  addressText: { flex: 1, fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  verifyRow: { flexDirection: 'row', gap: 10 },
  verifyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  claimAmount: { fontSize: 24, fontWeight: '800' },
  claimHint: { fontSize: 11, color: colors.warning, marginTop: 8, textAlign: 'center' },
  howStep: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: GD_GREEN, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#000', fontWeight: '900', fontSize: 13 },
  stepTitle: { fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  rateCard: {},
  rateGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  rateItem: { alignItems: 'center', gap: 2 },
  rateVal: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rateSrc: { fontSize: 10, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: colors.border, fontFamily: 'monospace' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
});
