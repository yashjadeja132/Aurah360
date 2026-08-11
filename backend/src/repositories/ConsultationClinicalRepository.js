import BaseRepository from './BaseRepository.js';
import ConsultationSoap from '../models/ConsultationSoap.model.js';
import ConsultationVitals from '../models/ConsultationVitals.model.js';
import ConsultationDiagnosis from '../models/ConsultationDiagnosis.model.js';
import ConsultationExamination from '../models/ConsultationExamination.model.js';
import ConsultationIntake from '../models/ConsultationIntake.model.js';
import ClinicalPhoto from '../models/ClinicalPhoto.model.js';
import ConsultationTemplate from '../models/ConsultationTemplate.model.js';
import { paginateModel } from '../helpers/paginate.helper.js';

class ConsultationSoapRepository extends BaseRepository {
  constructor() {
    super(ConsultationSoap);
  }

  async findByConsultation(consultationId) {
    return this.model.findOne({ consultationId, deletedAt: null }).exec();
  }
}

class ConsultationVitalsRepository extends BaseRepository {
  constructor() {
    super(ConsultationVitals);
  }

  async findByConsultation(consultationId) {
    return this.model.findOne({ consultationId, deletedAt: null }).exec();
  }
}

class ConsultationDiagnosisRepository extends BaseRepository {
  constructor() {
    super(ConsultationDiagnosis);
  }

  async findByConsultation(consultationId) {
    return this.model.findOne({ consultationId, deletedAt: null }).exec();
  }
}

class ConsultationExaminationRepository extends BaseRepository {
  constructor() {
    super(ConsultationExamination);
  }

  async findByConsultation(consultationId) {
    return this.model.findOne({ consultationId, deletedAt: null }).exec();
  }
}

class ConsultationIntakeRepository extends BaseRepository {
  constructor() {
    super(ConsultationIntake);
  }

  async findByConsultation(consultationId) {
    return this.model.findOne({ consultationId, deletedAt: null }).exec();
  }
}

class ClinicalPhotoRepository extends BaseRepository {
  constructor() {
    super(ClinicalPhoto);
  }

  async findByConsultation(consultationId) {
    return this.model
      .find({ consultationId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }
}

class ConsultationTemplateRepository extends BaseRepository {
  constructor() {
    super(ConsultationTemplate);
  }

  async findForDoctor(doctorId, templateType = null) {
    const filter = {
      deletedAt: null,
      $or: [{ doctorId }, { isShared: true }],
    };
    if (templateType) filter.templateType = templateType;
    return this.model.find(filter).sort({ name: 1 }).exec();
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  /**
   * Admin listing for Settings → Masters — unlike `findForDoctor` (which scopes to one doctor
   * plus shared templates for the live consultation-session picker), this is the unscoped,
   * paginated/searchable list an admin/medical-lead needs to manage the whole library.
   */
  async searchAll({ templateType = null, status = null, doctorId = null, search = '', page = 1, limit = 20 } = {}) {
    const filter = {};
    if (templateType) filter.templateType = templateType;
    if (status) filter.status = status;
    if (doctorId) filter.doctorId = doctorId;
    return paginateModel(this.model, {
      filter,
      page,
      limit,
      search,
      searchFields: ['name'],
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      allowedSort: ['updatedAt', 'createdAt', 'name'],
    });
  }
}

export {
  ConsultationSoapRepository,
  ConsultationVitalsRepository,
  ConsultationDiagnosisRepository,
  ConsultationExaminationRepository,
  ConsultationIntakeRepository,
  ClinicalPhotoRepository,
  ConsultationTemplateRepository,
};
