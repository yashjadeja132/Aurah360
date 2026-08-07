import BaseRepository from './BaseRepository.js';
import PatientDocument from '../models/PatientDocument.model.js';

class PatientDocumentRepository extends BaseRepository {
  constructor() {
    super(PatientDocument);
  }

  async findByPatient(patientId) {
    return this.model
      .find({ patientId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }
}

export default PatientDocumentRepository;
