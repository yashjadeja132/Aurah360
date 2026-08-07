import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Linking, Alert, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileText, CalendarClock, Download } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, EmptyState, IconBadge, StatusPill } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { DependentBanner } from '../components/DependentBanner';
import { patientApi } from '../api/patientApi';
import { useDependents } from '../context/DependentsContext';
import { colors } from '../theme/colors';

/** §7.1/§13.2 — only documents explicitly released to the patient ever appear here. */
export default function DocumentsScreen() {
  const { t } = useTranslation();
  const { activeProfile, isViewingDependent } = useDependents();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownload = async (doc) => {
    if (downloadingId) return;
    setDownloadingId(doc.id);
    try {
      const dataUri = await patientApi.downloadDocument(doc.id);
      await Linking.openURL(dataUri);
    } catch (e) {
      Alert.alert(t('documents.downloadErrorTitle'), t('documents.downloadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      // Dependent-aware (Task #33) — mirrors HomeScreen.js so a guardian "acting as" a
      // dependent sees that dependent's documents, not their own.
      const result = isViewingDependent
        ? await patientApi.dependentDocuments(activeProfile.id)
        : await patientApi.listDocuments();
      setDocuments(Array.isArray(result) ? result : result.items || []);
    } finally {
      setLoading(false);
    }
  }, [isViewingDependent, activeProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonList />
      </Screen>
    );
  }

  if (documents.length === 0) {
    return (
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
      {documents.map((doc) => (
        <Card key={doc.id}>
          <View style={styles.row}>
            <IconBadge tone="info" size={44}><FileText /></IconBadge>
            <View style={styles.flex}>
              <CardTitle>{doc.title}</CardTitle>
              <View style={styles.dateRow}>
                <CalendarClock size={13} color={colors.mutedForeground} strokeWidth={2} />
                <Text style={styles.dateText}>{new Date(doc.clinicalDate || doc.createdAt).toDateString()}</Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel={t('documents.download')}
              disabled={downloadingId === doc.id}
              onPress={() => handleDownload(doc)}
              style={styles.downloadButton}
            >
              {downloadingId === doc.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Download size={18} color={colors.primary} strokeWidth={2} />
              )}
            </Pressable>
          </View>
          {doc.category ? <StatusPill label={doc.category} tone="soft" /> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dateText: { fontSize: 13.5, color: colors.mutedForeground },
  downloadButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}1A`,
  },
});
