import { getNextSequence } from '../models/Sequence.model.js';

export async function generateNotificationId() {
  const next = await getNextSequence('notification_id');
  return `NTF-${String(next).padStart(8, '0')}`;
}

export async function generateTemplateCode(prefix = 'TPL') {
  const next = await getNextSequence('notification_template_code');
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

export default { generateNotificationId, generateTemplateCode };
