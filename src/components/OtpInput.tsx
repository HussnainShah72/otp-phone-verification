import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  value: string;
  onChange: (next: string) => void;
  length: number;
  editable?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
};

/**
 * Six digit boxes drawn on screen, with one transparent TextInput stretched
 * across them. Using a single input (rather than one per digit) means paste,
 * backspace and the platform's SMS autofill all behave the way users expect.
 */
export default function OtpInput({
  value,
  onChange,
  length,
  editable = true,
  hasError = false,
  autoFocus = true,
  onComplete,
}: Props) {
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!autoFocus) return;
    // Give the screen a frame to mount before pulling up the keyboard.
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) {
      inputRef.current?.blur();
      onComplete?.(digits);
    }
  };

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable
      accessibilityRole="none"
      onPress={() => editable && inputRef.current?.focus()}
      style={styles.wrap}
    >
      <View style={styles.boxes} pointerEvents="none">
        {Array.from({ length }).map((_, index) => {
          const digit = value[index] ?? '';
          const isActive = editable && focused && index === activeIndex;
          return (
            <View
              key={index}
              style={[
                styles.box,
                digit !== '' && styles.boxFilled,
                isActive && styles.boxActive,
                hasError && styles.boxError,
                !editable && styles.boxDisabled,
              ]}
            >
              <Text style={[styles.digit, hasError && styles.digitError]}>{digit}</Text>
              {isActive && digit === '' ? <View style={styles.caret} /> : null}
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        caretHidden
        selectTextOnFocus={false}
        // Lets iOS and Android offer the code straight from the incoming SMS.
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        accessibilityLabel={`Verification code, ${length} digits`}
        accessibilityHint="Enter the code sent to your phone by SMS"
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FBFCFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.borderStrong, backgroundColor: colors.white },
  boxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  boxError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  boxDisabled: { opacity: 0.6 },
  digit: { fontSize: 24, fontWeight: '700', color: colors.text },
  digitError: { color: colors.danger },
  caret: { position: 'absolute', width: 2, height: 24, backgroundColor: colors.primary },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    // Web needs a real font size on the overlay or it zooms the page on focus.
    fontSize: 24,
    color: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
});
