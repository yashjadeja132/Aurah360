import axios from 'axios';
import * as Keychain from 'react-native-keychain';

/**
 * Base URL for the ClinicOS API. Android emulator uses 10.0.2.2 to reach the host's
 * localhost; a real device on the same Wi-Fi/USB-tethered network needs the host's LAN IP
 * instead (adb reverse is the other option for USB-only setups).
 */
export const API_BASE_URL = 'http://192.168.1.5:5000/api/v1/patient';

/**
 * File-serving base for the patient portal's own file routes (`/files/patient/...`, distinct
 * from the `/patient/...` API prefix above). Task #46 added a signed short-lived `?token=`
 * issuance endpoint here (`/files/patient/documents/:id/token`, `/files/patient/photos/:id/token`
 * — mirrors the staff app's `/files/documents/:id/token` from Task #24), so downloads exchange
 * the patient's session for one of those tokens instead of attaching the long-lived Bearer
 * session token directly to the file request — see `fetchPatientFileAsDataUri` in patientApi.js.
 */
export const FILES_BASE_URL = API_BASE_URL.replace(/\/patient$/, '/files/patient');

// Task #35 — access/refresh tokens now live in the Android Keystore (via react-native-keychain)
// instead of plain-text AsyncStorage. Each token gets its own Keychain "service" key since the
// API only supports one username/password pair per service. Non-sensitive prefs (language,
// PIN hash, etc.) elsewhere in the app intentionally stay on AsyncStorage — only the bearer
// tokens that can impersonate the patient's session move to secure storage.
const KEYCHAIN_SERVICE = {
  ACCESS_TOKEN: 'aurah360.patient.accessToken',
  REFRESH_TOKEN: 'aurah360.patient.refreshToken',
};

/** Keychain stores a username+password pair; we only need one secret per service, so the
 *  username is a fixed placeholder and the token itself is the "password". */
async function secureSet(service, value) {
  if (!value) return;
  await Keychain.setGenericPassword('token', value, { service });
}

async function secureGet(service) {
  const result = await Keychain.getGenericPassword({ service });
  return result ? result.password : null;
}

async function secureClear(service) {
  await Keychain.resetGenericPassword({ service });
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await secureGet(KEYCHAIN_SERVICE.ACCESS_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshingPromise = null;

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    if (response?.status === 401 && !config._retried) {
      config._retried = true;
      try {
        if (!refreshingPromise) refreshingPromise = refreshTokens();
        const newAccessToken = await refreshingPromise;
        refreshingPromise = null;
        if (newAccessToken) {
          config.headers.Authorization = `Bearer ${newAccessToken}`;
          return client(config);
        }
      } catch {
        refreshingPromise = null;
      }
    }
    return Promise.reject(error);
  }
);

async function refreshTokens() {
  const refreshToken = await secureGet(KEYCHAIN_SERVICE.REFRESH_TOKEN);
  if (!refreshToken) return null;
  const { data } = await axios.post(`${API_BASE_URL}/refresh`, { refreshToken });
  await secureSet(KEYCHAIN_SERVICE.ACCESS_TOKEN, data.data.accessToken);
  await secureSet(KEYCHAIN_SERVICE.REFRESH_TOKEN, data.data.refreshToken);
  return data.data.accessToken;
}

export async function persistSession({ accessToken, refreshToken }) {
  await secureSet(KEYCHAIN_SERVICE.ACCESS_TOKEN, accessToken);
  await secureSet(KEYCHAIN_SERVICE.REFRESH_TOKEN, refreshToken);
}

export async function clearSession() {
  await Promise.all([
    secureClear(KEYCHAIN_SERVICE.ACCESS_TOKEN),
    secureClear(KEYCHAIN_SERVICE.REFRESH_TOKEN),
  ]);
}

export async function hasSession() {
  const token = await secureGet(KEYCHAIN_SERVICE.ACCESS_TOKEN);
  return Boolean(token);
}

export async function getStoredRefreshToken() {
  return secureGet(KEYCHAIN_SERVICE.REFRESH_TOKEN);
}

export async function getStoredAccessToken() {
  return secureGet(KEYCHAIN_SERVICE.ACCESS_TOKEN);
}

export default client;
