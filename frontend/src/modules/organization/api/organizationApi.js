import api from '@/services/api';

export const organizationApi = {
  get() {
    return api.get('/organization').then((res) => res.data);
  },
  update(payload) {
    return api.patch('/organization', payload).then((res) => res.data);
  },
};

export default organizationApi;
