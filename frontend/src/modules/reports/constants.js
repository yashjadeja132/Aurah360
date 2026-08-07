export const DASHBOARD_TYPES = [
  { value: 'owner', label: 'Owner' },
  { value: 'branch-manager', label: 'Branch Manager' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'reception', label: 'Reception' },
  { value: 'crm', label: 'CRM' },
  { value: 'pharmacy', label: 'Pharmacy' },
];

export const REPORT_TYPES = [
  { value: 'appointments', label: 'Appointments' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'payments', label: 'Payments' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'treatments', label: 'Treatments' },
  { value: 'consultations', label: 'Consultations' },
  { value: 'patients', label: 'Patients' },
  { value: 'doctors', label: 'Doctors' },
  { value: 'leads', label: 'Leads' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'queue', label: 'Queue' },
  { value: 'loyalty-liability', label: 'Loyalty Liability' },
  { value: 'loyalty-issuance', label: 'Loyalty Issuance' },
  { value: 'loyalty-redemption', label: 'Loyalty Redemption' },
  { value: 'loyalty-expiry', label: 'Loyalty Expiry' },
  { value: 'loyalty-referral', label: 'Loyalty Referral' },
];

export const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
  { value: 'pdf', label: 'PDF (placeholder)' },
];

export const SCHEDULE_FREQUENCIES = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export function formatMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export function trendDelta(current, previous) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return pct;
}
