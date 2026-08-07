/**
 * Module 18 seed — ensures dashboard.view permission is present (via main seed roles).
 * Analytics consume existing module data; no duplicated business rows.
 */
import logger from '../libs/logger.js';

export async function seedModule18() {
  logger.info('Module 18 analytics ready', {
    note: 'Executive dashboard + category reports use existing clinic data',
    endpoints: ['/analytics/dashboard', '/analytics/reports/:category'],
  });
}

export default seedModule18;
