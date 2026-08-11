import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  Stethoscope,
  HeartPulse,
  CalendarClock,
  CalendarCheck2,
  ClipboardList,
  ListOrdered,
  FileHeart,
  Pill,
  IndianRupee,
  Activity,
  Package,
  Syringe,
  Target,
  Bell,
  BarChart3,
  Wallet,
  DoorOpen,
  ShieldCheck,
  Sparkles,
  Gift,
  FlaskConical,
  HardHat,
  FileSearch,
  Plug,
} from 'lucide-react';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/rbac';

/**
 * Single source of truth for the app's primary navigation — used by AppLayout's sidebar AND
 * by CommandPalette's "jump to page" search (via constants/searchablePages.js). Keeping this
 * as one exported list means the two never drift: a nav item added/removed/re-gated here shows
 * up (or stops showing up) in both places automatically.
 *
 * `roles` on a group or item is a WHITELIST: the entry is FOR those roles. It is an
 * additional gate on top of `permissions`, never a replacement — an entry renders only
 * when the role check AND the permission check both pass (defence in depth; the API is
 * the real authority). Omitting `roles` means "every role", subject to permissions.
 */
const ADMINS = [ROLES.OWNER, ROLES.ADMIN];
const MANAGERS = [...ADMINS, ROLES.BRANCH_MANAGER];
const CLINICAL = [ROLES.DOCTOR, ROLES.NURSE];

