import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const isDisabled = disabled || loading;
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        !isSecondary && !isDisabled && shadow.button,
        pressed && !isDisabled && styles.pressed,
        isDisabled && (isSecondary ? styles.secondaryDisabled : styles.primaryDisabled),
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={isSecondary ? colors.primary : colors.white}
            style={styles.spinner}
          />
        )}
        <Text
          style={[
            styles.label,
            isSecondary && styles.secondaryLabel,
            isDisabled && !isSecondary && styles.primaryDisabledLabel,
            isDisabled && isSecondary && styles.secondaryDisabledLabel,
          ]}
        >
          {loading ? 'Please wait…' : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  primaryDisabled: { backgroundColor: colors.borderStrong },
  secondaryDisabled: { borderColor: colors.border, opacity: 0.6 },
  content: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: 10 },
  label: { color: colors.white, fontSize: 16.5, fontWeight: '700', letterSpacing: 0.2 },
  secondaryLabel: { color: colors.primary },
  primaryDisabledLabel: { color: '#F1F5F9' },
  secondaryDisabledLabel: { color: colors.textFaint },
});
