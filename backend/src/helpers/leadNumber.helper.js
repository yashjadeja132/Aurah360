import { getNextSequence } from '../models/Sequence.model.js';

export async function generateLeadNumber() {
  const next = await getNextSequence('lead_number');
  return `LEAD-${String(next).padStart(6, '0')}`;
}

export default { generateLeadNumber };
