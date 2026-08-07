import { getNextSequence } from '../models/Sequence.model.js';

const APT_PREFIX = 'APT-';
const APT_PAD = 6;

export async function generateAppointmentNumber() {
  const next = await getNextSequence('appointment_number');
  return `${APT_PREFIX}${String(next).padStart(APT_PAD, '0')}`;
}

export default { generateAppointmentNumber };
