import api from '@/services/api';

export const analyticsApi = {
  dashboard(params) {
    return api.get('/analytics/dashboard', { params }).then((r) => r.data);
  },
  report(category, params) {
    return api.get(`/analytics/reports/${category}`, { params }).then((r) => r.data);
  },
  async exportDownload(category, params = {}) {
    const res = await api.get(`/analytics/reports/${category}/export`, {
      params,
      responseType: 'blob',
    });
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    return { blob: res.data, filename: match?.[1] || `${category}-export` };
  },
  queueExport(category, payload) {
    return api.post(`/analytics/reports/${category}/export/queue`, payload).then((r) => r.data);
  },
};

export default analyticsApi;
