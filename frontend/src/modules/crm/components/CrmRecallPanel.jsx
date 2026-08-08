import { useMemo, useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useRecallWorklist, useRecordRecallOutcome } from '@/modules/crm/hooks/useCrmExtensions';
import { APP_ROUTES } from '@/constants/routes';

const OUTCOMES = ['BOOKED', 'CALL_LATER', 'NOT_INTERESTED', 'UNREACHABLE', 'WRONG_NUMBER', 'OPTED_OUT'];

const PRIORITY_VARIANT = { LOW: 'secondary', MEDIUM: 'info', HIGH: 'warning', URGENT: 'destructive' };

const PRIORITY_RANK = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** §12.1 — missed follow-up recall worklist (was RecallWorklistPage). */
export function CrmRecallPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: entries = [], isLoading } = useRecallWorklist();
  const recordOutcome = useRecordRecallOutcome();
  const [selectedOutcome, setSelectedOutcome] = useState({});

  // Overdue / high-priority entries float to the top; then earliest due date first.
  const sortedEntries = useMemo(() => {
    const now = Date.now();
    const overdue = (e) => (new Date(e.dueDate).getTime() <= now ? 1 : 0);
    return [...entries].sort(
      (a, b) =>
        overdue(b) - overdue(a) ||
        (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0) ||
        new Date(a.dueDate) - new Date(b.dueDate)
    );
  }, [entries]);

  const saveOutcome = async (entry) => {
    const status = selectedOutcome[entry.id];
    if (!status) return;
    try {
      await recordOutcome.mutateAsync({ id: entry.id, payload: { status } });
    } catch {
      return; // hook surfaces the error toast; keep the selection so it can be retried
    }
    if (status === 'BOOKED' && entry.patientId) {
      navigate(`${APP_ROUTES.APPOINTMENT_BOOK}?patientId=${entry.patientId}`);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('crm.recall.subtitle', 'Patients due a recall call; every attempt records an outcome')}
      </p>

      {isLoading && <Skeleton className="h-32 w-full" />}

      <Card>
        <CardHeader>
          <CardTitle>{t('crm.recall.dueNow', { count: entries.length, defaultValue: 'Due now ({{count}})' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('crm.recall.dueDate', 'Due date')}</TableHead>
                <TableHead>{t('crm.recall.purpose', 'Purpose')}</TableHead>
                <TableHead>{t('crm.recall.priority', 'Priority')}</TableHead>
                <TableHead>{t('crm.recall.attempts', 'Attempts')}</TableHead>
                <TableHead>{t('crm.recall.recordOutcome', 'Record outcome')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('crm.recall.worklistClear', 'Worklist clear.')}
                  </TableCell>
                </TableRow>
              )}
              {sortedEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.dueDate).toDateString()}</TableCell>
                  <TableCell>{entry.purpose || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY_VARIANT[entry.priority] || 'secondary'}>{entry.priority}</Badge>
                  </TableCell>
                  <TableCell>{entry.callAttempts}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <Select
                      className="w-44"
                      value={selectedOutcome[entry.id] || ''}
                      onChange={(e) => setSelectedOutcome((s) => ({ ...s, [entry.id]: e.target.value }))}
                    >
                      <option value="">{t('crm.recall.selectOutcome', 'Select outcome')}</option>
                      {OUTCOMES.map((o) => (
                        <option key={o} value={o}>
                          {t(`crm.recallOutcome.${o}`, o)}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedOutcome[entry.id] || recordOutcome.isPending}
                      onClick={() => saveOutcome(entry)}
                    >
                      <PhoneCall className="h-3.5 w-3.5" /> {t('crm.recall.save', 'Save')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default CrmRecallPanel;
