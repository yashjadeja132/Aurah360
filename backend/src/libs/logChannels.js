import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

const logDir = config.logging.dir;

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function rotateTransport(filename, level) {
  return new DailyRotateFile({
    filename: path.join(logDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level,
    zippedArchive: true,
  });
}

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

function createChannel(name, filename) {
  return winston.createLogger({
    level: config.logging.level,
    defaultMeta: {
      service: config.app.name,
      env: config.app.env,
      channel: name,
    },
    format: baseFormat,
    transports: [rotateTransport(filename, config.logging.level)],
  });
}

/** Security events: auth failures, rate limits, permission denials. */
export const securityLogger = createChannel('security', 'security');

/** Audit trail mirror (optional dual-write; primary audit remains in Mongo). */
export const auditLogger = createChannel('audit', 'audit');

/** Worker / BullMQ job lifecycle. */
export const workerLogger = createChannel('worker', 'worker');

/** Application errors (in addition to main logger). */
export const errorLogger = createChannel('error', 'error-channel');

export default {
  securityLogger,
  auditLogger,
  workerLogger,
  errorLogger,
};
