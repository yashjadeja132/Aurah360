import mongoose from 'mongoose';
import ConsentDefinition from '../models/ConsentDefinition.model.js';
import ConsentGrant from '../models/ConsentGrant.model.js';

class ConsentRepository {
  async getActiveDefinition(purpose, language = 'en') {
    return ConsentDefinition.findOne({ purpose, language, isActive: true })
      .sort({ version: -1 })
      .exec();
  }

  async getLatestVersion(purpose, language = 'en') {
    const latest = await ConsentDefinition.findOne({ purpose, language })
      .sort({ version: -1 })
      .exec();
    return latest ? latest.version : 0;
  }

  async createDefinition(payload) {
    return ConsentDefinition.create(payload);
  }

  async listDefinitions(filter = {}) {
    return ConsentDefinition.find(filter).sort({ purpose: 1, version: -1 }).exec();
  }

  async appendGrant(payload) {
    return ConsentGrant.create(payload);
  }

  async historyForPatient(patientId, purpose = null) {
    const filter = { patientId };
    if (purpose) filter.purpose = purpose;
    return ConsentGrant.find(filter).sort({ recordedAt: -1 }).exec();
  }

  /** Current state per purpose — most recent grant/withdrawal row for each purpose. */
  async currentStatesForPatient(patientId) {
    const rows = await ConsentGrant.aggregate([
      { $match: { patientId: new mongoose.Types.ObjectId(patientId) } },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: '$purpose',
          latest: { $first: '$$ROOT' },
        },
      },
    ]);
    return rows.map((r) => r.latest);
  }
}

export default ConsentRepository;
