import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { useAppLock } from '../context/AppLockContext';
import { colors } from '../theme/colors';

const MIN_PIN_LENGTH = 4;

/** Set up a new local app-lock PIN: enter it, then confirm by re-entering. */
export default function PinSetupScreen({ navigation }) {
  const { t } = useTranslation();
  const { setPin } = useAppLock();
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (pin.length < MIN_PIN_LENGTH) {
      Alert.alert(t('app.name'), t('pin.tooShort'));
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert(t('app.name'), t('pin.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await setPin(pin);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('pin.setupTitle')}</Text>
        <Text style={styles.subtitle}>{t('pin.setupSubtitle')}</Text>
      </View>

      <Text style={styles.label}>{t('pin.enterPin')}</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={setPinValue}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder="••••"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={t('pin.enterPin')}
        autoFocus
      />

      <Text style={styles.label}>{t('pin.confirmPin')}</Text>
      <TextInput
        style={styles.input}
        value={confirmPin}
        onChangeText={setConfirmPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder="••••"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={t('pin.confirmPin')}
      />

      <Button
        title={t('common.save')}
        onPress={onSave}
        loading={saving}
        disabled={pin.length < MIN_PIN_LENGTH || confirmPin.length < MIN_PIN_LENGTH}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 24, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.mutedForeground },
  label: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 },
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
});
