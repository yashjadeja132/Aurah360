import { getNextSequence } from '../models/Sequence.model.js';

export async function generatePrescriptionNumber() {
  const next = await getNextSequence('prescription_number');
  return `RX-${String(next).padStart(6, '0')}`;
}

export async function generateMedicineCode() {
  const next = await getNextSequence('medicine_code');
  return `MED-${String(next).padStart(5, '0')}`;
}

export default { generatePrescriptionNumber, generateMedicineCode };
