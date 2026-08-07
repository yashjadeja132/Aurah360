import { Server } from 'socket.io';
import config from '../config/index.js';
import logger from '../libs/logger.js';

let ioInstance = null;

/**
 * Socket.io bootstrap — queue boards & live reception updates.
 */
export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id });

    socket.on('join:branch', (branchId) => {
      if (branchId) socket.join(`branch:${branchId}`);
    });

    socket.on('join:doctor', (doctorId) => {
      if (doctorId) socket.join(`doctor:${doctorId}`);
    });

    socket.on('leave:branch', (branchId) => {
      if (branchId) socket.leave(`branch:${branchId}`);
    });

    socket.on('leave:doctor', (doctorId) => {
      if (doctorId) socket.leave(`doctor:${doctorId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, reason });
    });
  });

  ioInstance = io;
  logger.info('Socket.io initialized');
  return io;
};

export function getIO() {
  return ioInstance;
}

/**
 * Emit a reception/queue event to branch (+ optional doctor) rooms.
 */
export function emitQueueEvent(eventName, payload = {}) {
  const io = getIO();
  if (!io) {
    logger.warn('Socket emit skipped — io not ready', { eventName });
    return false;
  }

  const branchId = payload.branchId ? String(payload.branchId) : null;
  const doctorId = payload.doctorId ? String(payload.doctorId) : null;
  const data = { ...payload, emittedAt: new Date().toISOString() };

  if (branchId) io.to(`branch:${branchId}`).emit(eventName, data);
  if (doctorId) io.to(`doctor:${doctorId}`).emit(eventName, data);
  io.emit(eventName, data);
  return true;
}

export const SOCKET_EVENTS = Object.freeze({
  PATIENT_CHECKED_IN: 'PatientCheckedIn',
  QUEUE_UPDATED: 'QueueUpdated',
  PATIENT_CALLED: 'PatientCalled',
  QUEUE_COMPLETED: 'QueueCompleted',
  DOCTOR_STATUS_UPDATED: 'DoctorStatusUpdated',
  CONSULTATION_STARTED: 'ConsultationStarted',
  CONSULTATION_COMPLETED: 'ConsultationCompleted',
  CONSULTATION_LOCKED: 'ConsultationLocked',
  TREATMENT_SESSION_STARTED: 'TreatmentSessionStarted',
  TREATMENT_SESSION_COMPLETED: 'TreatmentSessionCompleted',
  MEDICINE_DISPENSED: 'MedicineDispensed',
  STOCK_ADJUSTED: 'StockAdjusted',
  LOW_STOCK_DETECTED: 'LowStockDetected',
  NEAR_EXPIRY_DETECTED: 'NearExpiryDetected',
  LEAD_CREATED: 'LeadCreated',
  LEAD_ASSIGNED: 'LeadAssigned',
  LEAD_CONVERTED: 'LeadConverted',
  FOLLOW_UP_DUE: 'FollowUpDue',
  NOTIFICATION_RECEIVED: 'NotificationReceived',
  ADVERSE_EVENT_REPORTED: 'AdverseEventReported',
});

export default initSocket;
