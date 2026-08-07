import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patientPortalApi } from '../api/patientApi';
import { patientStorage, PATIENT_STORAGE_KEYS } from '../storage';

const keys = {
  me: ['patient-portal', 'me'],
  dashboard: ['patient-portal', 'dashboard'],
  appointments: ['patient-portal', 'appointments'],
  consultations: ['patient-portal', 'consultations'],
  prescriptions: ['patient-portal', 'prescriptions'],
  plans: ['patient-portal', 'plans'],
  invoices: ['patient-portal', 'invoices'],
  notifications: ['patient-portal', 'notifications'],
  unread: ['patient-portal', 'unread'],
  documents: ['patient-portal', 'documents'],
  timeline: ['patient-portal', 'timeline'],
};

export function usePatientLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => patientPortalApi.login(payload).then((r) => r.data),
    onSuccess: (data) => {
      patientStorage.set(PATIENT_STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      patientStorage.set(PATIENT_STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      patientStorage.set(PATIENT_STORAGE_KEYS.PATIENT, JSON.stringify(data.patient));
      qc.setQueryData(keys.me, data.patient);
    },
  });
}

export function usePatientLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      patientPortalApi.logout(patientStorage.get(PATIENT_STORAGE_KEYS.REFRESH_TOKEN)),
    onSettled: () => {
      patientStorage.clear();
      qc.removeQueries({ queryKey: ['patient-portal'] });
    },
  });
}

export function usePatientMe(enabled = true) {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => patientPortalApi.me().then((r) => r.data),
    enabled: enabled && Boolean(patientStorage.get(PATIENT_STORAGE_KEYS.ACCESS_TOKEN)),
    retry: false,
  });
}

export function usePatientDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: () => patientPortalApi.dashboard().then((r) => r.data),
  });
}

export function usePatientAppointments() {
  return useQuery({
    queryKey: keys.appointments,
    queryFn: () => patientPortalApi.appointments().then((r) => r.data),
  });
}

export function usePatientConsultations() {
  return useQuery({
    queryKey: keys.consultations,
    queryFn: () => patientPortalApi.consultations().then((r) => r.data),
  });
}

export function usePatientPrescriptions() {
  return useQuery({
    queryKey: keys.prescriptions,
    queryFn: () => patientPortalApi.prescriptions().then((r) => r.data),
  });
}

export function usePatientPlans() {
  return useQuery({
    queryKey: keys.plans,
    queryFn: () => patientPortalApi.treatmentPlans().then((r) => r.data),
  });
}

export function usePatientInvoices() {
  return useQuery({
    queryKey: keys.invoices,
    queryFn: () => patientPortalApi.invoices().then((r) => r.data),
  });
}

export function usePatientNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => patientPortalApi.notifications().then((r) => r.data),
  });
}

export function usePatientUnread() {
  return useQuery({
    queryKey: keys.unread,
    queryFn: () => patientPortalApi.unreadCount().then((r) => r.data),
  });
}

export function usePatientDocuments() {
  return useQuery({
    queryKey: keys.documents,
    queryFn: () => patientPortalApi.documents().then((r) => r.data),
  });
}

export function usePatientTimeline() {
  return useQuery({
    queryKey: keys.timeline,
    queryFn: () => patientPortalApi.timeline().then((r) => r.data),
  });
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (payload) => patientPortalApi.submitFeedback(payload).then((r) => r.data),
  });
}

export function useUpdatePatientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => patientPortalApi.updateProfile(payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-portal'] }),
  });
}
