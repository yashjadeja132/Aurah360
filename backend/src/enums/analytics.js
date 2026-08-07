export const ANALYTICS_CATEGORY = Object.freeze({
  APPOINTMENTS: 'appointments',
  PATIENTS: 'patients',
  DOCTORS: 'doctors',
  TREATMENTS: 'treatments',
  BILLING: 'billing',
  INVENTORY: 'inventory',
  CRM: 'crm',
  AI: 'ai',
});

export const ANALYTICS_CATEGORY_LIST = Object.freeze(Object.values(ANALYTICS_CATEGORY));

export const ANALYTICS_PERIOD = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
});

export const ANALYTICS_PERIOD_LIST = Object.freeze(Object.values(ANALYTICS_PERIOD));

export default {
  ANALYTICS_CATEGORY,
  ANALYTICS_CATEGORY_LIST,
  ANALYTICS_PERIOD,
  ANALYTICS_PERIOD_LIST,
};
