import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { useReportDashboard } from '@/modules/reports/hooks/useReports';
import { KpiCard } from '@/modules/reports/components/KpiCard';
import { ReportFilters } from '@/modules/reports/components/ReportFilters';
import { DASHBOARD_TYPES, formatMoney } from '@/modules/reports/constants';

function summaryCards(t, type, summary = {}) {
  const k = (key, def) => t(`reports.roleDashboard.kpis.${key}`, def);
  if (type === 'owner' || type === 'branch-manager') {
    return [
      [k('revenueToday', 'Revenue today'), formatMoney(summary.revenueToday)],
      [k('revenueThisMonth', 'Revenue this month'), formatMoney(summary.revenueThisMonth)],
      [k('outstanding', 'Outstanding'), formatMoney(summary.outstandingPayments)],
      [k('appointmentsToday', 'Appointments today'), summary.appointmentsToday],
      [k('registrations', 'Registrations'), summary.patientRegistrations],
      [k('leadConversion', 'Lead conversion'), `${summary.leadConversion ?? 0}%`],
      [k('treatmentPlans', 'Treatment plans'), summary.treatmentPlans],
      [k('completedTreatments', 'Completed treatments'), summary.completedTreatments],
    ];
  }
  if (type === 'doctor') {
    return [
      [k('todaysPatients', "Today's patients"), summary.todaysPatients],
      [k('consultations', 'Consultations'), summary.consultations],
      [k('followUps', 'Follow-ups'), summary.followUps],
      [k('prescriptions', 'Prescriptions'), summary.prescriptions],
      [k('treatmentPlans', 'Treatment plans'), summary.treatmentPlans],
      [k('pendingNotes', 'Pending notes'), summary.pendingNotes],
    ];
  }
  if (type === 'reception') {
    return [
      [k('todaysAppointments', "Today's appointments"), summary.todaysAppointments],
      [k('checkIns', 'Check-ins'), summary.checkIns],
      [k('walkIns', 'Walk-ins'), summary.walkIns],
      [k('noShows', 'No shows'), summary.noShows],
      [k('avgWait', 'Avg wait (min)'), summary.averageWaitingTime],
    ];
  }
  if (type === 'crm') {
    return [
      [k('newLeads', 'New leads'), summary.newLeads],
      [k('followUpsDue', 'Follow-ups due'), summary.followUpsDue],
      [k('conversion', 'Conversion'), `${summary.conversionRate ?? 0}%`],
      [k('totalLeads', 'Total leads'), summary.total],
      [k('won', 'Won'), summary.won],
    ];
  }
  if (type === 'pharmacy') {
    return [
      [k('dispensedToday', 'Dispensed today'), summary.dispensedToday],
      [k('lowStock', 'Low stock'), summary.lowStock],
      [k('nearExpiry', 'Near expiry'), summary.nearExpiry],
      [k('poThisMonth', 'PO this month'), summary.purchaseOrdersThisMonth],
      [k('purchaseValue', 'Purchase value'), formatMoney(summary.purchaseValueThisMonth)],
    ];
  }
  return Object.entries(summary).map(([key, v]) => [key, v]);
}

export default function RoleDashboardPage() {
  const { t } = useTranslation();
  const { type } = useParams();
  const meta = DASHBOARD_TYPES.find((d) => d.value === type);
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState({});
  const { data, isLoading } = useReportDashboard(type, filters);
  const cards = useMemo(() => summaryCards(t, type, data?.summary), [t, type, data]);

  if (!meta) {
    return <p className="text-sm text-muted-foreground">{t('reports.unknownDashboard', 'Unknown dashboard.')}</p>;
  }

  const dashboardLabel = t(`reports.dashboardTypes.${meta.value}`, meta.label);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('reports.roleDashboard.title', '{{dashboard}} dashboard', { dashboard: dashboardLabel })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('reports.roleDashboard.subtitle', 'Live metrics from clinic modules.')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.REPORTS}>{t('reports.allReports', 'All reports')}</Link>
        </Button>
      </div>

      <ReportFilters value={draft} onChange={setDraft} onApply={() => setFilters({ ...draft })} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <KpiCard key={label} label={label} value={isLoading ? '…' : value ?? 0} />
        ))}
      </div>

      {(type === 'owner' || type === 'branch-manager') && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ListBlock title={t('reports.roleDashboard.lists.topDoctors', 'Top doctors')} items={(data?.topDoctors || []).map((d) => `${d.name} · ${formatMoney(d.revenue)}`)} />
          <ListBlock title={t('reports.roleDashboard.lists.topServices', 'Top services')} items={(data?.topServices || []).map((s) => `${s.serviceId || 'Service'} · ${s.count}`)} />
          <ListBlock title={t('reports.roleDashboard.lists.topBranches', 'Top branches')} items={(data?.topBranches || []).map((b) => `${b.name} · ${formatMoney(b.revenue)}`)} />
        </div>
      )}

      {type === 'doctor' && (
        <ListBlock
          title={t('reports.roleDashboard.lists.todaysPatients', "Today's patients")}
          items={(data?.patients || []).map((p) => `${p.patientName} · ${p.status} · ${p.startTime || ''}`)}
        />
      )}

      {type === 'reception' && (
        <ListBlock
          title={t('reports.roleDashboard.lists.queueStatus', 'Queue status')}
          items={Object.entries(data?.queueStatus || {}).map(([k, v]) => `${k}: ${v}`)}
        />
      )}

      {type === 'crm' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListBlock
            title={t('reports.roleDashboard.lists.pipelineFunnel', 'Pipeline funnel')}
            items={Object.entries(data?.pipelineFunnel || {}).map(([k, v]) => `${k}: ${v}`)}
          />
          <ListBlock
            title={t('reports.roleDashboard.lists.counsellorPerformance', 'Counsellor performance')}
            items={(data?.counsellorPerformance || []).map(
              (c) => `${c.name} · ${c.won}/${c.total} (${c.conversionPercent}%)`
            )}
          />
          <ListBlock
            title={t('reports.roleDashboard.lists.leadSources', 'Lead sources')}
            items={(data?.leadSources || []).map(
              (s) => `${s.source}: ${s.total} (won ${s.conversionPercent}%)`
            )}
          />
        </div>
      )}

      {type === 'pharmacy' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListBlock
            title={t('reports.roleDashboard.lists.topMedicines', 'Top medicines')}
            items={(data?.topMedicines || []).map((m) => `${m.name} · qty ${m.quantity}`)}
          />
          <ListBlock
            title={t('reports.roleDashboard.lists.purchaseSummary', 'Purchase summary')}
            items={(data?.purchaseSummary || []).map((p) => `${p.status}: ${p.count}`)}
          />
        </div>
      )}
    </section>
  );
}

function ListBlock({ title, items }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item} className="text-muted-foreground">
            {item}
          </li>
        ))}
        {!items.length && <li className="text-muted-foreground">{t('reports.roleDashboard.noData', 'No data.')}</li>}
      </ul>
    </div>
  );
}
