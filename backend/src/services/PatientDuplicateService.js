import PatientRepository from '../repositories/PatientRepository.js';

/**
 * Duplicate detection — never auto-merges.
 */
class PatientDuplicateService {
  constructor() {
    this.patientRepository = new PatientRepository();
  }

  async findDuplicates({ mobile, email, firstName, lastName, dateOfBirth, excludeId = null }) {
    const map = new Map();

    const add = (patients, reason) => {
      patients.forEach((p) => {
        if (excludeId && p._id.toString() === excludeId.toString()) return;
        const id = p._id.toString();
        if (!map.has(id)) {
          map.set(id, { patient: p.toSafeObject(), reasons: new Set() });
        }
        map.get(id).reasons.add(reason);
      });
    };

    if (mobile) add(await this.patientRepository.findByMobile(mobile), 'PHONE');
    if (email) add(await this.patientRepository.findByEmail(email), 'EMAIL');
    if (firstName && lastName && dateOfBirth) {
      add(
        await this.patientRepository.findByNameAndDob(firstName, lastName, dateOfBirth),
        'NAME_DOB'
      );
    }

    return [...map.values()].map((item) => ({
      ...item.patient,
      matchReasons: [...item.reasons],
    }));
  }
}

export default PatientDuplicateService;
