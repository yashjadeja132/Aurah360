import { getNextSequence } from '../models/Sequence.model.js';

export async function generateSessionNumber() {
  const next = await getNextSequence('treatment_session_number');
  return `TS-${String(next).padStart(6, '0')}`;
}

export default { generateSessionNumber };
