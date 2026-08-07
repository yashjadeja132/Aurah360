import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { APP_CONFIG } from '@/constants/config';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { SOCKET_EVENTS } from '../constants';
import { storage, STORAGE_KEYS } from '@/utils/storage';

/**
 * Live queue updates via Socket.io — invalidates reception/queue queries.
 */
export function useQueueSocket({ branchId, doctorId = null, enabled = true } = {}) {
  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !branchId) return undefined;

    const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    const socket = io(APP_CONFIG.apiOrigin, {
      path: '/socket.io',
      withCredentials: true,
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:branch', branchId);
      if (doctorId) socket.emit('join:doctor', doctorId);
    });

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['reception'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    };

    Object.values(SOCKET_EVENTS).forEach((event) => {
      socket.on(event, invalidate);
    });

    return () => {
      socket.emit('leave:branch', branchId);
      if (doctorId) socket.emit('leave:doctor', doctorId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [branchId, doctorId, enabled, queryClient]);

  return socketRef;
}

export function receptionQueryKeys(branchId, date) {
  return {
    dashboard: QUERY_KEYS.RECEPTION_DASHBOARD(branchId, date),
    today: QUERY_KEYS.RECEPTION_TODAY(branchId, date),
    branchQueue: QUERY_KEYS.QUEUE_BRANCH(branchId, date),
    summary: QUERY_KEYS.QUEUE_SUMMARY(branchId, date),
  };
}
