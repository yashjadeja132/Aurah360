import { getNextSequence } from '../models/Sequence.model.js';

/**
 * Daily, branch-wise queue tokens: Q-001, Q-002, ...
 */
export async function generateQueueToken(branchId, date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const key = `queue_token_${branchId}_${y}${m}${day}`;
  const next = await getNextSequence(key);
  return `Q-${String(next).padStart(3, '0')}`;
}

export default { generateQueueToken };
