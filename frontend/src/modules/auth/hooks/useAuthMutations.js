import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { storage, STORAGE_KEYS } from '@/utils/storage';

function persistSession(queryClient, data) {
  const { user, accessToken, refreshToken } = data;
  storage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  storage.set(STORAGE_KEYS.USER, JSON.stringify(user));
  queryClient.setQueryData(QUERY_KEYS.AUTH_ME, user);
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      // SEC-002 — an MFA-enrolled account gets a challenge, not a session; do not store tokens yet.
      if (response.data.mfaRequired) return;
      persistSession(queryClient, response.data);
    },
  });
}

/** Completes login after an MFA challenge (SEC-002). */
export function useVerifyMfaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.verifyMfa,
    onSuccess: (response) => persistSession(queryClient, response.data),
  });
}

/** SEC-021 — begin MFA enrollment using the mfaSetupToken from a login/refresh that returned mfaSetupRequired. */
export function useStartMfaEnrollmentMutation() {
  return useMutation({
    mutationFn: (mfaSetupToken) => authApi.startMfaSetup(mfaSetupToken),
  });
}

/**
 * SEC-021 — confirm MFA enrollment using the mfaSetupToken (no prior session). On success the
 * backend has also completed login, so the response carries real tokens — persist them exactly
 * like a normal login/verifyMfa success.
 */
export function useConfirmMfaEnrollmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, mfaSetupToken }) => authApi.confirmMfaSetup(token, mfaSetupToken),
    onSuccess: (response) => {
      if (response.data.accessToken) {
        persistSession(queryClient, response.data);
      }
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(storage.get(STORAGE_KEYS.REFRESH_TOKEN)),
    onSettled: () => {
      storage.clearAuth();
      queryClient.clear();
    },
  });
}

export function useMeQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.AUTH_ME,
    queryFn: async () => {
      const response = await authApi.me();
      return response.data.user;
    },
    enabled: enabled && Boolean(storage.get(STORAGE_KEYS.ACCESS_TOKEN)),
    retry: false,
  });
}
