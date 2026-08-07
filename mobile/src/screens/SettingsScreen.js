import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe, ShieldCheck, Lock } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, IconBadge } from '../components/Card';
import { Button } from '../components/Button';
import { useAppLock } from '../context/AppLockContext';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';
import { colors, radii } from '../theme/colors';
import { patientApi } from '../api/patientApi';

const PRIVACY_REQUEST_TYPES = ['ACCESS', 'CORRECTION', 'ERASURE', 'PORTABILITY', 'GRIEVANCE'];

/** App-wide configuration — language, app lock, privacy requests. Split out of Profile
 *  (which is now identity + dependents only) so "who I am" and "how the app behaves" don't
 *  compete for space on one screen. */
export default function SettingsScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { hasPinSet, disablePin } = useAppLock();
  const [turningOff, setTurningOff] = useState(false);
  const [disablePinValue, setDisablePinValue] = useState('');
  const [disablingPin, setDisablingPin] = useState(false);

  const [showPrivacyForm, setShowPrivacyForm] = useState(false);
  const [privacyType, setPrivacyType] = useState(PRIVACY_REQUEST_TYPES[0]);
  const [privacyDetails, setPrivacyDetails] = useState('');
  const [submittingPrivacy, setSubmittingPrivacy] = useState(false);
  const [privacyRequests, setPrivacyRequests] = useState([]);
  const [loadingPrivacyRequests, setLoadingPrivacyRequests] = useState(false);

  const loadPrivacyRequests = useCallback(async () => {
    setLoadingPrivacyRequests(true);
    try {
      const items = await patientApi.listPrivacyRequests();
      setPrivacyRequests(Array.isArray(items) ? items : []);
    } catch {
      /* non-fatal — list is best-effort */
    } finally {
      setLoadingPrivacyRequests(false);
    }
  }, []);

  useEffect(() => {
    loadPrivacyRequests();
  }, [loadPrivacyRequests]);

  const onPrivacyRequest = () => {
    setShowPrivacyForm((v) => !v);
  };

  const onSubmitPrivacyRequest = async () => {
    if (!privacyDetails.trim()) return;
    setSubmittingPrivacy(true);
    try {
      const created = await patientApi.submitPrivacyRequest(privacyType, privacyDetails.trim());
      Alert.alert(
        t('profile.requestData'),
        `Request submitted (ref: ${created.id}). Status: ${created.status}. The clinic's privacy team will contact you to verify your identity and process your request.`
      );
      setPrivacyDetails('');
      setShowPrivacyForm(false);
      loadPrivacyRequests();
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || err?.message || 'Could not submit request');
    } finally {
      setSubmittingPrivacy(false);
    }
  };

  const onDisablePin = async () => {
    if (disablePinValue.length < 4) return;
    setDisablingPin(true);
    try {
      const ok = await disablePin(disablePinValue);
      if (ok) {
        setDisablePinValue('');
        setTurningOff(false);
      } else {
        Alert.alert(t('app.name'), t('pin.wrongPin'));
      }
    } finally {
      setDisablingPin(false);
    }
  };

  return (
    <Screen title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <Card>
        <View style={styles.cardHeader}>
          <IconBadge tone="soft" size={38}><Globe /></IconBadge>
          <CardTitle>{t('profile.language')}</CardTitle>
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
          <IconBadge tone="soft" size={38}><Lock /></IconBadge>
          <CardTitle>{t('profile.appLock')}</CardTitle>
        </View>
        {hasPinSet ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.pinStatus}>{t('profile.pinLockOn')}</Text>
            {turningOff ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={styles.pinInput}
                  value={disablePinValue}
                  onChangeText={setDisablePinValue}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder="••••"
                  placeholderTextColor={colors.mutedForeground}
                  accessibilityLabel={t('pin.enterPin')}
                  autoFocus
                />
                <Button
                  title={t('profile.turnOff')}
                  variant="destructive"
                  onPress={onDisablePin}
                  loading={disablingPin}
                  disabled={disablePinValue.length < 4}
                />
              </View>
            ) : (
              <Button title={t('profile.turnOff')} variant="outline" onPress={() => setTurningOff(true)} />
            )}
          </View>
        ) : (
          <Button title={t('profile.setupPin')} variant="outline" onPress={() => navigation.navigate('PinSetup')} />
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <IconBadge tone="soft" size={38}><ShieldCheck /></IconBadge>
          <CardTitle>{t('profile.support')}</CardTitle>
        </View>
        <Button title={t('profile.requestData')} variant="outline" onPress={onPrivacyRequest} />

        {showPrivacyForm && (
          <View style={{ gap: 8, marginTop: 12 }}>
            <View style={styles.langRow}>
              {PRIVACY_REQUEST_TYPES.map((type) => (
                <Text
                  key={type}
                  onPress={() => setPrivacyType(type)}
                  style={[styles.langChip, privacyType === type && styles.langChipActive]}
                  accessibilityRole="button"
                >
                  {type}
                </Text>
              ))}
            </View>
            <TextInput
              style={styles.detailsInput}
              value={privacyDetails}
              onChangeText={setPrivacyDetails}
              placeholder="What do you need?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
            <Button
              title={t('profile.requestData')}
              onPress={onSubmitPrivacyRequest}
              loading={submittingPrivacy}
              disabled={!privacyDetails.trim()}
            />
          </View>
        )}

        {!loadingPrivacyRequests && privacyRequests.length > 0 && (
          <View style={{ gap: 6, marginTop: 12 }}>
            <Text style={styles.pinStatus}>Your requests</Text>
            {privacyRequests.map((r) => (
              <Text key={r.id} style={styles.pinStatus}>
                {r.type} — {r.status} ({new Date(r.createdAt).toLocaleDateString()})
              </Text>
            ))}
          </View>
        )}
      </Card>
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
  pinStatus: { fontSize: 13.5, color: colors.mutedForeground },
  detailsInput: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
  pinInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    fontSize: 18,
    letterSpacing: 4,
    color: colors.foreground,
    textAlign: 'center',
  },
});
