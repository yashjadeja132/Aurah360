import client, { FILES_BASE_URL, persistSession, clearSession, getStoredRefreshToken, getStoredAccessToken } from './client';

/**
 * Fetches a released file (document/photo) from the patient portal's file-serving route and
 * returns it as a `data:` URI, so callers can hand it to `Linking.openURL` without any native
 * file-download/viewer dependency.
 *
 * Task #46 — mirrors the staff app's signed-token flow (`/files/documents/:id/token`, Task
 * #24): first exchange the patient's session for a short-lived signed `?token=` scoped to this
 * exact file id (`tokenPath`), then fetch the file with that token instead of attaching the
 * long-lived Bearer session token to a plain unsigned download request.
 */
async function fetchPatientFileAsDataUri(path, tokenPath) {
  const token = await getStoredAccessToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const tokenResponse = await fetch(`${FILES_BASE_URL}${tokenPath}`, { headers: authHeaders });
  if (!tokenResponse.ok) {
    const err = new Error(`Could not obtain a file access token (${tokenResponse.status})`);
    err.status = tokenResponse.status;
    throw err;
  }
  const tokenBody = await tokenResponse.json();
  const fileToken = tokenBody?.token;
  if (!fileToken) {
    const err = new Error('Could not obtain a file access token');
    err.status = 502;
    throw err;
  }

  const response = await fetch(`${FILES_BASE_URL}${path}?token=${encodeURIComponent(fileToken)}`, {
    headers: authHeaders,
  });
  if (!response.ok) {
    const err = new Error(`File request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/** Thin wrapper over every /patient endpoint the app screens use. */
export const patientApi = {
  // --- Auth (APP-002 — OTP is the primary sign-in path) -------------------------------------------------------------
  async requestOtp(mobile) {
    const { data } = await client.post('/otp-request', { mobile });
    return data.data;
  },
  async verifyOtp(mobile, code) {
    const { data } = await client.post('/otp-login', { mobile, code });
    await persistSession(data.data);
    return data.data.patient;
  },
  async logout() {
    const refreshToken = await getStoredRefreshToken();
    try {
      await client.post('/logout', { refreshToken });
    } finally {
      await clearSession();
    }
  },
  async me() {
    const { data } = await client.get('/me');
    return data.data;
  },

  // --- Home / dashboard -------------------------------------------------------------
  async dashboard() {
    const { data } = await client.get('/dashboard');
    return data.data;
  },

  // --- Dependents / profile switching (APP-006) -------------------------------------------------------------
  async listDependents() {
    const { data } = await client.get('/dependents');
    return data.data;
  },
  async dependentDashboard(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/dashboard`);
    return data.data;
  },
  async dependentAppointments(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/appointments`);
    return data.data;
  },
  async dependentInvoices(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/invoices`);
    return data.data;
  },
  async dependentDocuments(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/documents`);
    return data.data;
  },
  async dependentTreatmentPlans(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/treatment-plans`);
    return data.data;
  },

  // --- Appointments -------------------------------------------------------------
  async listAppointments() {
    const { data } = await client.get('/appointments');
    return data.data;
  },
  async availableSlots(params) {
    const { data } = await client.get('/appointments/slots', { params });
    return data.data;
  },
  async bookAppointment(payload) {
    const { data } = await client.post('/appointments', payload);
    return data.data;
  },
  async bookDependentAppointment(dependentId, payload) {
    const { data } = await client.post(`/dependents/${dependentId}/appointments`, payload);
    return data.data;
  },
  async cancelAppointment(id, reason) {
    const { data } = await client.post(`/appointments/${id}/cancel`, { reason });
    return data.data;
  },
  async rescheduleAppointment(id, payload) {
    const { data } = await client.post(`/appointments/${id}/reschedule`, payload);
    return data.data;
  },

  // --- Health timeline (released records only — §13.2) -------------------------------------------------------------
  // NOTE: `/consultations` (list + detail) returns the full clinical record (SOAP, diagnosis,
  // examination, photos) with no filter on release status — it is NOT safe to render directly in
  // the app. `/timeline` only ever contains lightweight event records (title/description/metadata,
  // no clinical payload) so it's the safe source for the patient-facing health timeline screen.
  async listConsultations() {
    const { data } = await client.get('/consultations');
    return data.data;
  },
  async listPrescriptions() {
    const { data } = await client.get('/prescriptions');
    return data.data;
  },
  async timeline() {
    const { data } = await client.get('/timeline');
    return data.data;
  },
  async dependentTimeline(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/timeline`);
    return data.data;
  },
  async dependentPrescriptions(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/prescriptions`);
    return data.data;
  },

  // --- Treatments / packages -------------------------------------------------------------
  async listTreatmentPlans() {
    const { data } = await client.get('/treatment-plans');
    return data.data;
  },
  async listTreatmentSessions() {
    const { data } = await client.get('/treatment-sessions');
    return data.data;
  },

  // --- Bills / receipts -------------------------------------------------------------
  async listInvoices() {
    const { data } = await client.get('/invoices');
    return data.data;
  },
  async outstanding() {
    const { data } = await client.get('/invoices/outstanding');
    return data.data;
  },

  // --- Documents -------------------------------------------------------------
  async listDocuments() {
    const { data } = await client.get('/documents');
    return data.data;
  },
  /** Opens a released document as a `data:` URI — see `fetchPatientFileAsDataUri` above. */
  async downloadDocument(documentId) {
    return fetchPatientFileAsDataUri(`/documents/${documentId}`, `/documents/${documentId}/token`);
  },
  /** Opens a released clinical photo as a `data:` URI (same mechanism as documents). */
  async downloadPhoto(photoId) {
    return fetchPatientFileAsDataUri(`/photos/${photoId}`, `/photos/${photoId}/token`);
  },

  // --- Invoices / receipts (print) --------------------------------------------------
  // NOTE: `invoicePrint`/`paymentReceipt` do NOT return a PDF or a file at all — the
  // backend (BillingService#getPrintData/#getPaymentReceipt) returns the invoice/payment
  // JSON plus a `printMeta` object of placeholder flags (`clinicLogoPlaceholder`,
  // `qrPlaceholder`, etc.). There is no real document-generation behind these routes yet,
  // so the UI must render this as an in-app summary, not attempt a "download".
  async invoicePrint(invoiceId) {
    const { data } = await client.get(`/invoices/${invoiceId}/print`);
    return data.data;
  },
  async paymentReceipt(paymentId) {
    const { data } = await client.get(`/payments/${paymentId}/receipt`);
    return data.data;
  },

  // --- Loyalty & Rewards (LOY) -------------------------------------------------------------
  async loyaltyBalance() {
    const { data } = await client.get('/loyalty/balance');
    return data.data;
  },
  async loyaltyLedger(params) {
    const { data } = await client.get('/loyalty/ledger', { params });
    return data.data;
  },
  // LOY-010 — "how to earn" list generated from currently-active earning rules (rule-driven,
  // not hard-coded text).
  async loyaltyEarnRules() {
    const { data } = await client.get('/loyalty/earn-rules');
    return data.data;
  },
  async dependentLoyaltyBalance(dependentId) {
    const { data } = await client.get(`/dependents/${dependentId}/loyalty/balance`);
    return data.data;
  },
  async dependentLoyaltyLedger(dependentId, params) {
    const { data } = await client.get(`/dependents/${dependentId}/loyalty/ledger`, { params });
    return data.data;
  },
  // LOY Flow C — patient's own referral code/link + generic status list of who they referred
  // (first-name-or-null + status only, no clinical/financial detail — enforced server-side).
  async referral() {
    const { data } = await client.get('/referral');
    return data.data;
  },

  // --- Notifications / inbox -------------------------------------------------------------
  async notifications() {
    const { data } = await client.get('/notifications');
    return data.data;
  },
  async unreadCount() {
    const { data } = await client.get('/notifications/unread-count');
    return data.data;
  },
  async markNotificationRead(id) {
    const { data } = await client.post(`/notifications/${id}/read`);
    return data.data;
  },

  // --- Offers -------------------------------------------------------------
  async listOffers() {
    const { data } = await client.get('/offers');
    return data.data;
  },

  // --- Profile / preferences -------------------------------------------------------------
  async getProfile() {
    const { data } = await client.get('/profile');
    return data.data;
  },
  async updateProfile(payload) {
    const { data } = await client.patch('/profile', payload);
    return data.data;
  },

  // --- Feedback / support -------------------------------------------------------------
  async submitFeedback(payload) {
    const { data } = await client.post('/feedback', payload);
    return data.data;
  },

  // --- Privacy / data-subject rights (§16.5, PRV-002) -------------------------------------------------------------
  async submitPrivacyRequest(requestType, details) {
    const { data } = await client.post('/privacy-requests', { requestType, details });
    return data.data;
  },
  async listPrivacyRequests() {
    const { data } = await client.get('/privacy-requests');
    return data.data;
  },
};

export default patientApi;
