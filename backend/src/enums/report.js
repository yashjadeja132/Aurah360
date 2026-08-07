export const DASHBOARD_TYPE = Object.freeze({
  OWNER: 'owner',
  BRANCH_MANAGER: 'branch-manager',
  DOCTOR: 'doctor',
  RECEPTION: 'reception',
  CRM: 'crm',
  PHARMACY: 'pharmacy',
});

export const DASHBOARD_TYPE_LIST = Object.freeze(Object.values(DASHBOARD_TYPE));

export const REPORT_TYPE = Object.freeze({
  APPOINTMENTS: 'appointments',
  REVENUE: 'revenue',
  PAYMENTS: 'payments',
  INVOICES: 'invoices',
  TREATMENTS: 'treatments',
  CONSULTATIONS: 'consultations',
  PATIENTS: 'patients',
  DOCTORS: 'doctors',
  LEADS: 'leads',
  INVENTORY: 'inventory',
  PHARMACY: 'pharmacy',
  QUEUE: 'queue',
  LOYALTY_LIABILITY: 'loyalty-liability',
  LOYALTY_ISSUANCE: 'loyalty-issuance',
  LOYALTY_REDEMPTION: 'loyalty-redemption',
  LOYALTY_EXPIRY: 'loyalty-expiry',
  LOYALTY_REFERRAL: 'loyalty-referral',
});

export const REPORT_TYPE_LIST = Object.freeze(Object.values(REPORT_TYPE));

export const EXPORT_FORMAT = Object.freeze({
  CSV: 'csv',
  EXCEL: 'excel',
  PDF: 'pdf',
});

export const EXPORT_FORMAT_LIST = Object.freeze(Object.values(EXPORT_FORMAT));

export const SCHEDULE_FREQUENCY = Object.freeze({
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
});

export const SCHEDULE_FREQUENCY_LIST = Object.freeze(Object.values(SCHEDULE_FREQUENCY));

export const REPORT_RUN_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

export const REPORT_RUN_STATUS_LIST = Object.freeze(Object.values(REPORT_RUN_STATUS));

export const CHART_TYPE = Object.freeze({
  REVENUE_TREND: 'revenue-trend',
  APPOINTMENTS_TREND: 'appointments-trend',
  LEAD_FUNNEL: 'lead-funnel',
  PATIENT_GROWTH: 'patient-growth',
  INVENTORY_TREND: 'inventory-trend',
  TREATMENT_COMPLETION: 'treatment-completion',
});

export const CHART_TYPE_LIST = Object.freeze(Object.values(CHART_TYPE));

export default {
  DASHBOARD_TYPE,
  REPORT_TYPE,
  EXPORT_FORMAT,
  SCHEDULE_FREQUENCY,
  REPORT_RUN_STATUS,
  CHART_TYPE,
};
