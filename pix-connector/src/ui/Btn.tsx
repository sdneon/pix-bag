import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';

export const C = {
  bg: '#0a0a0a',
  panel: '#141414',
  btn: '#1e1e1e',
  border: '#333',
  accent: '#00d4ff',
  danger: '#c0392b',
  text: '#fff',
  dim: '#888',
};

export function Btn({ label, onPress, onLongPress, disabled, primary, danger, active, small, style }: {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  active?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={[
        styles.btn,
        small && styles.small,
        primary && styles.primary,
        danger && styles.danger,
        active && styles.active,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, small && styles.textSmall, (primary || danger) && styles.textDark]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:       { backgroundColor: C.btn, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  small:     { paddingVertical: 6, paddingHorizontal: 9 },
  primary:   { backgroundColor: C.accent, borderColor: C.accent },
  danger:    { backgroundColor: C.danger, borderColor: C.danger },
  active:    { borderColor: C.accent, borderWidth: 2, backgroundColor: '#0b2a33' },
  disabled:  { opacity: 0.4 },
  text:      { color: C.text, fontWeight: '600', fontSize: 14 },
  textSmall: { fontSize: 13 },
  textDark:  { color: '#000' },
});
