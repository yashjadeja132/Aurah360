import BaseRepository from './BaseRepository.js';
import HandoffNote from '../models/HandoffNote.model.js';

class HandoffNoteRepository extends BaseRepository {
  constructor() {
    super(HandoffNote);
  }

  async findUnacknowledgedForDoctor(doctorId) {
    return this.model
      .find({ assignedDoctorId: doctorId, acknowledgedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findForPatient(patientId) {
    return this.model.find({ patientId }).sort({ createdAt: -1 }).exec();
  }
}

export default HandoffNoteRepository;
