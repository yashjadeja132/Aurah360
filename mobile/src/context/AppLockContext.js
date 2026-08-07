import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { simpleHash } from '../utils/simpleHash';

const AppLockContext = createContext(null);

const STORAGE_KEYS = {
  PIN_HASH: 'aurah360.patient.pinHash',
};

const MAX_ATTEMPTS = 5;
const THROTTLE_SECONDS = 30;

/**
 * AppLockContext — a local, PIN-based "app open" gate layered on top of the real OTP/JWT
 * session (see AuthContext.js). It is not a security boundary on its own (see simpleHash.js);
 * it only re-locks the UI after the app has been backgrounded, so someone picking up an
 * unlocked phone can't casually browse the patient's records without the PIN.
 */
export function AppLockProvider({ children }) {
  const [hasPinSet, setHasPinSet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    (async () => {
      const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.PIN_HASH);
      const pinSet = Boolean(storedHash);
      setHasPinSet(pinSet);
      // Lock immediately on cold start if a PIN is already set.
      setIsLocked(pinSet);
      setIsReady(true);
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appState.current;
      appState.current = nextState;

      const wasInBackground = prevState === 'background' || prevState === 'inactive';
      if (nextState === 'active' && wasInBackground) {
        // Re-lock on resume — the actual "app lock" behavior. We re-read from state rather
        // than closing over hasPinSet to avoid a stale-closure re-subscribe.
        AsyncStorage.getItem(STORAGE_KEYS.PIN_HASH).then((storedHash) => {
          if (storedHash) setIsLocked(true);
        });
      }
    });

    return () => subscription.remove();
  }, []);

  const setPin = useCallback(async (pin) => {
    const hash = simpleHash(pin);
    await AsyncStorage.setItem(STORAGE_KEYS.PIN_HASH, hash);
    setHasPinSet(true);
    setIsLocked(false);
  }, []);

  const verifyPin = useCallback(async (pin) => {
    const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.PIN_HASH);
    if (!storedHash) return false;
    const matches = simpleHash(pin) === storedHash;
    if (matches) setIsLocked(false);
    return matches;
  }, []);

  const disablePin = useCallback(async (currentPin) => {
    const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.PIN_HASH);
    if (!storedHash || simpleHash(currentPin) !== storedHash) return false;
    await AsyncStorage.removeItem(STORAGE_KEYS.PIN_HASH);
    setHasPinSet(false);
    setIsLocked(false);
    return true;
  }, []);

  const lock = useCallback(() => {
    // Manual re-lock (e.g. call on logout so the next login starts from a locked state if a
    // PIN is set). No-op when no PIN has been configured.
    setIsLocked(true);
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      isLockEnabled: hasPinSet,
      hasPinSet,
      isLocked: hasPinSet && isLocked,
      setPin,
      verifyPin,
      disablePin,
      lock,
      maxAttempts: MAX_ATTEMPTS,
      throttleSeconds: THROTTLE_SECONDS,
    }),
    [isReady, hasPinSet, isLocked, setPin, verifyPin, disablePin, lock]
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}

export default AppLockContext;
