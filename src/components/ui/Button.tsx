import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../lib/theme';

interface Props extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  label,
  variant = 'primary',
  loading,
  icon,
  size = 'md',
  disabled,
  style,
  ...props
}: Props) {
  const { colors } = useTheme();

  const bgColor = {
    primary: colors.accent,
    secondary: colors.surface,
    danger: colors.danger,
    ghost: 'transparent',
  }[variant];

  const textColor = {
    primary: colors.bg,
    secondary: colors.textPrimary,
    danger: '#FFFFFF',
    ghost: colors.textPrimary,
  }[variant];

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bgColor },
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text style={[styles.label, { color: textColor }, size === 'sm' && styles.labelSm]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999 },
  lg: { paddingHorizontal: 32, paddingVertical: 20, borderRadius: 9999 },
  disabled: { opacity: 0.5 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  labelSm: { fontSize: 13 },
});
