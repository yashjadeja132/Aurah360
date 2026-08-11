import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import {
  useAvailableSlots,
  useWeeklyPreview,
  useSpecialSchedules,
  useSchedulingMutations,
} from '@/modules/scheduling/hooks/useScheduling';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
// Local-calendar day keys. See `@/utils/date` for why a UTC slice is wrong here: schedule days are
// persisted as local start-of-day, so in IST they read back as `…T18:30:00.000Z` on the PREVIOUS
// UTC date — slicing that shifted every date back a day, which is why the weekly strip and the
// availability detail disagreed (the weekday came from the server's `dayOfWeek`, correct, while the
// date string and the detail fetch came from the UTC slice).
import { localDateKey, startOfWeekKey } from '@/utils/date';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleViewerPage() {
  const { t } = useTranslation();
  const { data: doctorsData } = useDoctorList({ limit: 50, isActive: 'true' });
  const { data: branchesData } = useBranchList({ limit: 50 });
  const doctors = doctorsData?.items || [];
  const branches = branchesData?.items || [];

  const [doctorId, setDoctorId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [weekStart, setWeekStart] = useState(startOfWeekKey());

  const activeDoctor = doctorId || doctors[0]?.id || '';
  const slotParams = useMemo(
    () => ({ doctorId: activeDoctor, date, ...(branchId ? { branchId } : {}) }),
    [activeDoctor, date, branchId]
  );
  const weekParams = useMemo(
    () => ({
      doctorId: activeDoctor,
      weekStart,
      ...(branchId ? { branchId } : {}),
    }),
    [activeDoctor, weekStart, branchId]
  );

  const { data: daySlots, isLoading: loadingDay } = useAvailableSlots(slotParams);
  const { data: week, isLoading: loadingWeek } = useWeeklyPreview(weekParams);
  const { data: specials = [] } = useSpecialSchedules({ doctorId: activeDoctor });
  const { upsertSpecial, deleteSpecial, validateSlot } = useSchedulingMutations();

  const [override, setOverride] = useState({
    date: '',
    startTime: '12:00',
    endTime: '18:00',
    lunchStart: '13:00',
    lunchEnd: '14:00',
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('scheduling.viewer.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('scheduling.viewer.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={APP_ROUTES.SCHEDULING_HOLIDAYS}>{t('scheduling.holidays.title')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={APP_ROUTES.SCHEDULING_BLOCKED}>{t('scheduling.blocked.title')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchableCombobox
          value={activeDoctor}
          onChange={setDoctorId}
          options={doctors}
          filterKeys={['doctorCode']}
          renderLabel={(d) => d.user?.fullName || d.doctorCode}
          placeholder={t('scheduling.selectDoctor')}
          emptyText={t('scheduling.viewer.noDoctorMatch', 'No doctor matches')}
        />
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t('scheduling.viewer.anyBranch')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
          ))}
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(startOfWeekKey(e.target.value))}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>{t('scheduling.viewer.weeklyPreview')}</CardTitle></CardHeader>
        <CardContent>
          {loadingWeek ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-7">
              {(week?.days || []).map((day) => {
                // Resolve the server timestamp to its LOCAL calendar day once, then use it for the
                // label, the selection check and the fetch — so all three always agree.
                const dayKey = localDateKey(day.date);
                return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setDate(dayKey)}
                  className={cn(
                    'rounded-lg border p-2 text-left text-xs transition-colors',
                    date === dayKey
                      ? 'border-primary bg-primary/5'
                      : 'bg-card hover:bg-accent'
                  )}
                >
                  <p className="font-medium">{t(`scheduling.viewer.days.${DAY_NAMES[day.dayOfWeek]}`, DAY_NAMES[day.dayOfWeek])}</p>
                  <p className="text-muted-foreground">{dayKey.slice(5, 10)}</p>
                  {day.available ? (
                    <Badge variant="success" className="mt-2">{t('scheduling.viewer.slotsCount', { count: day.slots.length })}</Badge>
                  ) : (
                    <Badge variant="warning" className="mt-2">{day.reason || t('scheduling.viewer.off')}</Badge>
                  )}
                </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('scheduling.viewer.availabilityPreview')} · {date}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDay ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={daySlots?.available ? 'success' : 'warning'}>
                    {daySlots?.available ? t('scheduling.viewer.available') : daySlots?.reason || t('scheduling.viewer.unavailable')}
                  </Badge>
                  {daySlots?.meta?.holiday && <Badge variant="destructive">{t('scheduling.viewer.holiday')}</Badge>}
                  {daySlots?.meta?.onLeave && <Badge variant="destructive">{t('scheduling.viewer.onLeave')}</Badge>}
                  {daySlots?.meta?.specialOverride && <Badge>{t('scheduling.viewer.specialSchedule')}</Badge>}
                  {(daySlots?.meta?.blockedCount || 0) > 0 && (
                    <Badge variant="secondary">{t('scheduling.viewer.blocksCount', { count: daySlots.meta.blockedCount })}</Badge>
                  )}
                </div>
                <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
                  {(daySlots?.slots || []).map((slot) => (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      type="button"
                      className="rounded-md border bg-secondary px-2 py-1 font-mono text-xs"
                      onClick={async () => {
                        try {
                          const res = await validateSlot.mutateAsync({
                            doctorId: activeDoctor,
                            date,
                            startTime: slot.start,
                            endTime: slot.end,
                            branchId: branchId || slot.branchId || null,
                          });
                          toast.success(
                            res.data?.valid
                              ? t('scheduling.viewer.validSlot', { time: slot.start })
                              : t('scheduling.viewer.invalidSlot', { reason: res.data?.reason })
                          );
                        } catch (err) {
                          toast.error(err?.response?.data?.message || t('scheduling.viewer.validateFailed'));
                        }
                      }}
                    >
                      {slot.start}
                    </button>
                  ))}
                  {!daySlots?.slots?.length && (
                    <p className="text-sm text-muted-foreground">{t('scheduling.viewer.noSlots')}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('scheduling.viewer.slotHint')}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('scheduling.viewer.tempOverride')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <PermissionGuard permissions={[PERMISSIONS.SCHEDULE_EDIT, PERMISSIONS.SCHEDULE_ALL]}>
              <form
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!activeDoctor || !branchId || !override.date) {
                    toast.error(t('scheduling.viewer.overrideValidation'));
                    return;
                  }
                  try {
                    await upsertSpecial.mutateAsync({
                      doctorId: activeDoctor,
                      branchId,
                      date: override.date,
                      startTime: override.startTime,
                      endTime: override.endTime,
                      lunchStart: override.lunchStart,
                      lunchEnd: override.lunchEnd,
                      slotDuration: 15,
                      bufferTime: 5,
                      isWorking: true,
                    });
                    toast.success(t('scheduling.viewer.overrideSaved'));
                  } catch (err) {
                    toast.error(err?.response?.data?.message || t('scheduling.failed'));
                  }
                }}
              >
                <Input
                  type="date"
                  value={override.date}
                  onChange={(e) => setOverride((p) => ({ ...p, date: e.target.value }))}
                />
                <Input
                  type="time"
                  value={override.startTime}
                  onChange={(e) => setOverride((p) => ({ ...p, startTime: e.target.value }))}
                />
                <Input
                  type="time"
                  value={override.endTime}
                  onChange={(e) => setOverride((p) => ({ ...p, endTime: e.target.value }))}
                />
                <Input
                  type="time"
                  value={override.lunchStart}
                  onChange={(e) => setOverride((p) => ({ ...p, lunchStart: e.target.value }))}
                />
                <Input
                  type="time"
                  value={override.lunchEnd}
                  onChange={(e) => setOverride((p) => ({ ...p, lunchEnd: e.target.value }))}
                />
                <Button type="submit">{t('scheduling.viewer.saveOverride')}</Button>
              </form>
            </PermissionGuard>

            <ul className="divide-y rounded-lg border">
              {specials.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    {new Date(s.date).toLocaleDateString()} · {s.startTime}–{s.endTime}
                    {s.lunchStart && (
                      <span className="text-muted-foreground"> ({t('scheduling.viewer.lunch')} {s.lunchStart}–{s.lunchEnd})</span>
                    )}
                  </span>
                  <PermissionGuard permissions={[PERMISSIONS.SCHEDULE_EDIT, PERMISSIONS.SCHEDULE_ALL]}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await deleteSpecial.mutateAsync(s.id);
                        toast.success(t('scheduling.removed'));
                      }}
                    >
                      {t('scheduling.remove')}
                    </Button>
                  </PermissionGuard>
                </li>
              ))}
              {!specials.length && (
                <li className="px-3 py-2 text-sm text-muted-foreground">{t('scheduling.viewer.noOverrides')}</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
