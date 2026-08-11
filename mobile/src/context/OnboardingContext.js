import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_COMPLETE_KEY } from '../constants/onboarding';
import { useAuth } from './AuthContext';

const OnboardingContext = createContext(null);

/**
 * Tracks whether the first-run onboarding sequence (privacy notice → language/notifications/
 * app-lock preferences, spec: "Privacy notice ... → {Acknowledge} → {Language}{Notification
 * permission}{Optional biometric/app lock} → account linked to MRN → Home") has been completed
 * on this device. It's per-install (not per-account) — once acknowledged here, it should never
 * show again on this phone, even after logout/login, which is why the flag lives in
 * AsyncStorage rather than on the account.
 */
export function OnboardingProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isAuthenticated) {
        setIsReady(true);
        return;
      }
      const done = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      setNeedsOnboarding(done !== 'true');
      setIsReady(true);
    })();
  }, [isAuthenticated]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setNeedsOnboarding(false);
  }, []);

  const value = useMemo(
    () => ({ isReady, needsOnboarding, completeOnboarding }),
    [isReady, needsOnboarding, completeOnboarding]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

export default OnboardingContext;
