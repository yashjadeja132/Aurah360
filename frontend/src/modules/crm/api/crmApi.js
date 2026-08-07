import api from '@/services/api';

export const crmApi = {
  dashboard(params) {
    return api.get('/crm/dashboard', { params }).then((r) => r.data);
  },
  list(params) {
    return api.get('/crm/leads', { params }).then((r) => r.data);
  },
  pipeline(params) {
    return api.get('/crm/pipeline', { params }).then((r) => r.data);
  },
  getById(id) {
    return api.get(`/crm/leads/${id}`).then((r) => r.data);
  },
  create(payload) {
    return api.post('/crm/leads', payload).then((r) => r.data);
  },
  update(id, payload) {
    return api.patch(`/crm/leads/${id}`, payload).then((r) => r.data);
  },
  assign(id, assignedTo) {
    return api.post(`/crm/leads/${id}/assign`, { assignedTo }).then((r) => r.data);
  },
  changeStatus(id, payload) {
    return api.post(`/crm/leads/${id}/status`, payload).then((r) => r.data);
  },
  addFollowUp(id, payload) {
    return api.post(`/crm/leads/${id}/follow-ups`, payload).then((r) => r.data);
  },
  convert(id, payload = {}) {
    return api.post(`/crm/leads/${id}/convert`, payload).then((r) => r.data);
  },
  logCommunication(id, payload) {
    return api.post(`/crm/leads/${id}/communications`, payload).then((r) => r.data);
  },
  listTasks(params) {
    return api.get('/crm/tasks', { params }).then((r) => r.data);
  },
  createTask(payload) {
    return api.post('/crm/tasks', payload).then((r) => r.data);
  },
  updateTask(id, payload) {
    return api.patch(`/crm/tasks/${id}`, payload).then((r) => r.data);
  },
  report(type, params) {
    return api.get(`/crm/reports/${type}`, { params }).then((r) => r.data);
  },
};

export default crmApi;
