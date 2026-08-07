import api from '@/services/api';

export const reportsApi = {
  dashboard(type, params) {
    return api.get(`/reports/dashboards/${type}`, { params }).then((r) => r.data);
  },
  analytics(params) {
    return api.get('/reports/analytics', { params }).then((r) => r.data);
  },
  kpis(params) {
    return api.get('/reports/kpis', { params }).then((r) => r.data);
  },
  chart(type, params) {
    return api.get(`/reports/charts/${type}`, { params }).then((r) => r.data);
  },
  generate(type, params) {
    return api.get(`/reports/generate/${type}`, { params }).then((r) => r.data);
  },
  async exportDownload(type, params = {}) {
    const res = await api.get(`/reports/export/${type}`, {
      params,
      responseType: 'blob',
    });
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `${type}-export`;
    return { blob: res.data, filename };
  },
  queueExport(type, payload) {
    return api.post(`/reports/export/${type}/queue`, payload).then((r) => r.data);
  },
  getRun(id) {
    return api.get(`/reports/runs/${id}`).then((r) => r.data);
  },
  listScheduled() {
    return api.get('/reports/scheduled').then((r) => r.data);
  },
  createScheduled(payload) {
    return api.post('/reports/scheduled', payload).then((r) => r.data);
  },
  updateScheduled(id, payload) {
    return api.patch(`/reports/scheduled/${id}`, payload).then((r) => r.data);
  },
  deleteScheduled(id) {
    return api.delete(`/reports/scheduled/${id}`).then((r) => r.data);
  },
  listSavedFilters(params) {
    return api.get('/reports/saved-filters', { params }).then((r) => r.data);
  },
  saveFilter(payload) {
    return api.post('/reports/saved-filters', payload).then((r) => r.data);
  },
  deleteSavedFilter(id) {
    return api.delete(`/reports/saved-filters/${id}`).then((r) => r.data);
  },
};

export default reportsApi;
