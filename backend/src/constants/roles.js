/**
 * System roles for Aurah 360 ClinicOS (Module 1).
 * Codes are stable identifiers; display names live on Role documents.
 */
export const ROLES = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  DOCTOR: 'DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  NURSE: 'NURSE',
  TECHNICIAN: 'TECHNICIAN',
  CASHIER: 'CASHIER',
  PHARMACIST: 'PHARMACIST',
  CRM_EXECUTIVE: 'CRM_EXECUTIVE',
  AUDITOR: 'AUDITOR',
});

export const ROLE_LIST = Object.freeze(Object.values(ROLES));

export const ROLE_LABELS = Object.freeze({
  [ROLES.OWNER]: 'Owner',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.BRANCH_MANAGER]: 'Branch Manager',
  [ROLES.DOCTOR]: 'Doctor',
  [ROLES.RECEPTIONIST]: 'Receptionist',
  [ROLES.NURSE]: 'Nurse',
  [ROLES.TECHNICIAN]: 'Technician',
  [ROLES.CASHIER]: 'Cashier',
  [ROLES.PHARMACIST]: 'Pharmacist',
  [ROLES.CRM_EXECUTIVE]: 'CRM Executive',
  [ROLES.AUDITOR]: 'Auditor',
});

export default ROLES;
