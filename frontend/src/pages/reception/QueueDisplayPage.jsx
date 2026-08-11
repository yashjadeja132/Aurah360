import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/rbac';
import { usePublicBranchQueue } from '@/modules/reception/hooks/useReception';
import { useQueueSocket } from '@/modules/reception/hooks/useQueueSocket';
import { todayKey } from '@/utils/date';

const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

const STATUS_LABEL = {
  WAITING: 'Waiting',
  CALLED: 'Please proceed',
  IN_CONSULTATION: 'In consultation',
  SKIPPED: 'Skipped',
  COMPLETED: 'Done',
};

/**
 * PRD §6.5/§17.2 — the lobby/TV waiting-room board. Large, low-interaction, no patient name or
 * diagnosis: only token, initials, doctor and coarse status, sourced from `?view=PUBLIC` on the
 * existing branch-queue endpoint (QueueService#mapPublic already whitelists exactly this).
 *
 * AUTH DECISION (see report): this route is still behind the app's normal `authenticate` +
 * `queue.view` gate — it is NOT a true unauthenticated kiosk route. A real lobby TV (no staff
 * login on the device) needs its own unauthenticated-but-branch-scoped route design, which is a
 * deliberate follow-up rather than something invented here, because introducing a new
 * no-auth route class touches the app's PHI/route-security posture and shouldn't be decided
 * inside an unrelated staff-roster/cash-session fix. The payload itself (token + initials +
 * doctor + status) is low-risk even if that follow-up broadens access later.
 */
export default function QueueDisplayPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const branchId = searchParams.get('branchId') || (!isGlobalScope ? user?.branch : '') || '';
  const today = todayKey();

  useQueueSocket({ branchId, enabled: Boolean(branchId) });
  const { data, isLoading } = usePublicBranchQueue(branchId, today);
  const entries = data?.data || [];

  const waiting = entries.filter((e) => e.queueStatus === 'WAITING');
  const calling = entries.filter((e) => ['CALLED', 'IN_CONSULTATION'].includes(e.queueStatus));

  if (!branchId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-2xl">
          {t('reception.display.noBranch', 'Pass ?branchId=<id> to load a branch board.')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="mb-8 text-center text-4xl font-bold tracking-wide">
        {t('reception.display.title', 'Now serving')}
      </h1>

      {isLoading && <p className="text-center text-2xl text-slate-400">{t('common.loading', 'Loading…')}</p>}

      {!isLoading && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-amber-400">
              {t('reception.display.calling', 'Being called / in consultation')}
            </h2>
            <div className="space-y-3">
              {calling.length === 0 && (
                <p className="text-xl text-slate-400">{t('reception.display.none', 'None right now')}</p>
              )}
              {calling.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-2xl bg-amber-500/10 px-6 py-5 ring-1 ring-amber-400/40"
                >
                  <span className="font-display text-5xl font-extrabold text-amber-400">{e.tokenNumber}</span>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{e.patientInitials || '—'}</p>
                    <p className="text-lg text-slate-300">{e.doctorName || t('reception.doctor')}</p>
                    <p className="text-sm uppercase tracking-wide text-amber-300">
                      {STATUS_LABEL[e.queueStatus] || e.queueStatus}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-sky-400">
              {t('reception.display.waiting', 'Waiting')}
            </h2>
            <div className="space-y-2">
              {waiting.length === 0 && (
                <p className="text-xl text-slate-400">{t('reception.display.none', 'None right now')}</p>
              )}
              {waiting.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl bg-slate-800/60 px-6 py-4"
                >
                  <span className="font-display text-3xl font-bold text-sky-300">{e.tokenNumber}</span>
                  <div className="text-right">
                    <p className="text-lg font-medium">{e.patientInitials || '—'}</p>
                    <p className="text-sm text-slate-400">
                      {e.doctorName || t('reception.doctor')} ·{' '}
                      {t('reception.queue.estWait', { count: e.estimatedWaitTime || 0 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
