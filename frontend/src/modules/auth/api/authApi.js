import api from '@/services/api';

export const authApi = {
  login(payload) {
    return api.post('/auth/login', payload).then((res) => res.data);
  },
  verifyMfa(payload) {
    return api.post('/auth/mfa/verify', payload).then((res) => res.data);
  },
  // `mfaSetupToken` is passed when the caller doesn't have a real session yet — i.e. login/refresh
  // returned `mfaSetupRequired` for a privileged role that must enroll in MFA before a session
  // exists. The backend's authenticateOrMfaSetupToken middleware accepts it in place of a
  // Bearer/cookie session. Omit it (undefined) for the normal, already-authenticated opt-in flow.
  startMfaSetup(mfaSetupToken) {
    return api.post('/auth/mfa/setup/start', mfaSetupToken ? { mfaSetupToken } : {}).then((res) => res.data);
  },
  confirmMfaSetup(token, mfaSetupToken) {
    return api
      .post('/auth/mfa/setup/confirm', mfaSetupToken ? { token, mfaSetupToken } : { token })
      .then((res) => res.data);
  },
  disableMfa(token) {
    return api.post('/auth/mfa/disable', { token }).then((res) => res.data);
  },
  refresh(refreshToken) {
    return api.post('/auth/refresh', { refreshToken }).then((res) => res.data);
  },
  logout(refreshToken) {
    return api.post('/auth/logout', { refreshToken }).then((res) => res.data);
  },
  me() {
    return api.get('/auth/me').then((res) => res.data);
  },
  updateProfile(payload) {
    return api.patch('/auth/me', payload).then((res) => res.data);
  },
  changePassword(payload) {
    return api.post('/auth/change-password', payload).then((res) => res.data);
  },
  forgotPassword(payload) {
    return api.post('/auth/forgot-password', payload).then((res) => res.data);
  },
};

export default authApi;
