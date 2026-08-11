/**
 * Master page configs — UI labels/columns only.
 * All option values come from MongoDB via API.
 */
export const MASTER_CONFIGS = Object.freeze({
  departments: {
    slug: 'departments',
    title: 'Departments',
    description: 'Clinic departments used across staff and operations.',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'sortOrder', label: 'Order' },
    ],
  },
  designations: {
    slug: 'designations',
    title: 'Designations',
    description: 'Job titles for Aurah 360 staff.',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'sortOrder', label: 'Order' },
    ],
  },
  'service-categories': {
    slug: 'service-categories',
    title: 'Service Categories',
    description: 'Categories for clinic services and packages.',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
    ],
  },
  services: {
    slug: 'services',
    title: 'Services',
    description: 'Billable and bookable clinic services.',
    isService: true,
    columns: [
      { key: 'name', label: 'Service' },
      { key: 'code', label: 'Code' },
      { key: 'durationMinutes', label: 'Duration (min)' },
      { key: 'price', label: 'Price' },
    ],
  },
  'appointment-statuses': {
    slug: 'appointment-statuses',
    title: 'Appointment Statuses',
    description: 'Visit lifecycle statuses used by scheduling.',
    columns: [
      { key: 'name', label: 'Status' },
      { key: 'code', label: 'Code' },
      { key: 'color', label: 'Color' },
      { key: 'sortOrder', label: 'Order' },
    ],
  },
  'payment-methods': {
    slug: 'payment-methods',
    title: 'Payment Methods',
    description: 'Accepted payment modes for billing.',
    columns: [
      { key: 'name', label: 'Method' },
      { key: 'code', label: 'Code' },
    ],
  },
  'lead-sources': {
    slug: 'lead-sources',
    title: 'Lead Sources',
    description: 'Patient acquisition sources for CRM reporting.',
    columns: [
      { key: 'name', label: 'Source' },
      { key: 'code', label: 'Code' },
    ],
  },
  'patient-tags': {
    slug: 'patient-tags',
    title: 'Patient Tags',
    description: 'Reusable tags for patient segmentation.',
    columns: [
      { key: 'name', label: 'Tag' },
      { key: 'code', label: 'Code' },
    ],
  },
  'document-categories': {
    slug: 'document-categories',
    title: 'Document & Report Categories',
    description: 'Classification for uploaded patient documents and reports.',
    columns: [
      { key: 'name', label: 'Category' },
      { key: 'code', label: 'Code' },
      { key: 'sortOrder', label: 'Order' },
    ],
  },
  'follow-up-reasons': {
    slug: 'follow-up-reasons',
    title: 'Follow-up Reasons',
    description: 'Standard reasons used when scheduling patient follow-ups.',
    columns: [
      { key: 'name', label: 'Reason' },
      { key: 'code', label: 'Code' },
      { key: 'sortOrder', label: 'Order' },
    ],
  },
  'referral-sources': {
    slug: 'referral-sources',
    title: 'Referral Sources',
    description: 'Clinical referral taxonomy (doctors, partner clinics, self-referral, etc.), distinct from marketing lead sources.',
    columns: [
      { key: 'name', label: 'Source' },
      { key: 'code', label: 'Code' },
    ],
  },
  'handoff-categories': {
    slug: 'handoff-categories',
    title: 'Handoff Categories',
    description: 'Categories used when handing off a patient between doctors/departments.',
    columns: [
      { key: 'name', label: 'Category' },
      { key: 'code', label: 'Code' },
      { key: 'sortOrder', label: 'Order' },
    ],
  },
});

export const MASTER_NAV = Object.values(MASTER_CONFIGS);

export default MASTER_CONFIGS;
