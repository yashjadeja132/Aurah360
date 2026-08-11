import api from '@/services/api';

export const consultationsApi = {
  start(payload) {
    return api.post('/consultations', payload).then((res) => res.data);
  },
  getWorkspace(id) {
    return api.get(`/consultations/${id}/workspace`).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/consultations/${id}`).then((res) => res.data);
  },
  listByPatient(patientId) {
    return api.get(`/consultations/patient/${patientId}`).then((res) => res.data);
  },
  listByDoctor(params) {
    return api.get('/consultations/doctor', { params }).then((res) => res.data);
  },
  patientSummary(patientId) {
    return api.get(`/consultations/patient/${patientId}/summary`).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/consultations/${id}`, payload).then((res) => res.data);
  },
  sign(id) {
    return api.post(`/consultations/${id}/sign`).then((res) => res.data);
  },
  lock(id) {
    return api.post(`/consultations/${id}/lock`).then((res) => res.data);
  },
  unlock(id) {
    return api.post(`/consultations/${id}/unlock`).then((res) => res.data);
  },
  /** §3.7 — per-section classified release; sections: [{key,label,text,classification}]. */
  releaseSummary(id, payload) {
    return api.post(`/consultations/${id}/release-summary`, payload).then((res) => res.data);
  },
  autosaveSoap(id, payload) {
    return api.post(`/consultations/${id}/soap/autosave`, payload).then((res) => res.data);
  },
  soapVersions(id) {
    return api.get(`/consultations/${id}/soap/versions`).then((res) => res.data);
  },
  saveVitals(id, payload) {
    return api.put(`/consultations/${id}/vitals`, payload).then((res) => res.data);
  },
  saveDiagnosis(id, payload) {
    return api.put(`/consultations/${id}/diagnosis`, payload).then((res) => res.data);
  },
  saveExamination(id, payload) {
    return api.put(`/consultations/${id}/examination`, payload).then((res) => res.data);
  },
  listPhotos(id) {
    return api.get(`/consultations/${id}/photos`).then((res) => res.data);
  },
  uploadPhoto(id, formData) {
    return api
      .post(`/consultations/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },
  /** IMG-005 — photoId is global, not consultation-scoped (mirrors the verify-consent route). */
  releasePhoto(photoId, visibility) {
    return api.post(`/consultations/photos/${photoId}/release`, { visibility }).then((res) => res.data);
  },
  listLabOrders(id) {
    return api.get(`/consultations/${id}/lab-orders`).then((res) => res.data);
  },
  labOrderReviewQueue(params) {
    return api.get('/consultations/lab-orders/review-queue', { params }).then((res) => res.data);
  },
  /** §5 — cross-patient Follow-ups due/overdue worklist. */
  followUpQueue(params) {
    return api.get('/consultations/follow-ups', { params }).then((res) => res.data);
  },
  updateFollowUpStatus(id, payload) {
    return api.patch(`/consultations/${id}/follow-up-status`, payload).then((res) => res.data);
  },
  createLabOrder(id, payload) {
    return api.post(`/consultations/${id}/lab-orders`, payload).then((res) => res.data);
  },
  updateLabOrder(id, labOrderId, payload) {
    return api
      .patch(`/consultations/${id}/lab-orders/${labOrderId}`, payload)
      .then((res) => res.data);
  },
  listTemplates(params) {
    return api.get('/consultations/templates', { params }).then((res) => res.data);
  },
  createTemplate(payload) {
    return api.post('/consultations/templates', payload).then((res) => res.data);
  },
  /** Settings → Masters admin listing — unscoped, paginated/searchable. */
  listAllTemplates(params) {
    return api.get('/consultations/templates/all', { params }).then((res) => res.data);
  },
  updateTemplate(id, payload) {
    return api.patch(`/consultations/templates/${id}`, payload).then((res) => res.data);
  },
  deleteTemplate(id) {
    return api.delete(`/consultations/templates/${id}`).then((res) => res.data);
  },
  approveTemplate(id) {
    return api.post(`/consultations/templates/${id}/approve`).then((res) => res.data);
  },
};

export default consultationsApi;
