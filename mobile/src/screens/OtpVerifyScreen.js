import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function OtpVerifyScreen({ route }) {
  const { t } = useTranslation();
  const { mobile, devCode } = route.params;
  const { verifyOtp, requestOtp } = useAuth();
  const [code, setCode] = useState(devCode || '');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    setLoading(true);
    try {
      await verifyOtp(mobile, code);
      // Navigation switches to the authenticated stack automatically once `patient` is set.
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || t('onboarding.notRegistered'));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      await requestOtp(mobile);
      Alert.alert(t('app.name'), t('onboarding.codeSentTo', { mobile }));
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Something went wrong.');
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('onboarding.enterCode')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.codeSentTo', { mobile })}</Text>
      </View>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={t('onboarding.enterCode')}
        autoFocus
      />

      <Button title={t('onboarding.verify')} onPress={onVerify} loading={loading} disabled={code.length < 4} />
      <Text style={styles.resend} onPress={onResend} accessibilityRole="button">
        {t('onboarding.resend')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 48, marginBottom: 24, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.mutedForeground },
  input: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    fontSize: 24,
    letterSpacing: 6,
    marginBottom: 20,
    color: colors.foreground,
    textAlign: 'center',
  },
  resend: { marginTop: 16, textAlign: 'center', color: colors.primary, fontWeight: '600' },
});
