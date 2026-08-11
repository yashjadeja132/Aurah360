import api from '@/services/api';

export const queueApi = {
  summary(params) {
    return api.get('/queue/summary', { params }).then((res) => res.data);
  },
  branchQueue(params) {
    return api.get('/queue/branch', { params }).then((res) => res.data);
  },
  /** PRD §6.5 — lobby/TV display board. Same endpoint, `view=PUBLIC` picks the server-side
   * masked serialiser (token + initials + doctor + status only, see QueueService#mapPublic). */
  publicBranchQueue(params) {
    return api.get('/queue/branch', { params: { ...params, view: 'PUBLIC' } }).then((res) => res.data);
  },
  doctorQueue(params) {
    return api.get('/queue/doctor', { params }).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/queue/${id}`).then((res) => res.data);
  },
  callNext(doctorId) {
    return api.post('/queue/call-next', { doctorId }).then((res) => res.data);
  },
  call(id) {
    return api.post(`/queue/${id}/call`).then((res) => res.data);
  },
  recall(id) {
    return api.post(`/queue/${id}/recall`).then((res) => res.data);
  },
  skip(id) {
    return api.post(`/queue/${id}/skip`).then((res) => res.data);
  },
  startConsultation(id) {
    return api.post(`/queue/${id}/start-consultation`).then((res) => res.data);
  },
  complete(id) {
    return api.post(`/queue/${id}/complete`).then((res) => res.data);
  },
  transfer(id, payload) {
    return api.post(`/queue/${id}/transfer`, payload).then((res) => res.data);
  },
  reorder(id, payload) {
    return api.post(`/queue/${id}/reorder`, payload).then((res) => res.data);
  },
};

export default queueApi;
