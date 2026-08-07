import { getNextSequence } from '../models/Sequence.model.js';

export async function generateTreatmentPlanNumber() {
  const next = await getNextSequence('treatment_plan_number');
  return `TP-${String(next).padStart(6, '0')}`;
}

export async function generateProtocolCode() {
  const next = await getNextSequence('treatment_protocol_code');
  return `PROTO-${String(next).padStart(3, '0')}`;
}

export async function generatePackageCode() {
  const next = await getNextSequence('treatment_package_code');
  return `PKG-${String(next).padStart(3, '0')}`;
}

export default {
  generateTreatmentPlanNumber,
  generateProtocolCode,
  generatePackageCode,
};
