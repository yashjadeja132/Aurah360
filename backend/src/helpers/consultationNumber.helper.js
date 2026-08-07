import { getNextSequence } from '../models/Sequence.model.js';

/**
 * Consultation numbers: CON-000001
 */
export async function generateConsultationNumber() {
  const next = await getNextSequence('consultation_number');
  return `CON-${String(next).padStart(6, '0')}`;
}

export default { generateConsultationNumber };
