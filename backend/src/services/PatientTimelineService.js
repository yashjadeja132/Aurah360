import PatientTimelineRepository from '../repositories/PatientTimelineRepository.js';
import logger from '../libs/logger.js';

/**
 * Reusable timeline service — future modules call addEvent / getTimeline.
 */
class PatientTimelineService {
  constructor() {
    this.timelineRepository = new PatientTimelineRepository();
  }

  /**
   * @param {string|object} patientId
   * @param {{ eventType: string, title: string, description?: string, metadata?: object, actorId?: string, occurredAt?: Date }} event
   */
  async addEvent(patientId, event) {
    try {
      const row = await this.timelineRepository.create({
        patientId,
        eventType: event.eventType,
        title: event.title,
        description: event.description || null,
        metadata: event.metadata || {},
        actorId: event.actorId || null,
        occurredAt: event.occurredAt || new Date(),
      });
      return row.toSafeObject();
    } catch (error) {
      logger.error('Timeline event failed', { message: error.message, patientId: String(patientId) });
      return null;
    }
  }

  async getTimeline(patientId, { limit = 50 } = {}) {
    const rows = await this.timelineRepository.findByPatient(patientId, { limit });
    return rows.map((r) => r.toSafeObject());
  }
}

export default PatientTimelineService;
