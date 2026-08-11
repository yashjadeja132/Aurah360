export const APP_ROUTES = Object.freeze({
  LOGIN: '/login',
  DASHBOARD: '/',
  OWNER_LANDING: '/owner',
  DOCTOR_MY_DAY: '/my-day',
  NURSE_TODAY: '/nurse/today',
  // §2 Pre-consult intake — keyed by appointmentId (not a consultationId, which may not exist yet;
  // the page starts/finds the consultation itself, same idempotent start() the doctor's own
  // "Start from appointment" uses).
  NURSE_INTAKE: '/nurse/intake/:appointmentId',
  STAFF: '/staff',
  STAFF_CREATE: '/staff/new',
  STAFF_DETAIL: '/staff/:id',
  STAFF_EDIT: '/staff/:id/edit',
  DOCTORS: '/doctors',
  DOCTOR_CREATE: '/doctors/new',
  DOCTOR_DETAIL: '/doctors/:id',
  DOCTOR_EDIT: '/doctors/:id/edit',
  DOCTOR_SCHEDULE: '/doctors/:id/schedule',
  DOCTOR_LEAVE: '/doctors/:id/leave',
  PATIENTS: '/patients',
  PATIENT_CREATE: '/patients/new',
  PATIENT_DETAIL: '/patients/:id',
  PATIENT_EDIT: '/patients/:id/edit',
  SCHEDULING: '/scheduling',
  SCHEDULING_HOLIDAYS: '/scheduling/holidays',
  SCHEDULING_BLOCKED: '/scheduling/blocked-slots',
  SCHEDULING_VIEWER: '/scheduling/viewer',
  APPOINTMENTS: '/appointments',
  APPOINTMENT_BOOK: '/appointments/book',
  APPOINTMENT_CALENDAR: '/appointments/calendar',
  APPOINTMENT_DETAIL: '/appointments/:id',
  APPOINTMENT_EDIT: '/appointments/:id/edit',
  APPOINTMENT_PATIENT_HISTORY: '/appointments/patient/:patientId/history',
  RECEPTION: '/reception',
  RECEPTION_DESK: '/reception/desk',
  QUEUE: '/queue',
  BRANCH_COMMAND: '/branch',
  CONSULTATIONS: '/consultations',
  CONSULTATION_WORKSPACE: '/consultations/:id',
  REPORT_REVIEW_QUEUE: '/consultations/report-review',
  FOLLOW_UPS_QUEUE: '/consultations/follow-ups',
  PRESCRIPTIONS: '/prescriptions',
  PRESCRIPTION_EDIT: '/prescriptions/:id',
  PRESCRIPTION_PRINT: '/prescriptions/:id/print',
  TREATMENT_PLANS: '/treatment-plans',
  // Literal segment — must precede TREATMENT_PLAN_EDIT's ':id' pattern so it isn't swallowed by it.
  TREATMENT_PLAN_APPROVAL_QUEUE: '/treatment-plans/approval-queue',
  TREATMENT_PLAN_EDIT: '/treatment-plans/:id',
  TREATMENT_PLAN_PRINT: '/treatment-plans/:id/print',
  TREATMENT_PROTOCOLS: '/treatment-plans/protocols',
  TREATMENT_PACKAGES: '/treatment-plans/packages',
  BILLING: '/billing',
  // Literal segments must precede the ':id' pattern so they are not swallowed by it.
  BILLING_CASHIER: '/billing/cash-desk',
  INVOICE_DETAIL: '/billing/:id',
  INVOICE_PRINT: '/billing/:id/print',
  BILLING_CASH_CLOSE: '/billing/cash-close',
  BILLING_DISCOUNT_APPROVALS: '/billing/discount-approvals',
  BILLING_REFUND_APPROVALS: '/billing/refund-approvals',
  BILLING_DUE_PAYMENTS: '/billing/due-payments',
  TREATMENT_DASHBOARD: '/treatments',
  TREATMENT_SESSIONS: '/treatments/sessions',
  TREATMENT_SESSION_DETAIL: '/treatments/sessions/:id',
  TREATMENT_SESSION_PRINT: '/treatments/sessions/:id/print',
  TREATMENT_SAFETY: '/treatments/safety',
  TECHNICIAN_WORKLIST: '/treatments/worklist',
  PHARMACY: '/pharmacy',
  PHARMACY_QUEUE: '/pharmacy/queue',
  PHARMACY_SALES: '/pharmacy/sales',
  PHARMACY_DISPENSE: '/pharmacy/dispenses/:id',
  INVENTORY: '/inventory',
  INVENTORY_LEDGER: '/inventory/ledger',
  PURCHASE_ORDERS: '/inventory/purchase-orders',
  SUPPLIERS: '/inventory/suppliers',
  INVENTORY_TRANSFERS: '/inventory/transfers',
  CRM: '/crm',
  CRM_LEADS: '/crm/leads',
  CRM_LEAD_DETAIL: '/crm/leads/:id',
  CRM_PIPELINE: '/crm/pipeline',
  CRM_TASKS: '/crm/tasks',
  CRM_OFFERS: '/crm/offers',
  CRM_RECALL: '/crm/recall',
  CRM_FEEDBACK: '/crm/feedback',
  LOYALTY: '/loyalty',
  LOYALTY_SETTINGS: '/loyalty/settings',
  LOYALTY_RULES: '/loyalty/rules',
  LOYALTY_TIERS: '/loyalty/tiers',
  LOYALTY_CAMPAIGNS: '/loyalty/campaigns',
  LOYALTY_ADJUSTMENTS: '/loyalty/adjustments',
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_LOG: '/notifications/log',
  NOTIFICATION_TEMPLATES: '/notifications/templates',
  REPORTS: '/reports',
  REPORTS_ANALYTICS: '/reports/analytics',
  REPORTS_SCHEDULED: '/reports/scheduled',
  REPORTS_DASHBOARDS: '/reports/dashboards',
  REPORTS_DASHBOARD: '/reports/dashboards/:type',
  REPORTS_VIEWER: '/reports/view',
  REPORTS_VIEW: '/reports/view/:type',
  ANALYTICS: '/analytics',
  ANALYTICS_EXECUTIVE: '/analytics/executive',
  ANALYTICS_CATEGORY: '/analytics/:category',
  PROFILE: '/profile',
  PORTAL_LOGIN: '/portal/login',
  PORTAL: '/portal',
  PORTAL_DASHBOARD: '/portal',
  PORTAL_APPOINTMENTS: '/portal/appointments',
  PORTAL_RECORDS: '/portal/records',
  PORTAL_PRESCRIPTIONS: '/portal/prescriptions',
  PORTAL_TREATMENTS: '/portal/treatments',
  PORTAL_BILLING: '/portal/billing',
  PORTAL_DOCUMENTS: '/portal/documents',
  PORTAL_NOTIFICATIONS: '/portal/notifications',
  PORTAL_PROFILE: '/portal/profile',
  PORTAL_FEEDBACK: '/portal/feedback',
  CHANGE_PASSWORD: '/profile/password',
  FORGOT_PASSWORD: '/forgot-password',
  SETTINGS: '/settings',
  BRANCHES: '/settings/branches',
  BRANCH_CREATE: '/settings/branches/new',
  BRANCH_DETAIL: '/settings/branches/:id',
  BRANCH_EDIT: '/settings/branches/:id/edit',
  BRANCH_SETTINGS: '/settings/branches/:id/settings',
  MASTER: '/settings/:masterSlug',
  SETTINGS_RESOURCES: '/settings/resources',
  SETTINGS_PRIVACY: '/settings/privacy',
  SETTINGS_AI_GOVERNANCE: '/settings/ai-governance',
  SETTINGS_INTEGRATIONS: '/settings/integrations',
  SETTINGS_ORGANIZATION: '/settings/organization',
  SETTINGS_AUDIT_LOG: '/settings/audit-log',
  SETTINGS_CONSULTATION_TEMPLATES: '/settings/consultation-templates',
  NOT_FOUND: '*',
});

