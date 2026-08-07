import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Branded loading screen shown while i18n initializes and while the stored session is being
 * checked (App.js). The native `windowBackground` (android/.../values/colors.xml + styles.xml)
 * is set to the same primaryDark so there's no white flash between the native cold-start frame
 * and this component mounting.
 */
export function SplashScreen() {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>A360</Text>
      </View>
      <Text style={styles.name}>Aurah 360</Text>
      <Text style={styles.tagline}>ClinicOS · Skin, Hair & Laser Care</Text>
      <ActivityIndicator size="small" color={colors.primaryForeground} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  badgeText: { color: colors.primaryForeground, fontWeight: '800', fontSize: 20, letterSpacing: 0.5 },
  name: { color: colors.primaryForeground, fontWeight: '800', fontSize: 22 },
  tagline: { color: 'rgba(250,246,239,0.72)', fontSize: 13 },
  spinner: { marginTop: 28 },
});

export default SplashScreen;
