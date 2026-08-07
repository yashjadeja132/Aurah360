import api from '@/services/api';

export const resourcesApi = {
  listRooms(params) {
    return api.get('/resources/rooms', { params }).then((r) => r.data);
  },
  createRoom(payload) {
    return api.post('/resources/rooms', payload).then((r) => r.data);
  },
  updateRoomStatus(id, payload) {
    return api.post(`/resources/rooms/${id}/status`, payload).then((r) => r.data);
  },
  listDevices(params) {
    return api.get('/resources/devices', { params }).then((r) => r.data);
  },
  createDevice(payload) {
    return api.post('/resources/devices', payload).then((r) => r.data);
  },
  updateDeviceStatus(id, payload) {
    return api.post(`/resources/devices/${id}/status`, payload).then((r) => r.data);
  },
  listSkills(params) {
    return api.get('/resources/skills', { params }).then((r) => r.data);
  },
  grantSkill(payload) {
    return api.post('/resources/skills', payload).then((r) => r.data);
  },
  revokeSkill(id) {
    return api.post(`/resources/skills/${id}/revoke`).then((r) => r.data);
  },
};

export default resourcesApi;
