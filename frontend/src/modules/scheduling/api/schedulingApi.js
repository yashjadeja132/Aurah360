import api from '@/services/api';

export const schedulingApi = {
  getAvailableSlots(params) {
    return api.get('/scheduling/slots', { params }).then((res) => res.data);
  },
  checkAvailability(payload) {
    return api.post('/scheduling/check', payload).then((res) => res.data);
  },
  validateSlot(payload) {
    return api.post('/scheduling/validate-slot', payload).then((res) => res.data);
  },
  weeklyPreview(params) {
    return api.get('/scheduling/weekly-preview', { params }).then((res) => res.data);
  },
  listHolidays(branchId) {
    return api.get('/scheduling/holidays', { params: { branchId } }).then((res) => res.data);
  },
  createHoliday(payload) {
    return api.post('/scheduling/holidays', payload).then((res) => res.data);
  },
  updateHoliday(id, payload) {
    return api.patch(`/scheduling/holidays/${id}`, payload).then((res) => res.data);
  },
  deleteHoliday(id) {
    return api.delete(`/scheduling/holidays/${id}`).then((res) => res.data);
  },
  listBlocked(params) {
    return api.get('/scheduling/blocked-slots', { params }).then((res) => res.data);
  },
  createBlocked(payload) {
    return api.post('/scheduling/blocked-slots', payload).then((res) => res.data);
  },
  updateBlocked(id, payload) {
    return api.patch(`/scheduling/blocked-slots/${id}`, payload).then((res) => res.data);
  },
  deleteBlocked(id) {
    return api.delete(`/scheduling/blocked-slots/${id}`).then((res) => res.data);
  },
  listSpecial(params) {
    return api.get('/scheduling/special-schedules', { params }).then((res) => res.data);
  },
  upsertSpecial(payload) {
    return api.put('/scheduling/special-schedules', payload).then((res) => res.data);
  },
  deleteSpecial(id) {
    return api.delete(`/scheduling/special-schedules/${id}`).then((res) => res.data);
  },
};

export default schedulingApi;
