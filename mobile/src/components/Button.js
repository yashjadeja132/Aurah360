import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, radii, shadow } from '../theme/colors';

export function Button({ title, onPress, disabled, loading, variant = 'primary', icon, style, textStyle }) {
  const isOutline = variant === 'outline';
  const isDestructive = variant === 'destructive';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isOutline && styles.outline,
        isDestructive && styles.destructive,
        isGhost && styles.ghost,
        !isOutline && !isDestructive && !isGhost && styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={isOutline || isGhost ? colors.primary : colors.primaryForeground} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[
              styles.text,
              (isOutline || isGhost) && { color: colors.primary },
              isDestructive && { color: '#fff' },
              !isOutline && !isDestructive && !isGhost && { color: colors.primaryForeground },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: colors.primary, ...shadow.card },
  outline: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.destructive, ...shadow.card },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  text: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});

export default Button;
