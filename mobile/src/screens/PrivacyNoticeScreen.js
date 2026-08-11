import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, IconBadge } from '../components/Card';
import { Button } from '../components/Button';
import { colors } from '../theme/colors';

/**
 * Layered privacy notice shown once per install, right after OTP verification succeeds and
 * before the account is fully onboarded (spec: "Privacy notice (Gu/Hi/En, layered) →
 * {Acknowledge}"). "Layered" = a short summary up front, with a "read more" expansion into the
 * full notice, rather than forcing a wall of text before the user can continue. Localized via
 * the same i18n mechanism as the rest of the app (see mobile/src/i18n).
 */
export default function PrivacyNoticeScreen({ navigation }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const onAcknowledge = () => {
    navigation.replace('OnboardingPreferences');
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <IconBadge tone="soft" size={44}><ShieldCheck /></IconBadge>
        <Text style={styles.title}>{t('onboarding.privacyTitle')}</Text>
      </View>

      <Card>
        <CardTitle>{t('onboarding.privacyTitle')}</CardTitle>
        <Text style={styles.body}>{t('onboarding.privacySummary')}</Text>

        {expanded && <Text style={[styles.body, styles.fullBody]}>{t('onboarding.privacyFull')}</Text>}

        <Text
          style={styles.readMore}
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
        >
          {expanded ? t('onboarding.privacyReadLess') : t('onboarding.privacyReadMore')}
        </Text>
      </Card>

      <Button title={t('onboarding.privacyAcknowledge')} onPress={onAcknowledge} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  body: { fontSize: 14.5, color: colors.foregroundSoft, lineHeight: 21 },
  fullBody: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  readMore: { marginTop: 12, color: colors.primary, fontWeight: '700', fontSize: 13.5 },
});
