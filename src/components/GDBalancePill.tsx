import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './ui/Text';
import { useTheme } from '../lib/theme';
import { useGoodDollar } from '../hooks/useGoodDollar';

const GD_GREEN = '#10B981';

export function GDBalancePill() {
  const router = useRouter();
  const gd = useGoodDollar();
  const { colors } = useTheme();

  if (gd.loading) {
    return (
      <TouchableOpacity style={styles.pill} onPress={() => router.push('/earn')} activeOpacity={0.7}>
        <ActivityIndicator size="small" color={colors.textPrimary} />
      </TouchableOpacity>
    );
  }

  if (!gd.walletAddress) {
    return (
      <TouchableOpacity style={[styles.pill, { backgroundColor: colors.border }]} onPress={() => router.push('/earn')} activeOpacity={0.7}>
        <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>Connect</Text>
      </TouchableOpacity>
    );
  }

  const shortAddr = gd.walletAddress.slice(0, 6) + '...' + gd.walletAddress.slice(-4);
  const ngnValue = gd.balanceNGN;

  return (
    <TouchableOpacity style={[styles.pill, { backgroundColor: colors.border }]} onPress={() => router.push('/earn')} activeOpacity={0.7}>
      <View style={[styles.dot, { backgroundColor: GD_GREEN }]} />
      <Text style={[styles.text, { color: colors.textPrimary }]}>
        {shortAddr}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 9999, // Pill shape
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Space between dot and text
    minHeight: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
