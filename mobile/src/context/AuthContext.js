import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasSession } from '../api/client';
import { patientApi } from '../api/patientApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [patient, setPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (await hasSession()) {
          const me = await patientApi.me();
          setPatient(me.patient || me);
        }
      } catch {
        setPatient(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const requestOtp = useCallback((mobile) => patientApi.requestOtp(mobile), []);

  const verifyOtp = useCallback(async (mobile, code) => {
    const loggedInPatient = await patientApi.verifyOtp(mobile, code);
    setPatient(loggedInPatient);
    return loggedInPatient;
  }, []);

  const logout = useCallback(async () => {
    await patientApi.logout();
    setPatient(null);
  }, []);

  const value = useMemo(
    () => ({
      patient,
      isAuthenticated: Boolean(patient),
      isLoading,
      requestOtp,
      verifyOtp,
      logout,
      setPatient,
    }),
    [patient, isLoading, requestOtp, verifyOtp, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
