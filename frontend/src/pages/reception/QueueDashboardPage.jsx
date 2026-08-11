import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { APP_ROUTES } from '@/constants/routes';
import { ROLES } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. RECEPTIONIST (and other
// branch-scoped roles reaching this board) is fixed to their own branch, not a picker.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];
import {
  QueueBoard,
  DoctorQueueCard,
} from '@/modules/reception/components/QueueBoard';
import {
  useBranchQueue,
  useQueueSummary,
} from '@/modules/reception/hooks/useReception';
import { useQueueSocket } from '@/modules/reception/hooks/useQueueSocket';
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { todayKey } from '@/utils/date';

function Chip({ label, value }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold text-primary">{value}</p>
    </div>
  );
}

export default function QueueDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => String(a.branchCode || '').localeCompare(String(b.branchCode || ''))),
    [branches]
  );
  const [branchId, setBranchId] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const effectiveBranchId = isGlobalScope
    ? branchId || sortedBranches[0]?.id || ''
    : user?.branch || '';
  const branchName =
    sortedBranches.find((b) => String(b.id) === String(effectiveBranchId))?.displayName ||
    sortedBranches.find((b) => String(b.id) === String(effectiveBranchId))?.name ||
    '';
  const today = todayKey();

  useQueueSocket({ branchId: effectiveBranchId, enabled: Boolean(effectiveBranchId) });

  const { data: queueRes, isLoading } = useBranchQueue(effectiveBranchId, today);
  const { data: summaryRes } = useQueueSummary(effectiveBranchId, today);
  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const doctors = doctorsData?.items || [];

  const entries = queueRes?.data || [];
  const summary = summaryRes?.data || {};

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (doctorFilter && e.doctorId !== doctorFilter) return false;
      if (statusFilter && e.queueStatus !== statusFilter) return false;
      return true;
    });
  }, [entries, doctorFilter, statusFilter]);

  const doctorIds = useMemo(() => {
    const ids = new Set(entries.map((e) => e.doctorId).filter(Boolean));
    return [...ids];
  }, [entries]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('reception.queue.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('reception.queue.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {effectiveBranchId && (
            <Button asChild variant="outline">
              <Link to={`${APP_ROUTES.QUEUE_DISPLAY}?branchId=${effectiveBranchId}`} target="_blank" rel="noopener noreferrer">
                {t('reception.queue.displayMode', 'Display mode')}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.RECEPTION}>
              <ClipboardList className="h-4 w-4" />
              {t('reception.title')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isGlobalScope ? (
          <Select value={effectiveBranchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t('reception.filters.selectBranch')}</option>
            {sortedBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName || b.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input value={branchName} disabled readOnly />
        )}
        <Select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
          <option value="">{t('reception.filters.allDoctors')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.doctorCode} — {d.user?.fullName || d.name || t('reception.doctor')}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('reception.filters.allStatuses')}</option>
          <option value="WAITING">{t('reception.status.WAITING')}</option>
          <option value="CALLED">{t('reception.status.CALLED')}</option>
          <option value="IN_CONSULTATION">{t('reception.status.IN_CONSULTATION')}</option>
          <option value="SKIPPED">{t('reception.status.SKIPPED')}</option>
          <option value="COMPLETED">{t('reception.status.COMPLETED')}</option>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Chip label={t('reception.stats.currentToken')} value={summary.currentToken || '—'} />
        <Chip label={t('reception.stats.nextToken')} value={summary.nextToken || '—'} />
        <Chip label={t('reception.stats.waiting')} value={summary.counts?.waiting ?? 0} />
        <Chip label={t('reception.stats.completed')} value={summary.counts?.completed ?? 0} />
        <Chip label={t('reception.stats.avgWait')} value={t('reception.minutesShort', { count: summary.averageWaitTime ?? 0 })} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {doctorIds.map((id) => {
          const doc = doctors.find((d) => d.id === id);
          const name =
            entries.find((e) => e.doctorId === id)?.doctor?.name ||
            doc?.user?.fullName ||
            doc?.name ||
            doc?.doctorCode ||
            id;
          return (
            <DoctorQueueCard
              key={id}
              doctorId={id}
              doctorName={name}
              entries={entries}
              summary={summary}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">{t('reception.queue.branchQueue')}</h2>
        {isLoading && <p className="text-sm text-muted-foreground">{t('reception.queue.loading')}</p>}
        <QueueBoard entries={filtered} doctors={doctors} />
      </div>
    </section>
  );
}