/** Grouped navigation — mirrors the PRD's role-based information architecture (§17.3). */
export const navGroups = [
  {
    labelKey: 'nav.overview',
    label: 'Overview',
    // Every role keeps a home link. `/` resolves through RoleLanding, so a doctor lands
    // on "My day", a cashier on the cash desk, a branch manager on the branch screen.
    items: [{ to: APP_ROUTES.DASHBOARD, labelKey: 'nav.dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    labelKey: 'nav.frontDesk',
    label: 'Front desk',
    items: [
      { to: APP_ROUTES.RECEPTION_DESK, labelKey: 'nav.receptionDesk', label: 'Front desk', icon: ClipboardList, roles: [...MANAGERS, ROLES.RECEPTIONIST], permissions: [PERMISSIONS.RECEPTION_VIEW, PERMISSIONS.RECEPTION_ALL] },
      // Branch command is a management screen; it was previously gated on REPORTS_VIEW,
      // which every reporting role holds — hence doctors/cashiers could see it.
      { to: APP_ROUTES.BRANCH_COMMAND, labelKey: 'nav.branchCommand', label: 'Branch', icon: DoorOpen, roles: MANAGERS, permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL] },
      { to: APP_ROUTES.QUEUE, labelKey: 'nav.queue', label: 'Queue', icon: ListOrdered, roles: [...MANAGERS, ...CLINICAL, ROLES.RECEPTIONIST, ROLES.TECHNICIAN], permissions: [PERMISSIONS.QUEUE_VIEW, PERMISSIONS.QUEUE_ALL] },
      { to: APP_ROUTES.APPOINTMENTS, labelKey: 'nav.appointments', label: 'Appointments', icon: CalendarCheck2, roles: [...MANAGERS, ...CLINICAL, ROLES.RECEPTIONIST, ROLES.TECHNICIAN, ROLES.CRM_EXECUTIVE], permissions: [PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL] },
      { to: APP_ROUTES.SCHEDULING_VIEWER, labelKey: 'nav.scheduling', label: 'Scheduling', icon: CalendarClock, roles: [...MANAGERS, ROLES.RECEPTIONIST, ROLES.DOCTOR], permissions: [PERMISSIONS.SCHEDULE_VIEW, PERMISSIONS.SCHEDULE_ALL, PERMISSIONS.HOLIDAYS_VIEW] },
      { to: APP_ROUTES.PATIENTS, labelKey: 'nav.patients', label: 'Patients', icon: HeartPulse, roles: [...MANAGERS, ...CLINICAL, ROLES.RECEPTIONIST, ROLES.TECHNICIAN, ROLES.CRM_EXECUTIVE], permissions: [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL] },
    ],
  },
  {
    labelKey: 'nav.clinical',
    label: 'Clinical',
    items: [
      { to: APP_ROUTES.CONSULTATIONS, labelKey: 'nav.emr', label: 'EMR', icon: FileHeart, roles: [...MANAGERS, ...CLINICAL], permissions: [PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL] },
      { to: APP_ROUTES.REPORT_REVIEW_QUEUE, labelKey: 'nav.reportReview', label: 'Report review', icon: FlaskConical, roles: [...ADMINS, ROLES.DOCTOR], permissions: [PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL] },
      { to: APP_ROUTES.FOLLOW_UPS_QUEUE, labelKey: 'nav.followUps', label: 'Follow-ups', icon: CalendarClock, roles: [...ADMINS, ROLES.DOCTOR], permissions: [PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL] },
      { to: APP_ROUTES.PRESCRIPTIONS, labelKey: 'nav.prescriptions', label: 'Prescriptions', icon: Pill, roles: [...MANAGERS, ...CLINICAL, ROLES.PHARMACIST], permissions: [PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL] },
      // Plans / sessions / protocols / packages / safety are now tabs inside the Treatments hub,
      // so three sidebar entries collapse to one. The old routes stay registered for deep links.
      { to: APP_ROUTES.TREATMENT_DASHBOARD, labelKey: 'nav.treatments', label: 'Treatments', icon: Activity, roles: [...MANAGERS, ...CLINICAL, ROLES.TECHNICIAN], permissions: [PERMISSIONS.TREATMENT_SESSION_VIEW, PERMISSIONS.TREATMENT_SESSION_ALL, PERMISSIONS.TREATMENT_PLAN_VIEW, PERMISSIONS.TREATMENT_PLAN_ALL, PERMISSIONS.ADVERSE_EVENT_VIEW, PERMISSIONS.ADVERSE_EVENT_CREATE, PERMISSIONS.PATCH_TEST_VIEW] },
      { to: APP_ROUTES.TREATMENT_PLAN_APPROVAL_QUEUE, labelKey: 'nav.treatmentPlanApprovals', label: 'Approve treatment plans', icon: Stethoscope, roles: [...ADMINS, ROLES.DOCTOR], permissions: [PERMISSIONS.TREATMENT_PLAN_APPROVE, PERMISSIONS.TREATMENT_PLAN_ALL] },
      { to: APP_ROUTES.TECHNICIAN_WORKLIST, labelKey: 'nav.technicianWorklist', label: 'My worklist', icon: HardHat, roles: [...ADMINS, ROLES.TECHNICIAN], permissions: [PERMISSIONS.TREATMENT_SESSION_VIEW, PERMISSIONS.TREATMENT_SESSION_ALL] },
    ],
  },
  {
    labelKey: 'nav.operations',
    label: 'Operations',
    items: [
      { to: APP_ROUTES.PHARMACY, labelKey: 'nav.pharmacy', label: 'Pharmacy', icon: Syringe, roles: [...MANAGERS, ROLES.PHARMACIST], permissions: [PERMISSIONS.PHARMACY_VIEW, PERMISSIONS.PHARMACY_ALL] },
      { to: APP_ROUTES.INVENTORY, labelKey: 'nav.inventory', label: 'Inventory', icon: Package, roles: [...MANAGERS, ROLES.PHARMACIST], permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ALL] },
      // Transfers, ledger, purchase orders, suppliers and expiry are now tabs in the Stock hub.
      // Dues / cash close / discount approvals are now tabs inside the Billing hub, so four
      // sidebar entries collapse to two. The old routes stay registered for deep links.
      { to: APP_ROUTES.BILLING_CASHIER, labelKey: 'nav.cashDesk', label: 'Cash desk', icon: Wallet, permissions: [PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL] },
      { to: APP_ROUTES.BILLING, labelKey: 'nav.billing', label: 'Billing', icon: IndianRupee, permissions: [PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL] },
    ],
  },
  {
    labelKey: 'nav.growth',
    label: 'Growth',
    items: [
      // Leads, pipeline, follow-ups, recalls, offers and feedback are now tabs in the CRM hub.
      { to: APP_ROUTES.CRM, labelKey: 'nav.crm', label: 'CRM', icon: Target, permissions: [PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_ALL, PERMISSIONS.CRM_RECALL, PERMISSIONS.CRM_OFFERS_VIEW, PERMISSIONS.CRM_OFFERS_MANAGE, PERMISSIONS.CRM_FEEDBACK_VIEW] },
      { to: APP_ROUTES.NOTIFICATIONS, labelKey: 'nav.notifications', label: 'Notifications', icon: Bell, permissions: [PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.NOTIFICATIONS_ALL] },
      // Dashboards, reports, analytics and scheduled reports are now tabs in the Reports hub.
      { to: APP_ROUTES.REPORTS, labelKey: 'nav.reports', label: 'Reports', icon: BarChart3, permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL, PERMISSIONS.DASHBOARD_VIEW] },
    ],
  },
  {
    labelKey: 'nav.loyaltyGroup',
    label: 'Loyalty',
    items: [
      // Overview, rules, tiers, campaigns, approvals and settings are now tabs in the Loyalty hub.
      { to: APP_ROUTES.LOYALTY, labelKey: 'nav.loyaltyDashboard', label: 'Loyalty', icon: Gift, permissions: [PERMISSIONS.LOYALTY_SETTINGS_VIEW, PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_RULES_VIEW, PERMISSIONS.LOYALTY_RULES_MANAGE, PERMISSIONS.LOYALTY_REPORTS_VIEW, PERMISSIONS.LOYALTY_CAMPAIGNS_MANAGE, PERMISSIONS.LOYALTY_ADJUST_APPROVE, PERMISSIONS.LOYALTY_ALL] },
    ],
  },
  {
    labelKey: 'nav.administration',
    label: 'Administration',
    items: [
      { to: APP_ROUTES.STAFF, labelKey: 'nav.staff', label: 'Staff', icon: Users, permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL] },
      { to: APP_ROUTES.STAFF_ROSTER, labelKey: 'nav.staffRoster', label: 'Staff/Rosters', icon: ClipboardList, roles: MANAGERS, permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL] },
      { to: APP_ROUTES.DOCTORS, labelKey: 'nav.doctors', label: 'Doctors', icon: Stethoscope, permissions: [PERMISSIONS.DOCTORS_VIEW, PERMISSIONS.DOCTORS_ALL] },
      { to: APP_ROUTES.SETTINGS_RESOURCES, labelKey: 'nav.resources', label: 'Resources', icon: DoorOpen, permissions: [PERMISSIONS.RESOURCES_VIEW, PERMISSIONS.RESOURCES_ALL] },
      { to: APP_ROUTES.SETTINGS_PRIVACY, labelKey: 'nav.privacy', label: 'Privacy & access', icon: ShieldCheck, permissions: [PERMISSIONS.PRIVACY_REQUEST_VIEW, PERMISSIONS.PRIVACY_REQUEST_ALL, PERMISSIONS.BREAK_GLASS] },
      { to: APP_ROUTES.SETTINGS_AI_GOVERNANCE, labelKey: 'nav.aiGovernance', label: 'AI governance', icon: Sparkles, permissions: [PERMISSIONS.AI_GOVERNANCE_VIEW, PERMISSIONS.AI_GOVERNANCE_MANAGE] },
      { to: APP_ROUTES.SETTINGS_INTEGRATIONS, labelKey: 'nav.integrations', label: 'Integrations', icon: Plug, permissions: [PERMISSIONS.AI_GOVERNANCE_VIEW, PERMISSIONS.AI_GOVERNANCE_MANAGE, PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.NOTIFICATIONS_ALL] },
      { to: APP_ROUTES.SETTINGS_ORGANIZATION, labelKey: 'nav.organizationProfile', label: 'Organization profile', icon: Building2, permissions: [PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL] },
      { to: APP_ROUTES.SETTINGS_AUDIT_LOG, labelKey: 'nav.auditLog', label: 'Audit log', icon: FileSearch, permissions: [PERMISSIONS.AUDIT_VIEW] },
      {
        to: APP_ROUTES.SETTINGS,
        labelKey: 'nav.settings',
        label: 'Settings',
        icon: Settings,
        permissions: [PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL, PERMISSIONS.MASTERS_VIEW, PERMISSIONS.MASTERS_ALL],
      },
    ],
  },
];

/**
 * Both gates must pass. The permission gate alone was too coarse: a role granted one narrow
 * permission inherited whole sections — DOCTOR holds reports.view for its own dashboard, which
 * was enough to surface the Branch Manager command screen. `roles` is a whitelist; omitting it
 * means "every role", still subject to permissions.
 */
export const allowedForRole = (entry, role) => !entry.roles || entry.roles.includes(role);

export default navGroups;
