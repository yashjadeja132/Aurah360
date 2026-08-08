import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowRight, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { APP_ROUTES } from '@/constants/routes';
import { BOTTLENECK_WAIT_MINUTES } from '../hooks/useBranchDay';

/**
 * B1/B2 — the manager lens on the queue: load and waiting time compared ACROSS doctors, worst
 * first, with the bottleneck-vs-idle contrast stated in words. The flow diff (row B2) notes the
 * Branch Manager currently "gets literally the same screen as Receptionist … no comparative
 * analytics ('Dr. Shah 45 min vs Dr. X empty')". This panel is that comparison.
 */
export function QueueLoadPanel({ queue, doctors = [] }) {
  const { t } = useTranslation();

  const nameFor = (row) => {
    if (row.doctorName) return row.doctorName;
    const d = doctors.find((x) => String(x.id) === String(row.doctorId));
    if (!d) return t('branchDay.queue.unknownDoctor', 'Unknown doctor');
    return d.user?.fullName || d.name || d.doctorCode || t('branchDay.queue.unknownDoctor', 'Unknown doctor');
  };

  const rows = queue.doctorLoad || [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            {t('branchDay.queue.title', 'Queue load by doctor')}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {queue.bottleneck
              ? t('branchDay.queue.bottleneckLine', '{{doctor}} is the bottleneck at {{minutes}} min{{idle}}', {
                  doctor: nameFor(queue.bottleneck),
                  minutes: queue.bottleneck.longestWait,
                  idle: queue.idle.length
                    ? t('branchDay.queue.idleSuffix', ' — {{count}} doctor(s) idle', {
                        count: queue.idle.length,
                      })
                    : '',
                })
              : t('branchDay.queue.noBottleneck', 'No doctor is over the {{limit}} min mark.', {
                  limit: BOTTLENECK_WAIT_MINUTES,
                })}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={APP_ROUTES.QUEUE}>
            {t('branchDay.queue.open', 'Queue board')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {queue.isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {!queue.isLoading && rows.length === 0 && (
          <EmptyState
            icon={Users}
            title={t('branchDay.queue.emptyTitle', 'Queue is empty')}
            description={t(
              'branchDay.queue.emptyDescription',
              'Nobody is checked into a doctor queue at this branch today.'
            )}
          />
        )}

        {!queue.isLoading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('branchDay.queue.doctor', 'Doctor')}</TableHead>
                  <TableHead>{t('branchDay.queue.waiting', 'Waiting')}</TableHead>
                  <TableHead>{t('branchDay.queue.inConsult', 'In consult')}</TableHead>
                  <TableHead>{t('branchDay.queue.longestWait', 'Longest wait')}</TableHead>
                  <TableHead>{t('branchDay.queue.token', 'Current token')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.doctorId}>
                    <TableCell className="font-medium">{nameFor(row)}</TableCell>
                    <TableCell className="tabular-nums">{row.waiting}</TableCell>
                    <TableCell className="tabular-nums">{row.inConsultation}</TableCell>
                    <TableCell>
                      {row.longestWait > 0 ? (
                        <Badge variant={row.isBottleneck ? 'destructive' : 'secondary'}>
                          {t('branchDay.queue.minutes', '{{count}} min', { count: row.longestWait })}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t('branchDay.queue.none', '—')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.currentToken || t('branchDay.queue.none', '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QueueLoadPanel;
