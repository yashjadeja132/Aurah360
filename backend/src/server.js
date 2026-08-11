import http from 'http';
import App from './app.js';
import config from './config/index.js';
import database from './config/database.js';
import OrganizationRepository from './repositories/OrganizationRepository.js';
import redisClient from './config/redis.js';
import { initSocket } from './socket/index.js';
import { crmHandlerModule } from './queues/crmJobs.js';
import { startAppointmentReminderWorker } from './queues/appointmentReminderJobs.js';
import { missedFollowUpHandlerModule } from './queues/missedFollowUpJobs.js';
import { loyaltyExpiryHandlerModule } from './queues/loyaltyExpiryJobs.js';
import { loyaltyBirthdayHandlerModule } from './queues/loyaltyBirthdayJobs.js';
import { loyaltyTierHandlerModule } from './queues/loyaltyTierJobs.js';
import { startComposedWorker, assertScheduledJobsAreHandled } from './queues/composeWorker.js';
import { QUEUE_NAMES } from './queues/connection.js';
import { startNotificationWorker } from './queues/notificationJobs.js';
import { startReportWorker } from './queues/reportJobs.js';
import { startAnalyticsWorker } from './queues/analyticsJobs.js';
import { registerNotificationEventListeners } from './notifications/eventSubscriptions.js';
import { registerAdverseEventAlertListeners } from './notifications/adverseEventAlertListener.js';
import { registerLoyaltyEventListeners } from './loyalty/eventSubscriptions.js';
import { startMaintenanceJobs, stopMaintenanceJobs } from './jobs/index.js';
import logger from './libs/logger.js';
import { errorLogger } from './libs/logChannels.js';

class Server {
  constructor() {
    this.app = new App().getExpressApp();
    this.httpServer = http.createServer(this.app);
    this.io = null;
  }

  async start() {
    try {
      this.#registerProcessHandlers();
      await database.connect();

      /**
       * Prime the synchronous org runtime mirror (timezone / financial-year start) before any
       * request can build an aggregation. Non-fatal: orgRuntime falls back to the env defaults.
       */
      try {
        await new OrganizationRepository().getSingleton();
      } catch (err) {
        logger.warn('Organization settings not loaded — using environment defaults', {
          message: err.message,
        });
      }

      try {
        await redisClient.ready();
      } catch (err) {
        logger.warn('Redis unavailable at startup — continuing without cache/jobs', {
          message: err.message,
        });
      }

      this.io = initSocket(this.httpServer);

      /**
       * ONE worker per queue, composed from the handler modules that share it.
       *
       * CRM and LOYALTY each previously had TWO workers racing for the same queue, and BullMQ gives
       * a job to exactly one consumer — so the loser returned `{ ignored: true }`, the job was
       * marked completed, and the work never happened. Roughly half of all expiry, birthday,
       * follow-up and missed-follow-up runs disappeared without an error anywhere.
       */
      try {
        startComposedWorker(QUEUE_NAMES.CRM, [crmHandlerModule, missedFollowUpHandlerModule]);
        assertScheduledJobsAreHandled(QUEUE_NAMES.CRM).catch(() => {});
      } catch (err) {
        logger.warn('CRM queue worker not started', { message: err.message });
      }

      try {
        startAppointmentReminderWorker();
      } catch (err) {
        logger.warn('Appointment reminder worker not started', { message: err.message });
      }

      try {
        startComposedWorker(QUEUE_NAMES.LOYALTY, [
          loyaltyExpiryHandlerModule,
          loyaltyBirthdayHandlerModule,
          loyaltyTierHandlerModule,
        ]);
        assertScheduledJobsAreHandled(QUEUE_NAMES.LOYALTY).catch(() => {});
      } catch (err) {
        logger.warn('Loyalty queue worker not started', { message: err.message });
      }

      try {
        registerNotificationEventListeners();
        registerAdverseEventAlertListeners();
        registerLoyaltyEventListeners();
        startNotificationWorker();
      } catch (err) {
        logger.warn('Notification worker not started', { message: err.message });
      }

      try {
        startReportWorker();
      } catch (err) {
        logger.warn('Report worker not started', { message: err.message });
      }

      try {
        startAnalyticsWorker();
      } catch (err) {
        logger.warn('Analytics worker not started', { message: err.message });
      }

      startMaintenanceJobs();

      this.httpServer.listen(config.app.port, () => {
        logger.info(`${config.clinic.name} ClinicOS API listening`, {
          port: config.app.port,
          env: config.app.env,
          apiPrefix: config.app.apiPrefix,
        });
      });

      this.#registerShutdown();
    } catch (error) {
      logger.error('Failed to start server', { message: error.message, stack: error.stack });
      process.exit(1);
    }
  }

  #registerProcessHandlers() {
    process.on('unhandledRejection', (reason) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      errorLogger.error('Unhandled rejection', { message, stack });
      logger.error('Unhandled rejection', { message, stack });
    });

    process.on('uncaughtException', (err) => {
      errorLogger.error('Uncaught exception', { message: err.message, stack: err.stack });
      logger.error('Uncaught exception', { message: err.message, stack: err.stack });
      // Allow logger flush then exit — process state is undefined after uncaughtException
      setTimeout(() => process.exit(1), 500);
    });
  }

  #registerShutdown() {
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down`);
      stopMaintenanceJobs();
      this.httpServer.close(async () => {
        await database.disconnect();
        await redisClient.disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

const server = new Server();
server.start();

export default server;
