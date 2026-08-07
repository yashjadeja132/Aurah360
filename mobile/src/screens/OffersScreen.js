import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Gift, CalendarClock } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, EmptyState, IconBadge } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { patientApi } from '../api/patientApi';
import { colors } from '../theme/colors';

export default function OffersScreen() {
  const { t, i18n } = useTranslation();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await patientApi.listOffers();
      setOffers(result.offers || result || []);
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (offers.length === 0) {
    return (
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      {offers.map((offer) => {
        const lang = i18n.language;
        const title = offer.title?.[lang] || offer.title?.en;
        const description = offer.description?.[lang] || offer.description?.en;
        return (
          <Card key={offer.id}>
            <View style={styles.row}>
              <IconBadge tone="success" size={44}><Gift /></IconBadge>
              <View style={styles.flex}>
                <CardTitle>{title}</CardTitle>
                {description && <CardSubtitle>{description}</CardSubtitle>}
              </View>
            </View>
            <View style={styles.validRow}>
              <CalendarClock size={13} color={colors.mutedForeground} strokeWidth={2} />
              <Text style={styles.validText}>{t('offers.validUntil', { date: new Date(offer.validTo).toDateString() })}</Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  validRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validText: { fontSize: 12.5, color: colors.mutedForeground, fontWeight: '600' },
});
