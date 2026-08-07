import { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useRecallWorklist, useRecordRecallOutcome } from '@/modules/crm/hooks/useCrmExtensions';

const OUTCOMES = ['BOOKED', 'CALL_LATER', 'NOT_INTERESTED', 'UNREACHABLE', 'WRONG_NUMBER', 'OPTED_OUT'];

const PRIORITY_VARIANT = { LOW: 'secondary', MEDIUM: 'info', HIGH: 'warning', URGENT: 'destructive' };

/** §12.1 — missed follow-up recall worklist; call desk records the outcome of every attempt. */
export default function RecallWorklistPage() {
  const { t } = useTranslation();
  const { data: entries = [], isLoading } = useRecallWorklist();
  const recordOutcome = useRecordRecallOutcome();
  const [selectedOutcome, setSelectedOutcome] = useState({});

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.recall.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('crm.recall.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('crm.recall.dueNow', { count: entries.length })}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('crm.recall.dueDate')}</TableHead>
                <TableHead>{t('crm.recall.purpose')}</TableHead>
                <TableHead>{t('crm.recall.priority')}</TableHead>
                <TableHead>{t('crm.recall.attempts')}</TableHead>
                <TableHead>{t('crm.recall.recordOutcome')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && entries.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('crm.recall.worklistClear')}</TableCell></TableRow>
              )}
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.dueDate).toDateString()}</TableCell>
                  <TableCell>{entry.purpose || '—'}</TableCell>
                  <TableCell><Badge variant={PRIORITY_VARIANT[entry.priority] || 'secondary'}>{entry.priority}</Badge></TableCell>
                  <TableCell>{entry.callAttempts}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <Select
                      className="w-44"
                      value={selectedOutcome[entry.id] || ''}
                      onChange={(e) => setSelectedOutcome((s) => ({ ...s, [entry.id]: e.target.value }))}
                    >
                      <option value="">{t('crm.recall.selectOutcome')}</option>
                      {OUTCOMES.map((o) => <option key={o} value={o}>{t(`crm.recallOutcome.${o}`)}</option>)}
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedOutcome[entry.id] || recordOutcome.isPending}
                      onClick={() =>
                        recordOutcome.mutate({ id: entry.id, payload: { status: selectedOutcome[entry.id] } })
                      }
                    >
                      <PhoneCall className="h-3.5 w-3.5" /> {t('crm.recall.save')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
