import api from '@/services/api';

export const staffRosterApi = {
  today(params) {
    return api.get('/staff-roster/today', { params }).then((res) => res.data);
  },
  listLeaves(userId) {
    return api.get(`/staff-roster/${userId}/leaves`).then((res) => res.data);
  },
  markLeave(userId, payload) {
    return api.post(`/staff-roster/${userId}/leaves`, payload).then((res) => res.data);
  },
  deleteLeave(userId, leaveId) {
    return api.delete(`/staff-roster/${userId}/leaves/${leaveId}`).then((res) => res.data);
  },
};

export default staffRosterApi;
