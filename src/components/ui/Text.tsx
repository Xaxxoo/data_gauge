import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';

interface Props extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'mono';
  color?: string;
}

export function Text({ variant = 'body', color, style, ...props }: Props) {
  const { colors } = useTheme();

  const variantColors = {
    h1: colors.textPrimary,
    h2: colors.textPrimary,
    h3: colors.textPrimary,
    body: colors.textSecondary,
    caption: colors.textMuted,
    mono: colors.textPrimary,
  };

  return (
    <RNText
      style={[styles[variant], { color: color || variantColors[variant] }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  h2: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  h3: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  mono: { fontSize: 13, fontFamily: 'monospace' },
});
