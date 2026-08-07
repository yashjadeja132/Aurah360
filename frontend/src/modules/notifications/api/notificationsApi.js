import api from '@/services/api';

export const notificationsApi = {
  list(params) {
    return api.get('/notifications', { params }).then((r) => r.data);
  },
  inbox(params) {
    return api.get('/notifications/inbox', { params }).then((r) => r.data);
  },
  unreadCount() {
    return api.get('/notifications/unread-count').then((r) => r.data);
  },
  markRead(id) {
    return api.post(`/notifications/${id}/read`).then((r) => r.data);
  },
  markAllRead() {
    return api.post('/notifications/inbox/read-all').then((r) => r.data);
  },
  archive(id) {
    return api.post(`/notifications/${id}/archive`).then((r) => r.data);
  },
  retry(id) {
    return api.post(`/notifications/${id}/retry`).then((r) => r.data);
  },
  reports() {
    return api.get('/notifications/reports/summary').then((r) => r.data);
  },
  listTemplates(params) {
    return api.get('/notifications/templates', { params }).then((r) => r.data);
  },
  updateTemplate(id, payload) {
    return api.patch(`/notifications/templates/${id}`, payload).then((r) => r.data);
  },
  schedule(payload) {
    return api.post('/notifications/schedule', payload).then((r) => r.data);
  },
  processPending() {
    return api.post('/notifications/process-pending').then((r) => r.data);
  },
};

export default notificationsApi;
