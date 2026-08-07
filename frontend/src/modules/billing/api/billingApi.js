import api from '@/services/api';

export const billingApi = {
  list(params) {
    return api.get('/billing', { params }).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/billing/${id}`).then((res) => res.data);
  },
  create(payload) {
    return api.post('/billing', payload).then((res) => res.data);
  },
  createFromPlan(planId) {
    return api.post(`/billing/from-plan/${planId}`).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/billing/${id}`, payload).then((res) => res.data);
  },
  voidDraft(id, reason) {
    return api.post(`/billing/${id}/void`, { reason }).then((res) => res.data);
  },
  finalize(id) {
    return api.post(`/billing/${id}/finalize`).then((res) => res.data);
  },
  recordPayment(id, payload) {
    return api.post(`/billing/${id}/payments`, payload).then((res) => res.data);
  },
  listPayments(id) {
    return api.get(`/billing/${id}/payments`).then((res) => res.data);
  },
  print(id) {
    return api.get(`/billing/${id}/print`).then((res) => res.data);
  },
  paymentReceipt(paymentId) {
    return api.get(`/billing/payments/${paymentId}/receipt`).then((res) => res.data);
  },
  emailPlaceholder(id) {
    return api.post(`/billing/${id}/email-placeholder`).then((res) => res.data);
  },
  whatsappPlaceholder(id) {
    return api.post(`/billing/${id}/whatsapp-placeholder`).then((res) => res.data);
  },
};

export default billingApi;
