import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { patientApi } from '../api/patientApi';

const DependentsContext = createContext(null);

/**
 * Tracks the guardian's dependents (APP-006) and which patient record the app is
 * currently "acting as". `activeProfile` is either the string 'self' or a dependent
 * object returned by GET /patient/dependents.
 *
 * Dashboard, Appointments, Bills, Documents, Treatments, and booking are all dependent-aware
 * (Task #33) — each screen calls useDependents() and switches to the dependent-scoped
 * PatientPortalService methods (dependentAppointments/dependentInvoices/dependentDocuments/
 * dependentTreatmentPlans/bookDependentAppointment) whenever isViewingDependent is true.
 */
export function DependentsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [dependents, setDependents] = useState([]);
  const [activeProfile, setActiveProfile] = useState('self');
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const list = await patientApi.listDependents();
      setDependents(Array.isArray(list) ? list : []);
    } catch {
      // Non-fatal — the app works fine with an empty dependents list.
      setDependents([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setDependents([]);
      setActiveProfile('self');
    }
  }, [isAuthenticated, refresh]);

  const value = useMemo(
    () => ({
      dependents,
      isLoading,
      activeProfile,
      setActiveProfile,
      isViewingDependent: activeProfile !== 'self',
      refresh,
    }),
    [dependents, isLoading, activeProfile, refresh]
  );

  return <DependentsContext.Provider value={value}>{children}</DependentsContext.Provider>;
}

export function useDependents() {
  const ctx = useContext(DependentsContext);
  if (!ctx) throw new Error('useDependents must be used within DependentsProvider');
  return ctx;
}

export default DependentsContext;
