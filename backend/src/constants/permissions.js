/**
 * Permission keys — dot notation (Module 1).
 * Wildcards (module.*) are resolved in permission helpers / middleware.
 */
export const PERMISSIONS = Object.freeze({
  // Users / staff
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_ACTIVATE: 'users.activate',
  USERS_RESET_PASSWORD: 'users.reset_password',
  USERS_ALL: 'users.*',

  // Roles
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  ROLES_ALL: 'roles.*',

  // Patients
  PATIENTS_VIEW: 'patients.view',
  PATIENTS_CREATE: 'patients.create',
  PATIENTS_EDIT: 'patients.edit',
  PATIENTS_DELETE: 'patients.delete',
  PATIENTS_DOCUMENTS: 'patients.documents',
  /**
   * SEC-030 — separates DOWNLOAD (taking a copy of the bytes off-premises) from VIEW (rendering
   * them in the browser). Viewing is gated by the clinical-view set; only holders of this
   * permission (or of the pre-existing document-management grants it is additive to) may request
   * `?download=1`, which is what sets `Content-Disposition: attachment`.
   */
  PATIENTS_DOCUMENTS_DOWNLOAD: 'patients.documents.download',
  PATIENTS_MERGE: 'patients.merge',
  PATIENTS_ALL: 'patients.*',

  // Appointments
  APPOINTMENTS_VIEW: 'appointments.view',
  APPOINTMENTS_CREATE: 'appointments.create',
  APPOINTMENTS_EDIT: 'appointments.edit',
  APPOINTMENTS_CANCEL: 'appointments.cancel',
  APPOINTMENTS_RESCHEDULE: 'appointments.reschedule',
  APPOINTMENTS_DELETE: 'appointments.delete',
  APPOINTMENTS_COMPLETE: 'appointments.complete',
  APPOINTMENTS_ALL: 'appointments.*',

  // Billing
  BILLING_VIEW: 'billing.view',
  BILLING_CREATE: 'billing.create',
  BILLING_EDIT: 'billing.edit',
  BILLING_FINALIZE: 'billing.finalize',
  BILLING_PAYMENT: 'billing.payment',
  BILLING_REFUND: 'billing.refund',
  BILLING_PRINT: 'billing.print',
  BILLING_ALL: 'billing.*',

  // Loyalty & Rewards (LOY)
  LOYALTY_SETTINGS_VIEW: 'loyalty.settings_view',
  LOYALTY_SETTINGS_MANAGE: 'loyalty.settings_manage',
  LOYALTY_RULES_VIEW: 'loyalty.rules_view',
  LOYALTY_RULES_MANAGE: 'loyalty.rules_manage',
  LOYALTY_BALANCE_VIEW: 'loyalty.balance_view',
  LOYALTY_REDEEM: 'loyalty.redeem',
  LOYALTY_ADJUST: 'loyalty.adjust',
  LOYALTY_ADJUST_APPROVE: 'loyalty.adjust_approve',
  LOYALTY_REPORTS_VIEW: 'loyalty.reports_view',
  LOYALTY_REPORTS_EXPORT: 'loyalty.reports_export',
  LOYALTY_CAMPAIGNS_MANAGE: 'loyalty.campaigns_manage',
  LOYALTY_ALL: 'loyalty.*',

  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_EDIT: 'inventory.edit',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_ALL: 'inventory.*',
  STOCK_ADJUST: 'stock.adjust',

  // Pharmacy & Purchase (Module 13)
  PHARMACY_VIEW: 'pharmacy.view',
  PHARMACY_DISPENSE: 'pharmacy.dispense',
  PHARMACY_ALL: 'pharmacy.*',
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_ALL: 'purchase.*',
  /**
   * PHARM-SUBST — substitute a different product/medicine than the one on the signed
   * prescription line, with a mandatory reason. Deliberately namespaced OUTSIDE `pharmacy.*`
   * (same trick as `prescription_safety.override` vs `prescription.*`) so the broad PHARMACY_ALL
   * wildcard cannot silently confer it — it must be granted on purpose to whoever is trusted to
   * authorize a substitution.
   */
  PHARMACY_SUBSTITUTE: 'pharmacy_substitution.authorize',

  // Clinical / consultation
  CLINICAL_VIEW: 'clinical.view',
  CLINICAL_EDIT: 'clinical.edit',
  CLINICAL_SIGN: 'clinical.sign',
  CLINICAL_ALL: 'clinical.*',

  // Reports / dashboards
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  REPORTS_SCHEDULE: 'reports.schedule',
  REPORTS_ALL: 'reports.*',
  DASHBOARD_VIEW: 'dashboard.view',

  // Branches
  BRANCHES_VIEW: 'branches.view',
  BRANCHES_CREATE: 'branches.create',
  BRANCHES_EDIT: 'branches.edit',
  BRANCHES_DELETE: 'branches.delete',
  BRANCHES_MANAGE: 'branches.manage',
  BRANCHES_ALL: 'branches.*',

  // Masters / configuration
  /**
   * SEC-030 — narrow, read-only lookup of ACTIVE master records only
   * (`GET /masters/:masterType/active`), for roles that need to populate a dropdown while
   * booking or editing a patient but have no business browsing or administering master data.
   * Strictly weaker than MASTERS_VIEW, which additionally exposes the full (including inactive)
   * lists and single-record reads that back the admin Masters screens.
   */
  MASTERS_LOOKUP: 'masters.lookup',
  MASTERS_VIEW: 'masters.view',
  MASTERS_CREATE: 'masters.create',
  MASTERS_EDIT: 'masters.edit',
  MASTERS_DELETE: 'masters.delete',
  MASTERS_ALL: 'masters.*',

  // Doctors
  DOCTORS_VIEW: 'doctors.view',
  DOCTORS_CREATE: 'doctors.create',
  DOCTORS_EDIT: 'doctors.edit',
  DOCTORS_DELETE: 'doctors.delete',
  DOCTORS_ALL: 'doctors.*',

  DOCTOR_SCHEDULE_VIEW: 'doctor_schedule.view',
  DOCTOR_SCHEDULE_EDIT: 'doctor_schedule.edit',
  DOCTOR_SCHEDULE_ALL: 'doctor_schedule.*',

  DOCTOR_LEAVE_VIEW: 'doctor_leave.view',
  DOCTOR_LEAVE_EDIT: 'doctor_leave.edit',
  DOCTOR_LEAVE_ALL: 'doctor_leave.*',

  // Scheduling engine (Module 5)
  SCHEDULE_VIEW: 'schedule.view',
  SCHEDULE_EDIT: 'schedule.edit',
  SCHEDULE_ALL: 'schedule.*',
  HOLIDAYS_VIEW: 'holidays.view',
  HOLIDAYS_EDIT: 'holidays.edit',
  HOLIDAYS_ALL: 'holidays.*',

  // Reception & Queue (Module 7)
  RECEPTION_VIEW: 'reception.view',
  RECEPTION_CHECKIN: 'reception.checkin',
  RECEPTION_ALL: 'reception.*',
  QUEUE_VIEW: 'queue.view',
  QUEUE_MANAGE: 'queue.manage',
  QUEUE_ALL: 'queue.*',

  // Consultation / EMR (Module 8)
  CONSULTATION_VIEW: 'consultation.view',
  CONSULTATION_CREATE: 'consultation.create',
  CONSULTATION_EDIT: 'consultation.edit',
  /**
   * Authoring the DIAGNOSIS is split out of CONSULTATION_EDIT: recording vitals, intake notes and
   * examination findings is assistive work a nurse does every day, but naming the condition is a
   * prescriber act. While both sat behind `consultation.edit`, granting a nurse the intake screen
   * necessarily granted them the diagnosis endpoint too.
   */
  CONSULTATION_DIAGNOSE: 'consultation.diagnose',
  CONSULTATION_SIGN: 'consultation.sign',
  CONSULTATION_LOCK: 'consultation.lock',
  CONSULTATION_ALL: 'consultation.*',
  /**
   * Settings → Masters — "Consultation templates (versioned, medical-lead approved)". Deliberately
   * namespaced outside `consultation.*` (same trick as CONSULTATION_DIAGNOSE vs CONSULTATION_EDIT):
   * every clinical role holding CONSULTATION_EDIT/CONSULTATION_ALL to chart with templates must not
   * automatically gain the power to admin/approve the shared template library itself.
   */
  CONSULTATION_TEMPLATE_MANAGE: 'consultation_template.manage',

  // Prescription (Module 9)
  PRESCRIPTION_VIEW: 'prescription.view',
  PRESCRIPTION_CREATE: 'prescription.create',
  PRESCRIPTION_EDIT: 'prescription.edit',
  PRESCRIPTION_FINALIZE: 'prescription.finalize',
  PRESCRIPTION_PRINT: 'prescription.print',
  PRESCRIPTION_ALL: 'prescription.*',

  TREATMENT_PLAN_VIEW: 'treatment_plan.view',
  TREATMENT_PLAN_CREATE: 'treatment_plan.create',
  TREATMENT_PLAN_EDIT: 'treatment_plan.edit',
  TREATMENT_PLAN_APPROVE: 'treatment_plan.approve',
  TREATMENT_PLAN_ACCEPT: 'treatment_plan.accept',
  TREATMENT_PLAN_ALL: 'treatment_plan.*',

  TREATMENT_SESSION_VIEW: 'treatment_session.view',
  TREATMENT_SESSION_CREATE: 'treatment_session.create',
  TREATMENT_SESSION_EDIT: 'treatment_session.edit',
  TREATMENT_SESSION_COMPLETE: 'treatment_session.complete',
  TREATMENT_SESSION_REVERSE: 'treatment_session.reverse',
  TREATMENT_SESSION_ALL: 'treatment_session.*',

  // CRM (Module 14)
  CRM_VIEW: 'crm.view',
  CRM_CREATE: 'crm.create',
  CRM_EDIT: 'crm.edit',
  CRM_ASSIGN: 'crm.assign',
  CRM_CONVERT: 'crm.convert',
  CRM_FOLLOWUP: 'crm.followup',
  CRM_ALL: 'crm.*',

  // Notifications (Module 15)
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
  NOTIFICATIONS_ALL: 'notifications.*',

  // Audit
  AUDIT_VIEW: 'audit.view',
  /**
   * NFR-018 — a SECOND gate, on top of AUDIT_VIEW, for the unredacted `metadata` blob on an audit
   * row. Deliberately not `audit.*`-shaped and not implied by AUDIT_VIEW: metadata is free-form and
   * routinely carries clinical detail (diagnosis text on an amendment, the reason on a hard-stop
   * override, the title of a renamed report). Searching the trail — "who opened this record, when"
   * — is an everyday compliance need; reading the PHI those rows captured is not, and the two
   * should not be granted by the same act.
   */
  AUDIT_METADATA_VIEW: 'audit.metadata_view',

  // Resources — rooms, devices, staff skills (ORG-003)
  RESOURCES_VIEW: 'resources.view',
  RESOURCES_MANAGE: 'resources.manage',
  RESOURCES_ALL: 'resources.*',

  // Reception handoff note (PAT-006)
  HANDOFF_VIEW: 'handoff.view',
  HANDOFF_CREATE: 'handoff.create',
  HANDOFF_ACKNOWLEDGE: 'handoff.acknowledge',
  HANDOFF_ALL: 'handoff.*',

  // Patient consent (PRV-001)
  CONSENT_VIEW: 'consent.view',
  CONSENT_MANAGE: 'consent.manage',
  CONSENT_ALL: 'consent.*',

  // Privacy / data-subject rights (PRV-002, PRV-003)
  PRIVACY_REQUEST_VIEW: 'privacy_request.view',
  PRIVACY_REQUEST_CREATE: 'privacy_request.create',
  PRIVACY_REQUEST_RESOLVE: 'privacy_request.resolve',
  PRIVACY_REQUEST_ALL: 'privacy_request.*',
  BREAK_GLASS: 'security.break_glass',

  // Treatment safety — patch test, adverse event, hard-stop override (TRT-004..006)
  PATCH_TEST_VIEW: 'patch_test.view',
  PATCH_TEST_RECORD: 'patch_test.record',
  ADVERSE_EVENT_VIEW: 'adverse_event.view',
  ADVERSE_EVENT_CREATE: 'adverse_event.create',
  ADVERSE_EVENT_RESOLVE: 'adverse_event.resolve',
  TREATMENT_HARD_STOP_OVERRIDE: 'treatment.hard_stop_override',

  /**
   * RX-SAFETY — override a blocking prescribing-safety alert (allergy contraindication or a
   * blocking drug-interaction rule) with a mandatory reason. Deliberately namespaced OUTSIDE
   * `prescription.*` (same trick as `treatment.hard_stop_override` vs `treatment_session.*`) so
   * the broad PRESCRIPTION_ALL wildcard cannot silently confer it — it must be granted on purpose.
   */
  PRESCRIPTION_SAFETY_OVERRIDE: 'prescription_safety.override',
  /** Manage the admin-maintained drug-interaction rule set that the checker reads. */
  PRESCRIPTION_SAFETY_RULES_MANAGE: 'prescription_safety.rules_manage',
  /** Read the interaction rule set / safety configuration. */
  PRESCRIPTION_SAFETY_RULES_VIEW: 'prescription_safety.rules_view',

  // Billing extensions — real refund, cash close (BIL-002, BIL-003)
  BILLING_CASH_CLOSE: 'billing.cash_close',
  BILLING_CASH_CLOSE_APPROVE: 'billing.cash_close_approve',
  BILLING_CREDIT_NOTE: 'billing.credit_note',
  BILLING_DISCOUNT_APPROVE: 'billing.discount_approve',
  /** A.8 — approve/reject a refund request that exceeds config.billing.refundApprovalThresholdAmount. */
  BILLING_REFUND_APPROVE: 'billing.refund_approve',

  /**
   * MON-002 — annulling an ISSUED (finalized) invoice, and declaring an outstanding balance
   * uncollectable. Deliberately NOT covered by the `billing.*` wildcard at the route layer: both
   * destroy receivables, so the person who raises and collects an invoice must not also be able
   * to make it disappear. They are granted explicitly (owner/admin/branch manager), never
   * inherited by a cashier holding billing.*.
   */
  BILLING_VOID_FINALIZED: 'billing.void_finalized',
  BILLING_WRITE_OFF: 'billing.write_off',

  // Inventory transfer (INV-002)
  INVENTORY_TRANSFER_REQUEST: 'inventory.transfer_request',
  INVENTORY_TRANSFER_APPROVE: 'inventory.transfer_approve',
  INVENTORY_TRANSFER_RECEIVE: 'inventory.transfer_receive',

  // CRM extensions — recall worklist, offers, NPS (CRM-001)
  CRM_RECALL: 'crm.recall',
  CRM_OFFERS_VIEW: 'crm.offers_view',
  CRM_OFFERS_MANAGE: 'crm.offers_manage',
  CRM_FEEDBACK_VIEW: 'crm.feedback_view',

  // AI copilot (AI-001..008, AIG-001)
  AI_USE: 'ai.use',
  AI_GOVERNANCE_VIEW: 'ai.governance_view',
  AI_GOVERNANCE_MANAGE: 'ai.governance_manage',

  // Security — MFA / step-up
  SECURITY_MFA_MANAGE: 'security.mfa_manage',
  SECURITY_STEP_UP: 'security.step_up',
});

