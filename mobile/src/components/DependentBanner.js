import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii } from '../theme/colors';

/**
 * Persistent "Viewing: <name>" banner shown on screens that must never silently act on the
 * signed-in patient's own records while a guardian is "acting as" a dependent (APP-006).
 * Mirrors the inline banner HomeScreen.js introduced; extracted here so every dependent-aware
 * screen (Appointments/Bills/Documents/Treatments/BookAppointment) renders it identically.
 */
export function DependentBanner({ name, style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.dependentBanner, style]}>
      <Text style={styles.dependentBannerText}>{t('home.viewingDependent', { name })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dependentBanner: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  dependentBannerText: { color: colors.accentForeground, fontSize: 12.5, fontWeight: '700' },
});

export default DependentBanner;
