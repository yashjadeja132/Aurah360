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
  /** A.5 — approver worklist of draft invoices whose discount is above the threshold. */
  discountApprovalQueue(params) {
    return api.get('/billing/discount-approvals', { params }).then((res) => res.data);
  },
  approveDiscount(id, decisionNote) {
    return api.post(`/billing/${id}/approve-discount`, { decisionNote }).then((res) => res.data);
  },
  rejectDiscount(id, decisionNote) {
    return api.post(`/billing/${id}/reject-discount`, { decisionNote }).then((res) => res.data);
  },
  /** A.4 — finalized invoices still carrying a balance, oldest first, with aging buckets. */
  duePayments(params) {
    return api.get('/billing/due-payments', { params }).then((res) => res.data);
  },
  /** A.8 — refund a recorded payment. `reason` must be a REFUND_REASON code. */
  refundPayment(paymentId, payload) {
    return api.post(`/billing/payments/${paymentId}/refund`, payload).then((res) => res.data);
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
