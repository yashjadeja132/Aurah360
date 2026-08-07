import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

/** APP-002 — OTP onboarding is the app's only sign-in path (no password). */
export default function OtpRequestScreen({ navigation }) {
  const { t } = useTranslation();
  const { requestOtp } = useAuth();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    if (mobile.trim().length < 8) {
      Alert.alert(t('app.name'), t('onboarding.mobile'));
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp(mobile.trim());
      navigation.navigate('OtpVerify', { mobile: mobile.trim(), devCode: result.devCode });
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </View>

      <Text style={styles.label}>{t('onboarding.mobile')}</Text>
      <TextInput
        style={styles.input}
        value={mobile}
        onChangeText={setMobile}
        keyboardType="phone-pad"
        maxLength={13}
        placeholder="9XXXXXXXXX"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={t('onboarding.mobile')}
      />

      <Button title={t('onboarding.sendCode')} onPress={onSend} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 48, marginBottom: 24, alignItems: 'center', gap: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  tagline: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
    color: colors.foreground,
  },
});
