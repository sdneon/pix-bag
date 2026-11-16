import React from 'react';
import { Image, StyleProp, StyleSheet, ToastAndroid, TouchableOpacity, ViewStyle } from 'react-native';
import { IconName, iconUri } from './pixelIcons';
import { C } from './Btn';

// Icon-only button; long-press shows its name.
export function IconBtn({ icon, label, onPress, active, disabled, danger, primary, size = 44, style }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const px = Math.round(size * 0.55);
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={() => ToastAndroid.show(label, ToastAndroid.SHORT)}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[
        styles.btn,
        { width: size, height: size },
        primary && styles.primary,
        danger && styles.danger,
        active && styles.active,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Image source={{ uri: iconUri(icon) }} style={{ width: px, height: px }} fadeDuration={0} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:      { backgroundColor: C.btn, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  primary:  { borderColor: C.accent, backgroundColor: '#0b2a33' },
  danger:   { borderColor: '#5a2320', backgroundColor: '#2a1210' },
  active:   { borderColor: C.accent, borderWidth: 2, backgroundColor: '#0b2a33' },
  disabled: { opacity: 0.35 },
});
