import { EventEmitter } from 'events';

/**
 * In-process event bus (foundation).
 * Domain modules will emit events; workers/listeners react (notifications, audit, etc.).
 * Future: transactional outbox → Redis/BullMQ for cross-process reliability.
 */
class EventBus extends EventEmitter {
  emitDomain(eventName, payload = {}) {
    this.emit(eventName, {
      ...payload,
      emittedAt: new Date().toISOString(),
    });
    return true;
  }
}

export const eventBus = new EventBus();
export default eventBus;
