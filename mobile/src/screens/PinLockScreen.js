import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { Button } from '../components/Button';
import { IconBadge } from '../components/Card';
import { useAppLock } from '../context/AppLockContext';
import { colors } from '../theme/colors';

/**
 * Full-screen local PIN gate shown when the app resumes from background and a PIN is set.
 * Soft throttle only (no backend call, no permanent lockout) — after MAX_ATTEMPTS wrong
 * entries in a row, input is disabled for THROTTLE_SECONDS.
 */
export default function PinLockScreen() {
  const { t } = useTranslation();
  const { verifyPin, maxAttempts, throttleSeconds } = useAppLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [throttleRemaining, setThrottleRemaining] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (throttleRemaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setThrottleRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [throttleRemaining > 0]);

  const onSubmit = async () => {
    if (throttleRemaining > 0 || pin.length < 4) return;
    setChecking(true);
    setError('');
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setPin('');
        if (nextAttempts >= maxAttempts) {
          setThrottleRemaining(throttleSeconds);
          setAttempts(0);
          setError(t('pin.tooManyAttempts', { seconds: throttleSeconds }));
        } else {
          setError(t('pin.wrongPin'));
        }
      }
    } finally {
      setChecking(false);
    }
  };

  const throttled = throttleRemaining > 0;

  return (
    <View style={styles.container}>
      <IconBadge tone="primary" size={64}>
        <Lock />
      </IconBadge>
      <Text style={styles.title}>{t('pin.lockedTitle')}</Text>
      <Text style={styles.subtitle}>{throttled ? t('pin.tooManyAttempts', { seconds: throttleRemaining }) : t('pin.enterPin')}</Text>

      <TextInput
        style={[styles.input, throttled && styles.inputDisabled]}
        value={pin}
        onChangeText={(value) => {
          setPin(value);
          setError('');
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder="••••"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={t('pin.enterPin')}
        editable={!throttled}
        autoFocus
      />

      {Boolean(error) && !throttled && <Text style={styles.error}>{error}</Text>}

      <Button
        title={t('onboarding.verify')}
        onPress={onSubmit}
        loading={checking}
        disabled={throttled || pin.length < 4}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 8 },
  subtitle: { fontSize: 13.5, color: colors.mutedForeground, textAlign: 'center', marginBottom: 12 },
  input: {
    width: '100%',
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    fontSize: 24,
    letterSpacing: 6,
    marginBottom: 8,
    color: colors.foreground,
    textAlign: 'center',
  },
  inputDisabled: { opacity: 0.5 },
  error: { color: colors.destructive, fontSize: 13, marginBottom: 8, textAlign: 'center' },
  button: { width: '100%', marginTop: 8 },
});
