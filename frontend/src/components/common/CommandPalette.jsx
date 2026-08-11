import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, User, Stethoscope, CalendarCheck2, Receipt, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { patientsApi } from '@/modules/patients/api/patientsApi';
import { appointmentsApi } from '@/modules/appointments/api/appointmentsApi';
import { billingApi } from '@/modules/billing/api/billingApi';
import { doctorsApi } from '@/modules/doctors/api/doctorsApi';
import { APP_ROUTES, invoiceDetailPath, doctorDetailPath } from '@/constants/routes';
import { SEARCHABLE_PAGES, isPageVisible } from '@/constants/searchablePages';
import { cn } from '@/utils/cn';

const CATEGORY_CAP = 5;

/**
 * Global Ctrl+K / Cmd+K search — patients, appointments, invoices (all via the SAME scoped
 * list endpoints/hooks the rest of the app already uses, so branch-scoped roles see exactly
 * the same slice of data here as everywhere else), plus a client-side page-navigation search
 * over SEARCHABLE_PAGES (already filtered to what the sidebar would show this user).
 *
 * Mounted once in AppLayout.jsx — see useCommandPalette for the global keydown listener that
 * owns `open`.
 */
export function CommandPalette({ open, onOpenChange }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState(null); // null = not yet resolved
  const [doctors, setDoctors] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [invoices, setInvoices] = useState(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setPatients(null);
      setDoctors(null);
      setAppointments(null);
      setInvoices(null);
      // Autofocus once the dialog has actually mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setPatients(null);
      setDoctors(null);
      setAppointments(null);
      setInvoices(null);
      return undefined;
    }
    setPatients(undefined); // undefined === "loading"
    setDoctors(undefined);
    setAppointments(undefined);
    setInvoices(undefined);

    const timer = setTimeout(() => {
      patientsApi
        .list({ search: q, limit: CATEGORY_CAP, page: 1 })
        .then((res) => setPatients(res.data || []))
        .catch(() => setPatients([]));
      doctorsApi
        .list({ search: q, limit: CATEGORY_CAP, page: 1 })
        .then((res) => setDoctors(res.data || []))
        .catch(() => setDoctors([]));
      appointmentsApi
        .list({ search: q, limit: CATEGORY_CAP, page: 1 })
        .then((res) => setAppointments(res.data || []))
        .catch(() => setAppointments([]));
      billingApi
        .list({ search: q, limit: CATEGORY_CAP, page: 1 })
        .then((res) => setInvoices(res.data || []))
        .catch(() => setInvoices([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const visiblePages = useMemo(
    () => SEARCHABLE_PAGES.filter((p) => isPageVisible(p, user, hasAnyPermission)),
    [user]
  );

  const matchedPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return visiblePages
      .filter((p) => (t(p.labelKey, p.title) || p.title).toLowerCase().includes(q))
      .slice(0, CATEGORY_CAP);
  }, [query, visiblePages, t]);

  const hasQuery = Boolean(query.trim());
  const patientsLoading = patients === undefined;
  const doctorsLoading = doctors === undefined;
  const appointmentsLoading = appointments === undefined;
  const invoicesLoading = invoices === undefined;
  const allResolved = !patientsLoading && !doctorsLoading && !appointmentsLoading && !invoicesLoading;
  const noResults =
    hasQuery &&
    allResolved &&
    !(patients?.length) &&
    !(doctors?.length) &&
    !(appointments?.length) &&
    !(invoices?.length) &&
    matchedPages.length === 0;

  function close() {
    onOpenChange?.(false);
  }

  function goTo(path) {
    navigate(path);
    close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.commandPalette.placeholder', 'Search patients, appointments, invoices, pages…')}
            className="border-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          <kbd className="hidden shrink-0 rounded border border-border/70 bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!hasQuery && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('common.commandPalette.hint', 'Type to search patients, appointments, invoices or jump to a page.')}
            </div>
          )}

          {hasQuery && (
            <>
              <ResultGroup
                title={t('common.commandPalette.patients', 'Patients')}
                icon={User}
                loading={patientsLoading}
                items={patients}
                renderRow={(p) => (
                  <Row
                    key={p.id}
                    onClick={() => goTo(APP_ROUTES.PATIENT_DETAIL.replace(':id', p.id))}
                    primary={p.fullName}
                    secondary={[p.mrn, p.mobile].filter(Boolean).join(' · ')}
                  />
                )}
              />
              <ResultGroup
                title={t('common.commandPalette.doctors', 'Doctors')}
                icon={Stethoscope}
                loading={doctorsLoading}
                items={doctors}
                renderRow={(d) => (
                  <Row
                    key={d.id}
                    onClick={() => goTo(doctorDetailPath(d.id))}
                    primary={d.user?.fullName || d.doctorCode}
                    secondary={[d.doctorCode, d.specialization].filter(Boolean).join(' · ')}
                  />
                )}
              />
              <ResultGroup
                title={t('common.commandPalette.appointments', 'Appointments')}
                icon={CalendarCheck2}
                loading={appointmentsLoading}
                items={appointments}
                renderRow={(a) => (
                  <Row
                    key={a.id}
                    onClick={() => goTo(APP_ROUTES.APPOINTMENT_DETAIL.replace(':id', a.id))}
                    primary={a.patient?.fullName || a.appointmentNumber}
                    secondary={[a.doctor?.name, a.appointmentDate?.slice?.(0, 10), a.startTime]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                )}
              />
              <ResultGroup
                title={t('common.commandPalette.invoices', 'Invoices')}
                icon={Receipt}
                loading={invoicesLoading}
                items={invoices}
                renderRow={(inv) => (
                  <Row
                    key={inv.id}
                    onClick={() => goTo(invoiceDetailPath(inv.id))}
                    primary={inv.invoiceNumber}
                    secondary={[inv.patient?.fullName, inv.total != null ? `₹${inv.total}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                )}
              />
              <ResultGroup
                title={t('common.commandPalette.pages', 'Pages')}
                icon={FileText}
                loading={false}
                items={matchedPages}
                renderRow={(p) => (
                  <Row key={p.path} onClick={() => goTo(p.path)} primary={t(p.labelKey, p.title)} />
                )}
              />

              {noResults && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('common.commandPalette.noResults', 'No results')}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultGroup({ title, icon: Icon, loading, items, renderRow }) {
  const { t } = useTranslation();
  if (!loading && !(items && items.length)) return null;
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {t('common.searching', 'Searching…')}
        </div>
      ) : (
        <ul>{items.map(renderRow)}</ul>
      )}
    </div>
  );
}

function Row({ onClick, primary, secondary }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm hover:bg-muted'
        )}
      >
        <span className="font-medium">{primary}</span>
        {secondary && <span className="text-xs text-muted-foreground">{secondary}</span>}
      </button>
    </li>
  );
}

export default CommandPalette;
