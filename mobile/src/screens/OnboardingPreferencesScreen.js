import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe, Bell, Lock } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, IconBadge } from '../components/Card';
import { Button } from '../components/Button';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';
import { colors, radii } from '../theme/colors';

/**
 * Onboarding preferences step (spec: "{Language}{Notification permission}{Optional
 * biometric/app lock}"). Language picker reuses the exact same `setLanguage`/i18n mechanism as
 * SettingsScreen. Notifications use `PermissionsAndroid` — the only permission-request API
 * already available in this codebase (no expo-notifications / react-native-permissions is
 * installed, and we're not adding a new dependency for this). iOS has no equivalent native
 * module wired up here, so on iOS we simply acknowledge the intent; there is nothing to
 * request without adding a new dependency.
 */
export default function OnboardingPreferencesScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [notifStatus, setNotifStatus] = useState(null); // null | 'granted' | 'denied'
  const [requestingNotif, setRequestingNotif] = useState(false);

  const onEnableNotifications = async () => {
    setRequestingNotif(true);
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        setNotifStatus(result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
      } else {
        // Android < 13 doesn't require a runtime prompt for notifications; iOS has no
        // permission module wired up in this app yet, so there's nothing to request.
        setNotifStatus('granted');
      }
    } catch {
      setNotifStatus('denied');
    } finally {
      setRequestingNotif(false);
    }
  };

  const onContinue = () => {
    navigation.replace('PinSetup', { fromOnboarding: true });
  };

  return (
    <Screen scroll title={t('onboarding.preferencesTitle')} subtitle={t('onboarding.preferencesSubtitle')}>
      <Card>
        <View style={styles.cardHeader}>
          <IconBadge tone="soft" size={38}><Globe /></IconBadge>
          <CardTitle>{t('onboarding.chooseLanguage')}</CardTitle>
        </View>
        <View style={styles.langRow}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Text
              key={lang.code}
              onPress={() => setLanguage(lang.code)}
              style={[styles.langChip, i18n.language === lang.code && styles.langChipActive]}
              accessibilityRole="button"
            >
              {lang.label}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <IconBadge tone="soft" size={38}><Bell /></IconBadge>
          <CardTitle>{t('onboarding.enableNotifications')}</CardTitle>
        </View>
        <Text style={styles.hint}>{t('onboarding.enableNotificationsHint')}</Text>
        {notifStatus === 'granted' ? (
          <Text style={styles.statusOk}>{t('onboarding.notificationsEnabled')}</Text>
        ) : notifStatus === 'denied' ? (
          <Text style={styles.statusMuted}>{t('onboarding.notificationsDenied')}</Text>
        ) : (
          <Button
            title={t('onboarding.enableNotifications')}
            variant="outline"
            onPress={onEnableNotifications}
            loading={requestingNotif}
          />
        )}
      </Card>

      <Card flat style={styles.hintCard}>
        <View style={styles.cardHeader}>
          <IconBadge tone="soft" size={38}><Lock /></IconBadge>
          <CardTitle>{t('onboarding.appLockOptional')}</CardTitle>
        </View>
        <Text style={styles.hint}>{t('onboarding.appLockHint')}</Text>
      </Card>

      <Button title={t('onboarding.continue')} onPress={onContinue} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  langRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  langChipActive: { backgroundColor: colors.primary, color: colors.primaryForeground, borderColor: colors.primary },
  hint: { fontSize: 13.5, color: colors.mutedForeground, lineHeight: 19 },
  statusOk: { fontSize: 13.5, color: colors.success, fontWeight: '600' },
  statusMuted: { fontSize: 13.5, color: colors.mutedForeground },
  hintCard: { backgroundColor: colors.muted },
});
