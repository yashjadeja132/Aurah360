import BaseRepository from './BaseRepository.js';
import PatientTimeline from '../models/PatientTimeline.model.js';

class PatientTimelineRepository extends BaseRepository {
  constructor() {
    super(PatientTimeline);
  }

  async findByPatient(patientId, { limit = 50 } = {}) {
    return this.model
      .find({ patientId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
  }
}

export default PatientTimelineRepository;
