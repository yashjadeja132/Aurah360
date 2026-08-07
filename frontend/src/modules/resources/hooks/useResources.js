import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { resourcesApi } from '../api/resourcesApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function useRooms(params = {}) {
  return useQuery({
    queryKey: ['resources', 'rooms', params],
    queryFn: async () => (await resourcesApi.listRooms(params)).data.rooms || [],
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => resourcesApi.createRoom(payload),
    onSuccess: () => {
      toast.success('Room created');
      qc.invalidateQueries({ queryKey: ['resources', 'rooms'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not create room')),
  });
}

export function useUpdateRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => resourcesApi.updateRoomStatus(id, payload),
    onSuccess: () => {
      toast.success('Room status updated');
      qc.invalidateQueries({ queryKey: ['resources', 'rooms'] });
    },
  });
}

export function useDevices(params = {}) {
  return useQuery({
    queryKey: ['resources', 'devices', params],
    queryFn: async () => (await resourcesApi.listDevices(params)).data.devices || [],
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => resourcesApi.createDevice(payload),
    onSuccess: () => {
      toast.success('Device created');
      qc.invalidateQueries({ queryKey: ['resources', 'devices'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not create device')),
  });
}

export function useUpdateDeviceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => resourcesApi.updateDeviceStatus(id, payload),
    onSuccess: () => {
      toast.success('Device status updated');
      qc.invalidateQueries({ queryKey: ['resources', 'devices'] });
    },
  });
}

export function useSkills(params = {}) {
  return useQuery({
    queryKey: ['resources', 'skills', params],
    queryFn: async () => (await resourcesApi.listSkills(params)).data.skills || [],
  });
}

export function useGrantSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => resourcesApi.grantSkill(payload),
    onSuccess: () => {
      toast.success('Skill granted');
      qc.invalidateQueries({ queryKey: ['resources', 'skills'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not grant skill')),
  });
}

export function useRevokeSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => resourcesApi.revokeSkill(id),
    onSuccess: () => {
      toast.success('Skill revoked');
      qc.invalidateQueries({ queryKey: ['resources', 'skills'] });
    },
  });
}