export const PERMISSION_LIST = Object.freeze(Object.values(PERMISSIONS));

/** Catalog for seeding Permission collection */
export const PERMISSION_CATALOG = Object.freeze([
  { key: PERMISSIONS.USERS_VIEW, module: 'users', description: 'View staff users' },
  { key: PERMISSIONS.USERS_CREATE, module: 'users', description: 'Create staff users' },
  { key: PERMISSIONS.USERS_EDIT, module: 'users', description: 'Edit staff users' },
  { key: PERMISSIONS.USERS_DELETE, module: 'users', description: 'Soft-delete staff users' },
  { key: PERMISSIONS.USERS_ACTIVATE, module: 'users', description: 'Activate or deactivate staff' },
  { key: PERMISSIONS.USERS_RESET_PASSWORD, module: 'users', description: 'Reset staff passwords' },
  { key: PERMISSIONS.USERS_ALL, module: 'users', description: 'All user permissions' },

  { key: PERMISSIONS.ROLES_VIEW, module: 'roles', description: 'View roles' },
  { key: PERMISSIONS.ROLES_MANAGE, module: 'roles', description: 'Manage roles' },
  { key: PERMISSIONS.ROLES_ALL, module: 'roles', description: 'All role permissions' },

  { key: PERMISSIONS.PATIENTS_VIEW, module: 'patients', description: 'View patients' },
  { key: PERMISSIONS.PATIENTS_CREATE, module: 'patients', description: 'Create patients' },
  { key: PERMISSIONS.PATIENTS_EDIT, module: 'patients', description: 'Edit patients' },
  { key: PERMISSIONS.PATIENTS_DELETE, module: 'patients', description: 'Delete patients' },
  { key: PERMISSIONS.PATIENTS_DOCUMENTS, module: 'patients', description: 'Manage patient documents' },
  { key: PERMISSIONS.PATIENTS_DOCUMENTS_DOWNLOAD, module: 'patients', description: 'Download (not just view) patient files' },
  { key: PERMISSIONS.PATIENTS_MERGE, module: 'patients', description: 'Detect/merge duplicate patients' },
  { key: PERMISSIONS.PATIENTS_ALL, module: 'patients', description: 'All patient permissions' },

  { key: PERMISSIONS.APPOINTMENTS_VIEW, module: 'appointments', description: 'View appointments' },
  { key: PERMISSIONS.APPOINTMENTS_CREATE, module: 'appointments', description: 'Create appointments' },
  { key: PERMISSIONS.APPOINTMENTS_EDIT, module: 'appointments', description: 'Edit appointments' },
  { key: PERMISSIONS.APPOINTMENTS_CANCEL, module: 'appointments', description: 'Cancel appointments' },
  { key: PERMISSIONS.APPOINTMENTS_RESCHEDULE, module: 'appointments', description: 'Reschedule appointments' },
  { key: PERMISSIONS.APPOINTMENTS_DELETE, module: 'appointments', description: 'Delete appointments' },
  { key: PERMISSIONS.APPOINTMENTS_COMPLETE, module: 'appointments', description: 'Complete appointments' },
  { key: PERMISSIONS.APPOINTMENTS_ALL, module: 'appointments', description: 'All appointment permissions' },

  { key: PERMISSIONS.BILLING_VIEW, module: 'billing', description: 'View billing' },
  { key: PERMISSIONS.BILLING_CREATE, module: 'billing', description: 'Create invoices/payments' },
  { key: PERMISSIONS.BILLING_EDIT, module: 'billing', description: 'Edit billing records' },
  { key: PERMISSIONS.BILLING_FINALIZE, module: 'billing', description: 'Finalize invoices' },
  { key: PERMISSIONS.BILLING_PAYMENT, module: 'billing', description: 'Record payments' },
  { key: PERMISSIONS.BILLING_REFUND, module: 'billing', description: 'Process refunds' },
  { key: PERMISSIONS.BILLING_PRINT, module: 'billing', description: 'Print invoices/receipts' },
  { key: PERMISSIONS.BILLING_ALL, module: 'billing', description: 'All billing permissions' },

  { key: PERMISSIONS.INVENTORY_VIEW, module: 'inventory', description: 'View inventory' },
  { key: PERMISSIONS.INVENTORY_CREATE, module: 'inventory', description: 'Create inventory items' },
  { key: PERMISSIONS.INVENTORY_EDIT, module: 'inventory', description: 'Edit inventory' },
  { key: PERMISSIONS.INVENTORY_ADJUST, module: 'inventory', description: 'Adjust stock' },
  { key: PERMISSIONS.INVENTORY_ALL, module: 'inventory', description: 'All inventory permissions' },
  { key: PERMISSIONS.STOCK_ADJUST, module: 'stock', description: 'Adjust stock levels' },

  { key: PERMISSIONS.PHARMACY_VIEW, module: 'pharmacy', description: 'View pharmacy' },
  { key: PERMISSIONS.PHARMACY_DISPENSE, module: 'pharmacy', description: 'Dispense medicines' },
  { key: PERMISSIONS.PHARMACY_ALL, module: 'pharmacy', description: 'All pharmacy permissions' },
  {
    key: PERMISSIONS.PHARMACY_SUBSTITUTE,
    module: 'pharmacy_substitution',
    description: 'Authorize substituting a different product for a prescribed medicine at dispense, with reason',
  },
  { key: PERMISSIONS.PURCHASE_VIEW, module: 'purchase', description: 'View purchase orders' },
  { key: PERMISSIONS.PURCHASE_CREATE, module: 'purchase', description: 'Create purchase orders' },
  { key: PERMISSIONS.PURCHASE_ALL, module: 'purchase', description: 'All purchase permissions' },

  { key: PERMISSIONS.CLINICAL_VIEW, module: 'clinical', description: 'View clinical records' },
  { key: PERMISSIONS.CLINICAL_EDIT, module: 'clinical', description: 'Edit clinical records' },
  { key: PERMISSIONS.CLINICAL_SIGN, module: 'clinical', description: 'Sign clinical records' },
  { key: PERMISSIONS.CLINICAL_ALL, module: 'clinical', description: 'All clinical permissions' },

  { key: PERMISSIONS.REPORTS_VIEW, module: 'reports', description: 'View reports' },
  { key: PERMISSIONS.REPORTS_EXPORT, module: 'reports', description: 'Export reports' },
  { key: PERMISSIONS.REPORTS_SCHEDULE, module: 'reports', description: 'Schedule reports' },
  { key: PERMISSIONS.REPORTS_ALL, module: 'reports', description: 'All report permissions' },
  { key: PERMISSIONS.DASHBOARD_VIEW, module: 'dashboard', description: 'View executive dashboard' },

  { key: PERMISSIONS.BRANCHES_VIEW, module: 'branches', description: 'View branches' },
  { key: PERMISSIONS.BRANCHES_CREATE, module: 'branches', description: 'Create branches' },
  { key: PERMISSIONS.BRANCHES_EDIT, module: 'branches', description: 'Edit branches' },
  { key: PERMISSIONS.BRANCHES_DELETE, module: 'branches', description: 'Soft-delete branches' },
  { key: PERMISSIONS.BRANCHES_MANAGE, module: 'branches', description: 'Manage branch settings' },
  { key: PERMISSIONS.BRANCHES_ALL, module: 'branches', description: 'All branch permissions' },

  {
    key: PERMISSIONS.MASTERS_LOOKUP,
    module: 'masters',
    description: 'Look up active master records for dropdowns (read-only, no admin screens)',
  },
  { key: PERMISSIONS.MASTERS_VIEW, module: 'masters', description: 'View master data' },
  { key: PERMISSIONS.MASTERS_CREATE, module: 'masters', description: 'Create master records' },
  { key: PERMISSIONS.MASTERS_EDIT, module: 'masters', description: 'Edit master records' },
  { key: PERMISSIONS.MASTERS_DELETE, module: 'masters', description: 'Delete master records' },
  { key: PERMISSIONS.MASTERS_ALL, module: 'masters', description: 'All master permissions' },

  { key: PERMISSIONS.DOCTORS_VIEW, module: 'doctors', description: 'View doctors' },
  { key: PERMISSIONS.DOCTORS_CREATE, module: 'doctors', description: 'Create doctors' },
  { key: PERMISSIONS.DOCTORS_EDIT, module: 'doctors', description: 'Edit doctors' },
  { key: PERMISSIONS.DOCTORS_DELETE, module: 'doctors', description: 'Soft-delete doctors' },
  { key: PERMISSIONS.DOCTORS_ALL, module: 'doctors', description: 'All doctor permissions' },

  { key: PERMISSIONS.DOCTOR_SCHEDULE_VIEW, module: 'doctor_schedule', description: 'View doctor schedules' },
  { key: PERMISSIONS.DOCTOR_SCHEDULE_EDIT, module: 'doctor_schedule', description: 'Edit doctor schedules' },
  { key: PERMISSIONS.DOCTOR_SCHEDULE_ALL, module: 'doctor_schedule', description: 'All doctor schedule permissions' },

  { key: PERMISSIONS.DOCTOR_LEAVE_VIEW, module: 'doctor_leave', description: 'View doctor leave' },
  { key: PERMISSIONS.DOCTOR_LEAVE_EDIT, module: 'doctor_leave', description: 'Edit doctor leave' },
  { key: PERMISSIONS.DOCTOR_LEAVE_ALL, module: 'doctor_leave', description: 'All doctor leave permissions' },

  { key: PERMISSIONS.SCHEDULE_VIEW, module: 'schedule', description: 'View scheduling engine / availability' },
  { key: PERMISSIONS.SCHEDULE_EDIT, module: 'schedule', description: 'Edit blocked slots and special schedules' },
  { key: PERMISSIONS.SCHEDULE_ALL, module: 'schedule', description: 'All schedule engine permissions' },
  { key: PERMISSIONS.HOLIDAYS_VIEW, module: 'holidays', description: 'View branch holidays' },
  { key: PERMISSIONS.HOLIDAYS_EDIT, module: 'holidays', description: 'Edit branch holidays' },
  { key: PERMISSIONS.HOLIDAYS_ALL, module: 'holidays', description: 'All holiday permissions' },

  { key: PERMISSIONS.RECEPTION_VIEW, module: 'reception', description: 'View reception dashboard' },
  { key: PERMISSIONS.RECEPTION_CHECKIN, module: 'reception', description: 'Check-in patients and walk-ins' },
  { key: PERMISSIONS.RECEPTION_ALL, module: 'reception', description: 'All reception permissions' },
  { key: PERMISSIONS.QUEUE_VIEW, module: 'queue', description: 'View queue boards' },
  { key: PERMISSIONS.QUEUE_MANAGE, module: 'queue', description: 'Manage queue (call, skip, transfer)' },
  { key: PERMISSIONS.QUEUE_ALL, module: 'queue', description: 'All queue permissions' },

  { key: PERMISSIONS.CONSULTATION_VIEW, module: 'consultation', description: 'View consultations / EMR' },
  { key: PERMISSIONS.CONSULTATION_CREATE, module: 'consultation', description: 'Start consultations' },
  { key: PERMISSIONS.CONSULTATION_EDIT, module: 'consultation', description: 'Edit consultation clinical data' },
  { key: PERMISSIONS.CONSULTATION_DIAGNOSE, module: 'consultation', description: 'Author/record a clinical diagnosis' },
  { key: PERMISSIONS.CONSULTATION_SIGN, module: 'consultation', description: 'Sign consultations' },
  { key: PERMISSIONS.CONSULTATION_LOCK, module: 'consultation', description: 'Lock consultations' },
  { key: PERMISSIONS.CONSULTATION_ALL, module: 'consultation', description: 'All consultation permissions' },
  {
    key: PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE,
    module: 'consultation_template',
    description: 'Manage and approve the shared consultation template library (SOAP/diagnosis/examination/quick-phrase)',
  },

  { key: PERMISSIONS.PRESCRIPTION_VIEW, module: 'prescription', description: 'View prescriptions' },
  { key: PERMISSIONS.PRESCRIPTION_CREATE, module: 'prescription', description: 'Create prescriptions' },
  { key: PERMISSIONS.PRESCRIPTION_EDIT, module: 'prescription', description: 'Edit draft prescriptions' },
  { key: PERMISSIONS.PRESCRIPTION_FINALIZE, module: 'prescription', description: 'Finalize prescriptions' },
  { key: PERMISSIONS.PRESCRIPTION_PRINT, module: 'prescription', description: 'Print prescriptions' },
  { key: PERMISSIONS.PRESCRIPTION_ALL, module: 'prescription', description: 'All prescription permissions' },

  { key: PERMISSIONS.TREATMENT_PLAN_VIEW, module: 'treatment_plan', description: 'View treatment plans' },
  { key: PERMISSIONS.TREATMENT_PLAN_CREATE, module: 'treatment_plan', description: 'Create treatment plans' },
  { key: PERMISSIONS.TREATMENT_PLAN_EDIT, module: 'treatment_plan', description: 'Edit treatment plans' },
  { key: PERMISSIONS.TREATMENT_PLAN_APPROVE, module: 'treatment_plan', description: 'Approve treatment plans' },
  { key: PERMISSIONS.TREATMENT_PLAN_ACCEPT, module: 'treatment_plan', description: 'Accept treatment plans' },
  { key: PERMISSIONS.TREATMENT_PLAN_ALL, module: 'treatment_plan', description: 'All treatment plan permissions' },

  { key: PERMISSIONS.TREATMENT_SESSION_VIEW, module: 'treatment_session', description: 'View treatment sessions' },
  { key: PERMISSIONS.TREATMENT_SESSION_CREATE, module: 'treatment_session', description: 'Create treatment sessions' },
  { key: PERMISSIONS.TREATMENT_SESSION_EDIT, module: 'treatment_session', description: 'Edit treatment sessions' },
  { key: PERMISSIONS.TREATMENT_SESSION_COMPLETE, module: 'treatment_session', description: 'Complete treatment sessions' },
  { key: PERMISSIONS.TREATMENT_SESSION_REVERSE, module: 'treatment_session', description: 'Reverse a completed treatment session' },
  { key: PERMISSIONS.TREATMENT_SESSION_ALL, module: 'treatment_session', description: 'All treatment session permissions' },

  { key: PERMISSIONS.CRM_VIEW, module: 'crm', description: 'View CRM leads' },
  { key: PERMISSIONS.CRM_CREATE, module: 'crm', description: 'Create leads' },
  { key: PERMISSIONS.CRM_EDIT, module: 'crm', description: 'Edit leads' },
  { key: PERMISSIONS.CRM_ASSIGN, module: 'crm', description: 'Assign leads' },
  { key: PERMISSIONS.CRM_CONVERT, module: 'crm', description: 'Convert leads to patients' },
  { key: PERMISSIONS.CRM_FOLLOWUP, module: 'crm', description: 'Add lead follow-ups' },
  { key: PERMISSIONS.CRM_ALL, module: 'crm', description: 'All CRM permissions' },

  { key: PERMISSIONS.NOTIFICATIONS_VIEW, module: 'notifications', description: 'View notifications' },
  { key: PERMISSIONS.NOTIFICATIONS_MANAGE, module: 'notifications', description: 'Manage templates and delivery' },
  { key: PERMISSIONS.NOTIFICATIONS_ALL, module: 'notifications', description: 'All notification permissions' },

  { key: PERMISSIONS.AUDIT_VIEW, module: 'audit', description: 'View audit logs' },
  {
    key: PERMISSIONS.AUDIT_METADATA_VIEW,
    module: 'audit',
    description: 'Read the unredacted metadata on an audit entry (may contain PHI)',
  },

  { key: PERMISSIONS.RESOURCES_VIEW, module: 'resources', description: 'View rooms/devices/skills' },
  { key: PERMISSIONS.RESOURCES_MANAGE, module: 'resources', description: 'Manage rooms/devices/skills' },
  { key: PERMISSIONS.RESOURCES_ALL, module: 'resources', description: 'All resource permissions' },

  { key: PERMISSIONS.HANDOFF_VIEW, module: 'handoff', description: 'View reception handoff notes' },
  { key: PERMISSIONS.HANDOFF_CREATE, module: 'handoff', description: 'Create reception handoff notes' },
  { key: PERMISSIONS.HANDOFF_ACKNOWLEDGE, module: 'handoff', description: 'Acknowledge handoff notes' },
  { key: PERMISSIONS.HANDOFF_ALL, module: 'handoff', description: 'All handoff permissions' },

  { key: PERMISSIONS.CONSENT_VIEW, module: 'consent', description: 'View patient consent history' },
  { key: PERMISSIONS.CONSENT_MANAGE, module: 'consent', description: 'Record/withdraw patient consent' },
  { key: PERMISSIONS.CONSENT_ALL, module: 'consent', description: 'All consent permissions' },

  { key: PERMISSIONS.PRIVACY_REQUEST_VIEW, module: 'privacy_request', description: 'View data-subject rights cases' },
  { key: PERMISSIONS.PRIVACY_REQUEST_CREATE, module: 'privacy_request', description: 'Open a rights case for a patient' },
  { key: PERMISSIONS.PRIVACY_REQUEST_RESOLVE, module: 'privacy_request', description: 'Resolve a rights case' },
  { key: PERMISSIONS.PRIVACY_REQUEST_ALL, module: 'privacy_request', description: 'All privacy-request permissions' },
  { key: PERMISSIONS.BREAK_GLASS, module: 'security', description: 'Break-glass access to restricted records' },

  { key: PERMISSIONS.PATCH_TEST_VIEW, module: 'patch_test', description: 'View patch test records' },
  { key: PERMISSIONS.PATCH_TEST_RECORD, module: 'patch_test', description: 'Record a patch test' },
  { key: PERMISSIONS.ADVERSE_EVENT_VIEW, module: 'adverse_event', description: 'View adverse events' },
  { key: PERMISSIONS.ADVERSE_EVENT_CREATE, module: 'adverse_event', description: 'Report an adverse event' },
  { key: PERMISSIONS.ADVERSE_EVENT_RESOLVE, module: 'adverse_event', description: 'Resolve/close an adverse event' },
  { key: PERMISSIONS.TREATMENT_HARD_STOP_OVERRIDE, module: 'treatment', description: 'Override a treatment hard-stop with reason' },

  {
    key: PERMISSIONS.PRESCRIPTION_SAFETY_OVERRIDE,
    module: 'prescription_safety',
    description: 'Override a blocking allergy/interaction alert on prescription finalize, with reason',
  },
  {
    key: PERMISSIONS.PRESCRIPTION_SAFETY_RULES_VIEW,
    module: 'prescription_safety',
    description: 'View the drug-interaction rule set used by the prescribing safety check',
  },
  {
    key: PERMISSIONS.PRESCRIPTION_SAFETY_RULES_MANAGE,
    module: 'prescription_safety',
    description: 'Create/deactivate drug-interaction rules',
  },

  { key: PERMISSIONS.BILLING_CASH_CLOSE, module: 'billing', description: 'Submit branch cash close' },
  { key: PERMISSIONS.BILLING_CASH_CLOSE_APPROVE, module: 'billing', description: 'Approve branch cash close' },
  { key: PERMISSIONS.BILLING_CREDIT_NOTE, module: 'billing', description: 'Issue/use credit notes' },
  { key: PERMISSIONS.BILLING_DISCOUNT_APPROVE, module: 'billing', description: 'Approve invoice discounts above threshold' },
  { key: PERMISSIONS.BILLING_REFUND_APPROVE, module: 'billing', description: 'Approve refunds above threshold' },
  { key: PERMISSIONS.BILLING_VOID_FINALIZED, module: 'billing', description: 'Cancel a finalized (issued) invoice' },
  { key: PERMISSIONS.BILLING_WRITE_OFF, module: 'billing', description: 'Write off an uncollectable invoice balance' },

  { key: PERMISSIONS.INVENTORY_TRANSFER_REQUEST, module: 'inventory', description: 'Request a branch stock transfer' },
  { key: PERMISSIONS.INVENTORY_TRANSFER_APPROVE, module: 'inventory', description: 'Approve/dispatch a branch stock transfer' },
  { key: PERMISSIONS.INVENTORY_TRANSFER_RECEIVE, module: 'inventory', description: 'Receive a branch stock transfer' },

  { key: PERMISSIONS.CRM_RECALL, module: 'crm', description: 'Work the missed-follow-up recall worklist' },
  { key: PERMISSIONS.CRM_OFFERS_VIEW, module: 'crm', description: 'View the offer board' },
  { key: PERMISSIONS.CRM_OFFERS_MANAGE, module: 'crm', description: 'Manage offers' },
  { key: PERMISSIONS.CRM_FEEDBACK_VIEW, module: 'crm', description: 'View patient feedback/NPS' },

  { key: PERMISSIONS.AI_USE, module: 'ai', description: 'Use the AI clinical copilot' },
  { key: PERMISSIONS.AI_GOVERNANCE_VIEW, module: 'ai', description: 'View AI governance/audit' },
  { key: PERMISSIONS.AI_GOVERNANCE_MANAGE, module: 'ai', description: 'Manage AI use-case flags/kill switch' },

  { key: PERMISSIONS.SECURITY_MFA_MANAGE, module: 'security', description: 'Manage own MFA enrollment' },
  { key: PERMISSIONS.SECURITY_STEP_UP, module: 'security', description: 'Perform step-up re-authentication' },

  { key: PERMISSIONS.LOYALTY_SETTINGS_VIEW, module: 'loyalty', description: 'View loyalty program settings' },
  { key: PERMISSIONS.LOYALTY_SETTINGS_MANAGE, module: 'loyalty', description: 'Change loyalty program settings' },
  { key: PERMISSIONS.LOYALTY_RULES_VIEW, module: 'loyalty', description: 'View loyalty earning rules' },
  { key: PERMISSIONS.LOYALTY_RULES_MANAGE, module: 'loyalty', description: 'Create/edit loyalty earning rules' },
  { key: PERMISSIONS.LOYALTY_BALANCE_VIEW, module: 'loyalty', description: "View a patient's loyalty balance/statement" },
  { key: PERMISSIONS.LOYALTY_REDEEM, module: 'loyalty', description: 'Apply a loyalty redemption at billing' },
  { key: PERMISSIONS.LOYALTY_ADJUST, module: 'loyalty', description: 'Make a manual loyalty credit/debit within limit' },
  { key: PERMISSIONS.LOYALTY_ADJUST_APPROVE, module: 'loyalty', description: 'Approve a manual loyalty adjustment above limit' },
  { key: PERMISSIONS.LOYALTY_REPORTS_VIEW, module: 'loyalty', description: 'View loyalty liability/issuance/redemption reports' },
  { key: PERMISSIONS.LOYALTY_REPORTS_EXPORT, module: 'loyalty', description: 'Export loyalty program reports (CSV/Excel/PDF)' },
  { key: PERMISSIONS.LOYALTY_CAMPAIGNS_MANAGE, module: 'loyalty', description: 'Create/manage loyalty campaigns' },
  { key: PERMISSIONS.LOYALTY_ALL, module: 'loyalty', description: 'All loyalty permissions' },
]);

export default PERMISSIONS;
