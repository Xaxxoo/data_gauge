import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../lib/theme';

interface Props {
  label: string;
  color?: string;
  bg?: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, color, bg, size = 'sm' }: Props) {
  const { colors } = useTheme();
  const activeColor = color || colors.textPrimary;

  return (
    <View style={[styles.badge, { backgroundColor: bg ?? `${activeColor}18` }, size === 'md' && styles.md]}>
      <Text style={[styles.text, { color: activeColor }, size === 'md' && styles.textMd]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  md: { paddingHorizontal: 10, paddingVertical: 5 },
  text: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  textMd: { fontSize: 12 },
});