export const staffDetailPath = (id) => `/staff/${id}`;
export const staffEditPath = (id) => `/staff/${id}/edit`;
export const doctorDetailPath = (id) => `/doctors/${id}`;
export const doctorEditPath = (id) => `/doctors/${id}/edit`;
export const doctorSchedulePath = (id) => `/doctors/${id}/schedule`;
export const doctorLeavePath = (id) => `/doctors/${id}/leave`;
export const patientDetailPath = (id) => `/patients/${id}`;
export const patientEditPath = (id) => `/patients/${id}/edit`;
export const appointmentDetailPath = (id) => `/appointments/${id}`;
export const appointmentEditPath = (id) => `/appointments/${id}/edit`;
export const appointmentPatientHistoryPath = (patientId) =>
  `/appointments/patient/${patientId}/history`;
export const consultationWorkspacePath = (id) => `/consultations/${id}`;
export const nurseIntakePath = (appointmentId) => `/nurse/intake/${appointmentId}`;
export const prescriptionEditPath = (id) => `/prescriptions/${id}`;
export const prescriptionPrintPath = (id) => `/prescriptions/${id}/print`;
export const treatmentPlanEditPath = (id) => `/treatment-plans/${id}`;
export const treatmentPlanPrintPath = (id) => `/treatment-plans/${id}/print`;
export const invoiceDetailPath = (id) => `/billing/${id}`;
export const invoicePrintPath = (id) => `/billing/${id}/print`;
export const treatmentSessionPath = (id) => `/treatments/sessions/${id}`;
export const treatmentSessionPrintPath = (id) => `/treatments/sessions/${id}/print`;
export const dispensePath = (id) => `/pharmacy/dispenses/${id}`;
export const leadDetailPath = (id) => `/crm/leads/${id}`;
export const branchDetailPath = (id) => `/settings/branches/${id}`;
export const branchEditPath = (id) => `/settings/branches/${id}/edit`;
export const branchSettingsPath = (id) => `/settings/branches/${id}/settings`;
export const masterPath = (slug) => `/settings/${slug}`;

export const PORTAL_ROUTES = Object.freeze({
  LOGIN: '/portal/login',
  DASHBOARD: '/portal',
  APPOINTMENTS: '/portal/appointments',
  RECORDS: '/portal/records',
  PRESCRIPTIONS: '/portal/prescriptions',
  TREATMENTS: '/portal/treatments',
  BILLING: '/portal/billing',
  DOCUMENTS: '/portal/documents',
  NOTIFICATIONS: '/portal/notifications',
  PROFILE: '/portal/profile',
  FEEDBACK: '/portal/feedback',
});

export default APP_ROUTES;
