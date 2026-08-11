import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ROLES, ROLE_LABELS } from '@/constants/rbac';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useStaffRosterToday, useMarkStaffLeave } from '@/modules/branchManager/hooks/useStaffRoster';
import { RosterImpactPanel } from '@/modules/doctors/components/RosterImpactPanel';
import { useDoctorMutations } from '@/modules/doctors/hooks/useDoctors';

const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

/**
 * Branch Manager "Staff/Rosters" board (spec: Sidebar → Staff/Rosters → today's roster across
 * ALL staff types → mark absent/blocked with reason → doctors cascade into the existing
 * roster-impact/reassign flow, non-doctor staff get a simpler leave mark with no appointment
 * impact — see StaffRosterService/StaffLeaveService on the backend for why).
 */
export default function StaffRosterPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const branchId = isGlobalScope ? selectedBranchId || branches[0]?.id || '' : user?.branch || '';

  const { data: roster, isLoading } = useStaffRosterToday({ branchId: branchId || undefined });
  const byRole = roster?.byRole || {};
  const roleKeys = useMemo(
    () => Object.keys(byRole).sort((a, b) => a.localeCompare(b)),
    [byRole]
  );

  return (
    <section className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title={t('staffRoster.title', "Today's staff roster")}
        description={t(
          'staffRoster.subtitle',
          'Everyone rostered today across every role — mark who is absent or blocked, with a reason.'
        )}
        actions={
          isGlobalScope ? (
            <Select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} className="w-52">
              <option value="">{t('staffRoster.selectBranch', 'Select branch')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
              ))}
            </Select>
          ) : undefined
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}

      {!isLoading && roleKeys.length === 0 && (
        <EmptyState
          title={t('staffRoster.emptyTitle', 'No active staff found')}
          description={t('staffRoster.emptyDescription', 'No active staff for this branch yet.')}
        />
      )}

      {!isLoading && roleKeys.length > 0 && (
        <div className="space-y-6">
          {roleKeys.map((role) => (
            <RoleGroup key={role} role={role} rows={byRole[role]} />
          ))}
        </div>
      )}
    </section>
  );
}

function RoleGroup({ role, rows }) {
  const { t } = useTranslation();
  const onLeaveCount = rows.filter((r) => r.onLeaveToday).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{ROLE_LABELS?.[role] || role}</span>
          <Badge variant="outline">
            {t('staffRoster.countSummary', '{{total}} total · {{onLeave}} on leave', {
              total: rows.length,
              onLeave: onLeaveCount,
            })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <StaffRow key={row.userId} row={row} role={role} />
        ))}
      </CardContent>
    </Card>
  );
}

function StaffRow({ row, role }) {
  const { t } = useTranslation();
  const [marking, setMarking] = useState(false);
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const isDoctor = role === 'DOCTOR';
  const markLeave = useMarkStaffLeave();
  const { createLeave } = useDoctorMutations();

  const [impactedAppointments, setImpactedAppointments] = useState([]);

  const submitNonDoctor = async () => {
    if (!reason.trim()) return;
    await markLeave.mutateAsync({
      userId: row.userId,
      payload: { startDate, endDate, reason: reason.trim() },
    });
    setMarking(false);
    setReason('');
  };

  const submitDoctor = async (overrideReason = null) => {
    const payload = { startDate, endDate, reason: reason.trim() || undefined, leaveType: 'FULL_DAY' };
    if (overrideReason) {
      payload.acknowledgeOverride = true;
      payload.overrideReason = overrideReason;
    }
    try {
      await createLeave.mutateAsync({ id: row.doctorId, payload });
      setImpactedAppointments([]);
      setMarking(false);
      setReason('');
    } catch (err) {
      const impacted = err.response?.data?.errors?.impactedAppointments;
      if (err.response?.status === 409 && Array.isArray(impacted) && impacted.length) {
        setImpactedAppointments(impacted);
      }
    }
  };

  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{row.fullName || row.email}</p>
          <p className="text-xs text-muted-foreground">{row.employeeId || row.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {row.onLeaveToday ? (
            <Badge variant="destructive">
              {t('staffRoster.onLeave', 'Absent/blocked')}{row.leaveReason ? ` — ${row.leaveReason}` : ''}
            </Badge>
          ) : (
            <Badge variant="secondary">{t('staffRoster.present', 'Rostered')}</Badge>
          )}
          {isDoctor && !row.doctorId ? (
            <Badge variant="outline">{t('staffRoster.noDoctorProfile', 'No doctor profile')}</Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setMarking((v) => !v)}>
              {marking ? t('common.cancel', 'Cancel') : t('staffRoster.markLeave', 'Mark leave/blocked')}
            </Button>
          )}
        </div>
      </div>

      {marking && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t('staffRoster.start', 'Start')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('staffRoster.end', 'End')}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label>{t('staffRoster.reason', 'Reason (required)')}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={!reason.trim() || markLeave.isPending || createLeave.isPending}
            onClick={() => (isDoctor ? submitDoctor() : submitNonDoctor())}
          >
            {t('common.save', 'Save')}
          </Button>

          {isDoctor && impactedAppointments.length > 0 && (
            <RosterImpactPanel
              impactedAppointments={impactedAppointments}
              isSubmitting={createLeave.isPending}
              onOverride={(overrideReason) => submitDoctor(overrideReason)}
              onCancel={() => setImpactedAppointments([])}
            />
          )}
        </div>
      )}
    </div>
  );
}
