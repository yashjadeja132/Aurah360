import api from '@/services/api';

export const billingOpsApi = {
  submitCashClose(payload) {
    return api.post('/billing-ops/cash-close', payload).then((res) => res.data);
  },
  listCashCloses(params) {
    return api.get('/billing-ops/cash-close', { params }).then((res) => res.data);
  },
  approveCashClose(id) {
    return api.post(`/billing-ops/cash-close/${id}/approve`).then((res) => res.data);
  },
  listFeeSchedules(params) {
    return api.get('/billing-ops/fee-schedules', { params }).then((res) => res.data);
  },
  createFeeSchedule(payload) {
    return api.post('/billing-ops/fee-schedules', payload).then((res) => res.data);
  },
  deactivateFeeSchedule(id) {
    return api.post(`/billing-ops/fee-schedules/${id}/deactivate`).then((res) => res.data);
  },
};

export default billingOpsApi;
