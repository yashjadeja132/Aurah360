import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, EmptyState, IconBadge } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { patientApi } from '../api/patientApi';
import { useNotificationsBadge } from '../context/NotificationsBadgeContext';
import { colors } from '../theme/colors';

/** §13.1 — generic lock-screen-safe text; no diagnosis/values ever appear here. */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { refreshUnreadCount } = useNotificationsBadge();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Keep the "More" tab badge in sync whenever this screen regains focus (e.g. after the
  // patient reads/marks items from here).
  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const load = useCallback(async () => {
    try {
      const result = await patientApi.notifications();
      setItems(Array.isArray(result) ? result : result.items || []);
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

  const onPress = async (item) => {
    if (!item.isRead) {
      await patientApi.markNotificationRead(item.id);
      load();
      refreshUnreadCount();
    }
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonList />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onPress(item)}>
          <Card style={!item.isRead ? styles.unread : undefined}>
            <View style={styles.row}>
              <IconBadge tone={item.isRead ? 'soft' : 'primary'} size={40}><Bell /></IconBadge>
              <View style={styles.flex}>
                <CardTitle>{item.subject || item.eventName}</CardTitle>
                <CardSubtitle>{item.message}</CardSubtitle>
              </View>
              {!item.isRead && <View style={styles.dot} />}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: { borderColor: colors.primary, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4 },
});
