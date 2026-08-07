import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { patientDetailPath } from '@/constants/routes';

export function PatientTable({ items = [], isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title={t('patients.table.noPatients', 'No patients')}
        description={t('patients.table.noPatientsDesc', 'Register a patient to start the clinical record.')}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('patients.table.patient', 'Patient')}</TableHead>
            <TableHead>{t('patients.table.mrn', 'MRN')}</TableHead>
            <TableHead>{t('patients.table.phone', 'Phone')}</TableHead>
            <TableHead>{t('patients.table.age', 'Age')}</TableHead>
            <TableHead>{t('patients.table.gender', 'Gender')}</TableHead>
            <TableHead>{t('patients.table.branch', 'Branch')}</TableHead>
            <TableHead>{t('patients.table.status', 'Status')}</TableHead>
            <TableHead className="text-right">{t('patients.table.actions', 'Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                    {(p.firstName?.[0] || '?')}{(p.lastName?.[0] || '')}
                  </div>
                  <div>
                    <p className="font-medium">
                      {p.fullName}
                      {p.isVip && (
                        <Badge className="ml-2" variant="warning">{t('patients.detail.vip', 'VIP')}</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.email || '—'}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{p.mrn}</TableCell>
              <TableCell>{p.mobile}</TableCell>
              <TableCell>{p.age ?? '—'}</TableCell>
              <TableCell>{p.gender}</TableCell>
              <TableCell>{p.primaryBranch?.name || '—'}</TableCell>
              <TableCell>
                <Badge variant={p.isActive ? 'success' : 'warning'}>{p.status}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link to={patientDetailPath(p.id)}>{t('patients.table.open', 'Open')}</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default PatientTable;
