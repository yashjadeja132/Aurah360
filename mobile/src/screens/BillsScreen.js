import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Receipt, CalendarClock, Eye, X } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, EmptyState, IconBadge, StatusPill } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { DependentBanner } from '../components/DependentBanner';
import { patientApi } from '../api/patientApi';
import { useDependents } from '../context/DependentsContext';
import { colors } from '../theme/colors';

/**
 * No payment gateway in MVP (§13.1) — this is view-only for released invoices/receipts.
 *
 * "View invoice" does NOT download a PDF: `GET /invoices/:id/print` has no real document
 * generation behind it — the backend (BillingService#getPrintData) returns the invoice JSON
 * plus a `printMeta` object of placeholder flags (`clinicLogoPlaceholder`, `qrPlaceholder`,
 * `emailPlaceholder`, `whatsappPlaceholder`). So this renders that summary in an in-app modal
 * instead of pretending there's a file to open.
 */
export default function BillsScreen() {
  const { t } = useTranslation();
  const { activeProfile, isViewingDependent } = useDependents();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printLoadingId, setPrintLoadingId] = useState(null);
  const [printSummary, setPrintSummary] = useState(null);

  const load = useCallback(async () => {
    try {
      // Dependent-aware (Task #33) — mirrors HomeScreen.js so a guardian "acting as" a
      // dependent sees that dependent's invoices, not their own.
      const result = isViewingDependent
        ? await patientApi.dependentInvoices(activeProfile.id)
        : await patientApi.listInvoices();
      setInvoices(Array.isArray(result) ? result : result.items || []);
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

  const handleViewInvoice = async (invoiceId) => {
    if (printLoadingId) return;
    setPrintLoadingId(invoiceId);
    try {
      const result = await patientApi.invoicePrint(invoiceId);
      setPrintSummary(result);
    } catch (e) {
      Alert.alert(t('bills.viewErrorTitle'), t('bills.viewError'));
    } finally {
      setPrintLoadingId(null);
    }
  };

  if (loading) {
    return (
      <Screen title={t('bills.title')} subtitle={t('bills.subtitle')}>
        <SkeletonList />
      </Screen>
    );
  }

  if (invoices.length === 0) {
    return (
      <Screen title={t('bills.title')} subtitle={t('bills.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
        {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('bills.title')} subtitle={t('bills.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
      {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
      {invoices.map((inv) => {
        const isPaid = inv.paymentStatus === 'PAID';
        return (
          <Card key={inv.id}>
            <View style={styles.row}>
              <IconBadge tone={isPaid ? 'success' : 'warning'} size={44}>
                <Receipt />
              </IconBadge>
              <View style={styles.flex}>
                <CardTitle>{inv.invoiceNumber}</CardTitle>
                <View style={styles.dateRow}>
                  <CalendarClock size={13} color={colors.mutedForeground} strokeWidth={2} />
                  <Text style={styles.dateText}>{new Date(inv.invoiceDate).toDateString()}</Text>
                </View>
              </View>
              <View style={styles.rightCol}>
                <StatusPill label={isPaid ? t('bills.paid') : t('bills.due')} tone={isPaid ? 'success' : 'warning'} />
                <Text style={styles.amount}>₹{inv.total}</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel={t('bills.viewInvoice')}
                disabled={printLoadingId === inv.id}
                onPress={() => handleViewInvoice(inv.id)}
                style={styles.viewButton}
              >
                {printLoadingId === inv.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Eye size={18} color={colors.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      <Modal visible={Boolean(printSummary)} transparent animationType="fade" onRequestClose={() => setPrintSummary(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('bills.invoiceSummary')}</Text>
              <TouchableOpacity onPress={() => setPrintSummary(null)}>
                <X size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {printSummary?.invoice ? (
                <>
                  <Text style={styles.modalRow}>{printSummary.invoice.invoiceNumber}</Text>
                  <Text style={styles.modalRow}>₹{printSummary.invoice.total}</Text>
                  <Text style={styles.modalRow}>
                    {new Date(printSummary.invoice.invoiceDate).toDateString()}
                  </Text>
                </>
              ) : null}
              <Text style={styles.modalNote}>{t('bills.noPdfNotice')}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dateText: { fontSize: 13.5, color: colors.mutedForeground },
  rightCol: { alignItems: 'flex-end', gap: 8 },
  amount: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  viewButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}1A`,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  modalBody: {},
  modalRow: { fontSize: 14.5, color: colors.foreground, marginBottom: 6 },
  modalNote: { fontSize: 12.5, color: colors.mutedForeground, marginTop: 10, fontStyle: 'italic' },
});
