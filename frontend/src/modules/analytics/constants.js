export const ANALYTICS_CATEGORIES = [
  { value: 'appointments', label: 'Appointments', path: 'appointments' },
  { value: 'patients', label: 'Patients', path: 'patients' },
  { value: 'doctors', label: 'Doctors', path: 'doctors' },
  { value: 'treatments', label: 'Treatments', path: 'treatments' },
  { value: 'billing', label: 'Billing', path: 'billing' },
  { value: 'inventory', label: 'Inventory', path: 'inventory' },
  { value: 'crm', label: 'CRM', path: 'crm' },
  { value: 'ai', label: 'AI (soon)', path: 'ai' },
];

export const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

export function money(n) {
  return Number(n || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}
