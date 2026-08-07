import { getNextSequence } from '../models/Sequence.model.js';

const MRN_PREFIX = 'PAT-';
const MRN_PAD = 6;

/**
 * Generate next MRN: PAT-000001
 */
export async function generateMrn() {
  const next = await getNextSequence('patient_mrn');
  return `${MRN_PREFIX}${String(next).padStart(MRN_PAD, '0')}`;
}

export async function generatePatientCode(mrn) {
  return mrn.replace('PAT-', 'PC-');
}

export default { generateMrn, generatePatientCode };
