import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useAuditSearch } from '@/modules/audit/hooks/useAuditLog';

const EMPTY_FILTERS = {
  actorId: '',
  patientId: '',
  resourceType: '',
  resourceId: '',
  action: '',
  family: '',
  correlationId: '',
  from: '',
  to: '',
};

/**
 * Families: identity/access · patient/clinical · appointment · finance/stock · communication ·
 * AI · data admin — mirrors `backend/src/enums/auditAction.js#AUDIT_FAMILIES`.
 */
const FAMILY_OPTIONS = [
  { value: '', label: 'All families' },
  { value: 'IDENTITY_ACCESS', label: 'Identity / access' },
  { value: 'PATIENT_CLINICAL', label: 'Patient / clinical' },
  { value: 'APPOINTMENT', label: 'Appointment' },
  { value: 'FINANCE_STOCK', label: 'Finance / stock' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'AI', label: 'AI' },
  { value: 'DATA_ADMIN', label: 'Data admin' },
];

/**
 * NFR-018 / §14.2 — the audit trail's UI. Append-only, view-only: search-and-read,
 * no edit or delete affordance anywhere on this screen. Backed by the existing
 * GET /audit/entries endpoint (audit.view gated, branch-scoped server-side —
 * this page adds no new authorization logic, it only renders what that endpoint returns).
 */
export default function AuditLogPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [page, setPage] = useState(1);

  const params = appliedFilters
    ? {
        ...Object.fromEntries(Object.entries(appliedFilters).filter(([, v]) => v)),
        page,
        limit: 25,
      }
    : null;

  const { data, isLoading, isFetching, error } = useAuditSearch(params, { enabled: !!appliedFilters });

  const handleChange = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(null);
    setPage(1);
  };

  const entries = data?.entries || [];
  const meta = data?.meta || {};

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('audit.title', 'Audit log')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'audit.subtitle',
            'Search the append-only audit trail by actor, patient, resource or action. View-only — nothing here can be edited or deleted.'
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('audit.filters.title', 'Filters')}</CardTitle>
          <CardDescription>
            {t('audit.filters.description', 'At least one filter is recommended — the trail can be large.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder={t('audit.filters.actorId', 'Actor (user) ID')} value={filters.actorId} onChange={handleChange('actorId')} />
            <Input placeholder={t('audit.filters.patientId', 'Patient ID')} value={filters.patientId} onChange={handleChange('patientId')} />
            <Input placeholder={t('audit.filters.resourceType', 'Resource type (e.g. Patient)')} value={filters.resourceType} onChange={handleChange('resourceType')} />
            <Input placeholder={t('audit.filters.resourceId', 'Resource ID')} value={filters.resourceId} onChange={handleChange('resourceId')} />
            <Input placeholder={t('audit.filters.action', 'Action (e.g. PATIENT_UPDATED)')} value={filters.action} onChange={handleChange('action')} />
            <Select
              aria-label={t('audit.filters.family', 'Family')}
              value={filters.family}
              onChange={handleChange('family')}
            >
              {FAMILY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(`audit.families.${opt.value || 'ALL'}`, opt.label)}</option>
              ))}
            </Select>
            <Input placeholder={t('audit.filters.correlationId', 'Correlation ID')} value={filters.correlationId} onChange={handleChange('correlationId')} />
            <Input type="date" value={filters.from} onChange={handleChange('from')} aria-label={t('audit.filters.from', 'From date')} />
            <Input type="date" value={filters.to} onChange={handleChange('to')} aria-label={t('audit.filters.to', 'To date')} />
            <div className="col-span-full flex gap-2">
              <Button type="submit" className="gap-2">
                <Search className="h-4 w-4" /> {t('audit.filters.search', 'Search')}
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                {t('audit.filters.reset', 'Reset')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {error?.response?.data?.message || t('audit.error', 'Could not load audit entries.')}
          </CardContent>
        </Card>
      )}

      {appliedFilters && (
        <Card>
          <CardHeader>
            <CardTitle>{t('audit.results.title', 'Entries')}</CardTitle>
            <CardDescription>
              {meta.total != null
                ? t('audit.results.count', '{{count}} matching entries', { count: meta.total })
                : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audit.table.when', 'When')}</TableHead>
                  <TableHead>{t('audit.table.action', 'Action')}</TableHead>
                  <TableHead>{t('audit.table.actor', 'Actor')}</TableHead>
                  <TableHead>{t('audit.table.resource', 'Resource')}</TableHead>
                  <TableHead>{t('audit.table.correlationId', 'Correlation ID')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('audit.results.empty', 'No entries match these filters.')}
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry.id || entry._id}>
                    <TableCell className="whitespace-nowrap">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell><Badge variant="outline">{entry.action}</Badge></TableCell>
                    <TableCell>{entry.actorId || entry.actorName || '—'}</TableCell>
                    <TableCell>
                      {entry.resourceType ? `${entry.resourceType}${entry.resourceId ? ` · ${entry.resourceId}` : ''}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.correlationId || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{isFetching ? t('audit.results.loading', 'Loading…') : null}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  {t('common.previous', 'Previous')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={entries.length < 25}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('common.next', 'Next')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
