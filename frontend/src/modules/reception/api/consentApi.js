import api from '@/services/api';

/**
 * Consent lookup used by the reception desk landing.
 *
 * The consent module only exposes a PER-PATIENT read (`GET /consent/patients/:patientId`) — there
 * is no bulk/list endpoint and no `ids` filter anywhere, so the desk landing resolves consent for
 * the (small, bounded) set of patients who are physically present today rather than for the whole
 * day sheet. See `useReceptionDesk` for the cap.
 *
 * RECEPTIONIST holds `consent.view`, so this is readable by the role the screen is built for.
 */
export const consentApi = {
  /** → [{ purpose, state, recordedAt, definitionVersion, method }] */
  currentStates(patientId) {
    return api.get(`/consent/patients/${patientId}`).then((r) => r.data);
  },
  /** → [{ id, purpose, version, title, isActive, effectiveFrom }] */
  listDefinitions() {
    return api.get('/consent/definitions').then((r) => r.data);
  },
};

export default consentApi;
