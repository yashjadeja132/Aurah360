import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { ColorDot } from '@/components/common/ColorDot';
import { appointmentDetailPath } from '@/constants/routes';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_VARIANT } from '../constants';

export function AppointmentTable({ items = [], isLoading, branchName = {} }) {
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
        title={t('appointments.table.emptyTitle', 'No appointments')}
        description={t('appointments.table.emptyDescription', 'Book an appointment using the wizard.')}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('appointments.table.number', 'Number')}</TableHead>
            <TableHead>{t('appointments.table.patient', 'Patient')}</TableHead>
            <TableHead>{t('appointments.table.doctor', 'Doctor')}</TableHead>
            <TableHead>{t('appointments.table.branch', 'Branch')}</TableHead>
            <TableHead>{t('appointments.table.service', 'Service')}</TableHead>
            <TableHead>{t('appointments.table.when', 'When')}</TableHead>
            <TableHead>{t('appointments.table.status', 'Status')}</TableHead>
            <TableHead className="text-right">{t('appointments.table.actions', 'Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-mono text-xs">{a.appointmentNumber}</TableCell>
              <TableCell>
                <p className="font-medium">{a.patient?.fullName || '—'}</p>
                <p className="text-xs text-muted-foreground">{a.patient?.mrn}</p>
              </TableCell>
              <TableCell>{a.doctor?.name || a.doctor?.user?.fullName || a.doctor?.doctorCode || '—'}</TableCell>
              <TableCell>
                {a.branchId ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <ColorDot id={a.branchId} />
                    {branchName[a.branchId] || a.branch?.displayName || a.branch?.name || '—'}
                  </span>
                ) : '—'}
              </TableCell>
              <TableCell className="text-sm">{a.service?.name || a.serviceName || '—'}</TableCell>
              <TableCell className="text-sm">
                {a.appointmentDate ? new Date(a.appointmentDate).toLocaleDateString() : '—'}
                <span className="text-muted-foreground"> · {a.startTime}</span>
              </TableCell>
              <TableCell>
                <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status] || 'secondary'}>
                  {APPOINTMENT_STATUS_LABELS[a.status] || a.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link to={appointmentDetailPath(a.id)}>{t('appointments.table.open', 'Open')}</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default AppointmentTable;
