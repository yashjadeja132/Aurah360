import { createContext, useContext, useMemo } from 'react';
import { usePatientMe } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientStorage, PATIENT_STORAGE_KEYS } from '@/modules/patientPortal/storage';

const PatientAuthContext = createContext(null);

export function PatientAuthProvider({ children }) {
  const hasToken = Boolean(patientStorage.get(PATIENT_STORAGE_KEYS.ACCESS_TOKEN));
  const { data: patient, isLoading, isError } = usePatientMe(hasToken);

  const value = useMemo(
    () => ({
      patient: patient || null,
      isAuthenticated: Boolean(patient) && hasToken,
      isLoading: hasToken && isLoading,
      isError,
    }),
    [patient, hasToken, isLoading, isError]
  );

  return <PatientAuthContext.Provider value={value}>{children}</PatientAuthContext.Provider>;
}

export function usePatientAuth() {
  const ctx = useContext(PatientAuthContext);
  if (!ctx) throw new Error('usePatientAuth must be used within PatientAuthProvider');
  return ctx;
}
