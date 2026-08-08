import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SessionReadinessBadge } from './SessionReadinessBadge';

/**
 * Bounded wrapper around `SessionReadinessBadge`.
 *
 * Pre-flight is a per-session endpoint (`GET /treatment-sessions/:id/preflight`) — there is no
 * batch/bulk variant, so rendering a badge for every row on a 50-row list means 50 requests.
 * This component keeps readiness *eager for the first `eagerLimit` rows* (the ones a technician
 * actually acts on) and *lazy behind an explicit "Check readiness" click* for the rest, so a long
 * list can never fan out into an N+1 storm. The underlying hook is only mounted once we decide
 * to show it, and TanStack Query dedupes/caches per session id from there on.
 */
export function SessionReadinessCell({ session, index = 0, eagerLimit = 10 }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const startable = ['SCHEDULED', 'CHECKED_IN'].includes(session?.status);

  if (!startable) return null;
  if (index < eagerLimit || revealed) return <SessionReadinessBadge session={session} />;

  return (
    <Button variant="ghost" size="sm" onClick={() => setRevealed(true)}>
      {t('treatmentSessions.readiness.check', 'Check readiness')}
    </Button>
  );
}

export default SessionReadinessCell;
