import { useSyncExternalStore } from 'react';

/**
 * Global clinic selection (simplified flow): '' means "All clinics" and is the default
 * every time the app opens. Owner/Admin switch it from the header dropdown; pages that
 * list cross-clinic data read it as their branch filter. Module-level store — no
 * provider needed, survives route changes, resets to All clinics on every fresh load.
 */
let clinicId = '';
const listeners = new Set();

export function getClinicId() {
  return clinicId;
}

export function setClinicId(next) {
  clinicId = next || '';
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClinicId() {
  return useSyncExternalStore(subscribe, getClinicId, getClinicId);
}
