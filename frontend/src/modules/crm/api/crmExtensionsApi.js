import api from '@/services/api';

export const crmExtensionsApi = {
  // Offers
  listOffers(params) {
    return api.get('/crm-extensions/offers', { params }).then((r) => r.data);
  },
  createOffer(payload) {
    return api.post('/crm-extensions/offers', payload).then((r) => r.data);
  },
  updateOffer(id, payload) {
    return api.patch(`/crm-extensions/offers/${id}`, payload).then((r) => r.data);
  },
  // Recall worklist
  listRecallWorklist(params) {
    return api.get('/crm-extensions/recall', { params }).then((r) => r.data);
  },
  createRecallEntry(payload) {
    return api.post('/crm-extensions/recall', payload).then((r) => r.data);
  },
  recordRecallOutcome(id, payload) {
    return api.post(`/crm-extensions/recall/${id}/outcome`, payload).then((r) => r.data);
  },
  // Feedback / NPS / complaints
  listFeedback(params) {
    return api.get('/crm-extensions/feedback', { params }).then((r) => r.data);
  },
  escalateFeedback(id, payload) {
    return api.post(`/crm-extensions/feedback/${id}/escalate`, payload).then((r) => r.data);
  },
  resolveFeedback(id, payload) {
    return api.post(`/crm-extensions/feedback/${id}/resolve`, payload).then((r) => r.data);
  },
};

export default crmExtensionsApi;
