import { createContext, useContext, useMemo } from 'react';
import { useMeQuery, useLogoutMutation } from '@/modules/auth/hooks/useAuthMutations';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const hasToken = Boolean(storage.get(STORAGE_KEYS.ACCESS_TOKEN));
  const meQuery = useMeQuery(hasToken);
  const logoutMutation = useLogoutMutation();

  const value = useMemo(
    () => ({
      user: meQuery.data || null,
      isAuthenticated: Boolean(meQuery.data),
      isLoading: hasToken && meQuery.isLoading,
      logout: () => logoutMutation.mutateAsync(),
      isLoggingOut: logoutMutation.isPending,
    }),
    [meQuery.data, meQuery.isLoading, hasToken, logoutMutation]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export default AuthContext;
