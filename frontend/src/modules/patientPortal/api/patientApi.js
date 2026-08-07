import axios from 'axios';
import { APP_CONFIG } from '@/constants/config';
import { patientStorage, PATIENT_STORAGE_KEYS } from '../storage';

const patientApi = axios.create({
  baseURL: APP_CONFIG.apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

patientApi.interceptors.request.use((config) => {
  const token = patientStorage.get(PATIENT_STORAGE_KEYS.ACCESS_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;
let queue = [];

patientApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 401 && code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      const refreshToken = patientStorage.get(PATIENT_STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        patientStorage.clear();
        return Promise.reject(error);
      }

      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return patientApi(original);
        });
      }

      refreshing = true;
      try {
        const res = await axios.post(`${APP_CONFIG.apiBaseUrl}/patient/refresh`, {
          refreshToken,
        });
        const next = res.data?.data;
        patientStorage.set(PATIENT_STORAGE_KEYS.ACCESS_TOKEN, next.accessToken);
        patientStorage.set(PATIENT_STORAGE_KEYS.REFRESH_TOKEN, next.refreshToken);
        queue.forEach((p) => p.resolve(next.accessToken));
        queue = [];
        original.headers.Authorization = `Bearer ${next.accessToken}`;
        return patientApi(original);
      } catch (err) {
        queue.forEach((p) => p.reject(err));
        queue = [];
        patientStorage.clear();
        return Promise.reject(err);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const patientPortalApi = {
  login(payload) {
    return patientApi.post('/patient/login', payload).then((r) => r.data);
  },
  logout(refreshToken) {
    return patientApi.post('/patient/logout', { refreshToken }).then((r) => r.data);
  },
  me() {
    return patientApi.get('/patient/me').then((r) => r.data);
  },
  forgotPassword(email) {
    return patientApi.post('/patient/forgot-password', { email }).then((r) => r.data);
  },
  changePassword(payload) {
    return patientApi.post('/patient/change-password', payload).then((r) => r.data);
  },
  dashboard() {
    return patientApi.get('/patient/dashboard').then((r) => r.data);
  },
  profile() {
    return patientApi.get('/patient/profile').then((r) => r.data);
  },
  updateProfile(payload) {
    return patientApi.patch('/patient/profile', payload).then((r) => r.data);
  },
  appointments() {
    return patientApi.get('/patient/appointments').then((r) => r.data);
  },
  bookAppointment(payload) {
    return patientApi.post('/patient/appointments', payload).then((r) => r.data);
  },
  cancelAppointment(id, reason) {
    return patientApi.post(`/patient/appointments/${id}/cancel`, { reason }).then((r) => r.data);
  },
  consultations() {
    return patientApi.get('/patient/consultations').then((r) => r.data);
  },
  consultation(id) {
    return patientApi.get(`/patient/consultations/${id}`).then((r) => r.data);
  },
  prescriptions() {
    return patientApi.get('/patient/prescriptions').then((r) => r.data);
  },
  prescription(id) {
    return patientApi.get(`/patient/prescriptions/${id}`).then((r) => r.data);
  },
  prescriptionPrint(id) {
    return patientApi.get(`/patient/prescriptions/${id}/print`).then((r) => r.data);
  },
  treatmentPlans() {
    return patientApi.get('/patient/treatment-plans').then((r) => r.data);
  },
  treatmentPlan(id) {
    return patientApi.get(`/patient/treatment-plans/${id}`).then((r) => r.data);
  },
  treatmentSessions(params) {
    return patientApi.get('/patient/treatment-sessions', { params }).then((r) => r.data);
  },
  invoices() {
    return patientApi.get('/patient/invoices').then((r) => r.data);
  },
  invoice(id) {
    return patientApi.get(`/patient/invoices/${id}`).then((r) => r.data);
  },
  invoicePrint(id) {
    return patientApi.get(`/patient/invoices/${id}/print`).then((r) => r.data);
  },
  outstanding() {
    return patientApi.get('/patient/invoices/outstanding').then((r) => r.data);
  },
  documents() {
    return patientApi.get('/patient/documents').then((r) => r.data);
  },
  notifications() {
    return patientApi.get('/patient/notifications').then((r) => r.data);
  },
  unreadCount() {
    return patientApi.get('/patient/notifications/unread-count').then((r) => r.data);
  },
  markRead(id) {
    return patientApi.post(`/patient/notifications/${id}/read`).then((r) => r.data);
  },
  submitFeedback(payload) {
    return patientApi.post('/patient/feedback', payload).then((r) => r.data);
  },
  timeline() {
    return patientApi.get('/patient/timeline').then((r) => r.data);
  },
};

export default patientPortalApi;
