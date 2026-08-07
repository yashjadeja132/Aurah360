import ApiError from '../libs/ApiError.js';
import logger from '../libs/logger.js';

/**
 * Recurring appointments — architecture placeholder only.
 * Future: expand series from frequency/interval/endDate.
 */
class RecurringAppointmentService {
  async createSeries(_payload) {
    logger.info('Recurring appointment placeholder invoked');
    throw ApiError.badRequest(
      'Recurring appointments are not implemented yet. Architecture placeholder only.'
    );
  }

  async expandSeries(_seriesId) {
    return [];
  }
}

export default RecurringAppointmentService;
