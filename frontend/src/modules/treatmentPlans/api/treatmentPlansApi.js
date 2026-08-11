import api from '@/services/api';

export const treatmentPlansApi = {
  create(payload) {
    return api.post('/treatment-plans', payload).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/treatment-plans/${id}`).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/treatment-plans/${id}`, payload).then((res) => res.data);
  },
  remove(id) {
    return api.delete(`/treatment-plans/${id}`).then((res) => res.data);
  },
  listByDoctor(params) {
    return api.get('/treatment-plans/doctor', { params }).then((res) => res.data);
  },
  listByPatient(patientId) {
    return api.get(`/treatment-plans/patient/${patientId}`).then((res) => res.data);
  },
  listByConsultation(consultationId) {
    return api.get(`/treatment-plans/consultation/${consultationId}`).then((res) => res.data);
  },
  applyProtocol(id, protocolId) {
    return api.post(`/treatment-plans/${id}/protocol`, { protocolId }).then((res) => res.data);
  },
  applyPackage(id, packageId) {
    return api.post(`/treatment-plans/${id}/package`, { packageId }).then((res) => res.data);
  },
  clearPackage(id) {
    return api.delete(`/treatment-plans/${id}/package`).then((res) => res.data);
  },
  recommend(id) {
    return api.post(`/treatment-plans/${id}/recommend`).then((res) => res.data);
  },
  approve(id) {
    return api.post(`/treatment-plans/${id}/approve`).then((res) => res.data);
  },
  accept(id) {
    return api.post(`/treatment-plans/${id}/accept`).then((res) => res.data);
  },
  reject(id, reason) {
    return api.post(`/treatment-plans/${id}/reject`, { reason }).then((res) => res.data);
  },
  cancel(id) {
    return api.post(`/treatment-plans/${id}/cancel`).then((res) => res.data);
  },
  /** Cross-patient "awaiting approval" worklist — mirrors consultationsApi.labOrderReviewQueue. */
  pendingApprovalQueue(params) {
    return api.get('/treatment-plans/pending-approval', { params }).then((res) => res.data);
  },
  hold(id, note) {
    return api.post(`/treatment-plans/${id}/hold`, { note }).then((res) => res.data);
  },
  unhold(id) {
    return api.post(`/treatment-plans/${id}/unhold`).then((res) => res.data);
  },
  escalate(id, payload) {
    return api.post(`/treatment-plans/${id}/escalate`, payload).then((res) => res.data);
  },
  acceptConsent(planId, consentId, payload) {
    return api
      .post(`/treatment-plans/${planId}/consents/${consentId}/accept`, payload)
      .then((res) => res.data);
  },
  print(id) {
    return api.get(`/treatment-plans/${id}/print`).then((res) => res.data);
  },
  listProtocols(params) {
    return api.get('/treatment-plans/protocols', { params }).then((res) => res.data);
  },
  createProtocol(payload) {
    return api.post('/treatment-plans/protocols', payload).then((res) => res.data);
  },
  listPackages(params) {
    return api.get('/treatment-plans/packages', { params }).then((res) => res.data);
  },
  createPackage(payload) {
    return api.post('/treatment-plans/packages', payload).then((res) => res.data);
  },
};

export default treatmentPlansApi;
