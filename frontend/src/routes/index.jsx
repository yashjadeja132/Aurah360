import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { SettingsLayout } from '@/layouts/SettingsLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicRoute } from '@/routes/PublicRoute';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PatientPortalShell, PatientProtectedRoute } from '@/routes/PatientPortalRoutes';
import {
  LoginPage,
  ForgotPasswordPage,
  DashboardPage,
  StaffListPage,
  StaffCreatePage,
  StaffDetailPage,
  StaffEditPage,
  ProfilePage,
  ChangePasswordPage,
  BranchListPage,
  BranchCreatePage,
  BranchDetailPage,
  BranchEditPage,
  BranchSettingsPage,
  MasterPage,
  ResourcesPage,
  PrivacyAdminPage,
  AiGovernancePage,
  DoctorListPage,
  DoctorCreatePage,
  DoctorDetailPage,
  DoctorEditPage,
  DoctorSchedulePage,
  DoctorLeavePage,
  PatientListPage,
  PatientCreatePage,
  PatientDetailPage,
  PatientEditPage,
  ScheduleViewerPage,
  BranchHolidaysPage,
  DoctorBlockedSlotsPage,
  AppointmentListPage,
  AppointmentBookPage,
  AppointmentDetailPage,
  AppointmentEditPage,
  AppointmentCalendarPage,
  PatientAppointmentHistoryPage,
  ReceptionDashboardPage,
  QueueDashboardPage,
  ConsultationListPage,
  ConsultationWorkspacePage,
  PrescriptionListPage,
  PrescriptionEditorPage,
  PrescriptionPrintPage,
  TreatmentPlanListPage,
  TreatmentPlanBuilderPage,
  TreatmentPlanPrintPage,
  ProtocolLibraryPage,
  PackageBuilderPage,
  InvoiceListPage,
  CashClosePage,
  InvoiceDetailPage,
  InvoicePrintPage,
  TreatmentDashboardPage,
  TreatmentSafetyPage,
  SessionListPage,
  SessionExecutionPage,
  SessionPrintPage,
  PharmacyDashboardPage,
  PrescriptionQueuePage,
  DispenseScreenPage,
  InventoryDashboardPage,
  InventoryTransfersPage,
  StockLedgerPage,
  PurchaseOrdersPage,
  SuppliersPage,
  CrmDashboardPage,
  OfferBoardPage,
  RecallWorklistPage,
  LeadListPage,
  LeadDetailPage,
  KanbanPipelinePage,
  TaskBoardPage,
  LoyaltyDashboardPage,
  LoyaltySettingsPage,
  LoyaltyRulesPage,
  LoyaltyTiersPage,
  LoyaltyCampaignsPage,
  LoyaltyAdjustmentQueuePage,
  NotificationCenterPage,
  DeliveryLogPage,
  TemplateManagerPage,
  ReportsHubPage,
  RoleDashboardPage,
  AnalyticsDashboardPage,
  ReportViewerPage,
  ScheduledReportsPage,
  AnalyticsHomePage,
  ExecutiveDashboardPage,
  CategoryReportPage,
  PatientLoginPage,
  PatientDashboardPage,
  PatientAppointmentsPage,
  PatientRecordsPage,
  PatientPrescriptionsPage,
  PatientTreatmentsPage,
  PatientBillingPage,
  PatientDocumentsPage,
  PatientNotificationsPage,
  PatientProfilePage,
  PatientFeedbackPage,
  NotFoundPage,
} from '@/routes/lazyPages';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

function StaffPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function DoctorPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.DOCTORS_VIEW, PERMISSIONS.DOCTORS_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function PatientPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function SchedulePermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.SCHEDULE_VIEW, PERMISSIONS.SCHEDULE_ALL, PERMISSIONS.HOLIDAYS_VIEW]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function AppointmentPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function ReceptionPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.RECEPTION_VIEW, PERMISSIONS.RECEPTION_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function QueuePermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.QUEUE_VIEW, PERMISSIONS.QUEUE_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function ConsultationPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function PrescriptionPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function TreatmentPlanPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.TREATMENT_PLAN_VIEW, PERMISSIONS.TREATMENT_PLAN_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function BillingPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function TreatmentSessionPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.TREATMENT_SESSION_VIEW, PERMISSIONS.TREATMENT_SESSION_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function PharmacyPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.PHARMACY_VIEW, PERMISSIONS.PHARMACY_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function InventoryPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function CrmPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function LoyaltySettingsPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.LOYALTY_SETTINGS_VIEW, PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function LoyaltyRulesPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.LOYALTY_RULES_VIEW, PERMISSIONS.LOYALTY_RULES_MANAGE, PERMISSIONS.LOYALTY_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function LoyaltyCampaignsPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.LOYALTY_CAMPAIGNS_MANAGE, PERMISSIONS.LOYALTY_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function LoyaltyAdjustApprovePermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.LOYALTY_ADJUST_APPROVE, PERMISSIONS.LOYALTY_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function NotificationsPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.NOTIFICATIONS_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function ReportsPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function AnalyticsPermission({ children }) {
  return (
    <PermissionGuard
      permissions={[
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.REPORTS_ALL,
        PERMISSIONS.DASHBOARD_VIEW,
      ]}
      fallback="redirect"
    >
      {children}
    </PermissionGuard>
  );
}

function BranchPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

function MasterPermission({ children }) {
  return (
    <PermissionGuard permissions={[PERMISSIONS.MASTERS_VIEW, PERMISSIONS.MASTERS_ALL]} fallback="redirect">
      {children}
    </PermissionGuard>
  );
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: APP_ROUTES.LOGIN, element: <LoginPage /> },
          { path: APP_ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  {
    path: '/portal',
    element: <PatientPortalShell />,
    children: [
      { path: 'login', element: <PatientLoginPage /> },
      {
        element: <PatientProtectedRoute />,
        children: [
          { index: true, element: <PatientDashboardPage /> },
          { path: 'appointments', element: <PatientAppointmentsPage /> },
          { path: 'records', element: <PatientRecordsPage /> },
          { path: 'prescriptions', element: <PatientPrescriptionsPage /> },
          { path: 'treatments', element: <PatientTreatmentsPage /> },
          { path: 'billing', element: <PatientBillingPage /> },
          { path: 'documents', element: <PatientDocumentsPage /> },
          { path: 'notifications', element: <PatientNotificationsPage /> },
          { path: 'profile', element: <PatientProfilePage /> },
          { path: 'feedback', element: <PatientFeedbackPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: APP_ROUTES.DASHBOARD, element: <DashboardPage /> },
          {
            path: APP_ROUTES.STAFF,
            element: <StaffPermission><StaffListPage /></StaffPermission>,
          },
          {
            path: APP_ROUTES.STAFF_CREATE,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_ALL]} fallback="redirect">
                <StaffCreatePage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.STAFF_DETAIL,
            element: <StaffPermission><StaffDetailPage /></StaffPermission>,
          },
          {
            path: APP_ROUTES.STAFF_EDIT,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_ALL]} fallback="redirect">
                <StaffEditPage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.DOCTORS,
            element: <DoctorPermission><DoctorListPage /></DoctorPermission>,
          },
          {
            path: APP_ROUTES.DOCTOR_CREATE,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.DOCTORS_CREATE, PERMISSIONS.DOCTORS_ALL]} fallback="redirect">
                <DoctorCreatePage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.DOCTOR_DETAIL,
            element: <DoctorPermission><DoctorDetailPage /></DoctorPermission>,
          },
          {
            path: APP_ROUTES.DOCTOR_EDIT,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.DOCTORS_EDIT, PERMISSIONS.DOCTORS_ALL]} fallback="redirect">
                <DoctorEditPage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.DOCTOR_SCHEDULE,
            element: (
              <PermissionGuard
                permissions={[PERMISSIONS.DOCTOR_SCHEDULE_VIEW, PERMISSIONS.DOCTOR_SCHEDULE_ALL, PERMISSIONS.DOCTORS_VIEW]}
                fallback="redirect"
              >
                <DoctorSchedulePage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.DOCTOR_LEAVE,
            element: (
              <PermissionGuard
                permissions={[PERMISSIONS.DOCTOR_LEAVE_VIEW, PERMISSIONS.DOCTOR_LEAVE_ALL, PERMISSIONS.DOCTORS_VIEW]}
                fallback="redirect"
              >
                <DoctorLeavePage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.PATIENTS,
            element: <PatientPermission><PatientListPage /></PatientPermission>,
          },
          {
            path: APP_ROUTES.PATIENT_CREATE,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.PATIENTS_CREATE, PERMISSIONS.PATIENTS_ALL]} fallback="redirect">
                <PatientCreatePage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.PATIENT_DETAIL,
            element: <PatientPermission><PatientDetailPage /></PatientPermission>,
          },
          {
            path: APP_ROUTES.PATIENT_EDIT,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.PATIENTS_EDIT, PERMISSIONS.PATIENTS_ALL]} fallback="redirect">
                <PatientEditPage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.SCHEDULING_VIEWER,
            element: <SchedulePermission><ScheduleViewerPage /></SchedulePermission>,
          },
          {
            path: APP_ROUTES.SCHEDULING_HOLIDAYS,
            element: (
              <PermissionGuard
                permissions={[PERMISSIONS.HOLIDAYS_VIEW, PERMISSIONS.HOLIDAYS_ALL, PERMISSIONS.SCHEDULE_VIEW]}
                fallback="redirect"
              >
                <BranchHolidaysPage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.SCHEDULING_BLOCKED,
            element: <SchedulePermission><DoctorBlockedSlotsPage /></SchedulePermission>,
          },
          {
            path: APP_ROUTES.APPOINTMENTS,
            element: <AppointmentPermission><AppointmentListPage /></AppointmentPermission>,
          },
          {
            path: APP_ROUTES.APPOINTMENT_BOOK,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL]} fallback="redirect">
                <AppointmentBookPage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.APPOINTMENT_CALENDAR,
            element: <AppointmentPermission><AppointmentCalendarPage /></AppointmentPermission>,
          },
          {
            path: APP_ROUTES.APPOINTMENT_PATIENT_HISTORY,
            element: <AppointmentPermission><PatientAppointmentHistoryPage /></AppointmentPermission>,
          },
          {
            path: APP_ROUTES.APPOINTMENT_DETAIL,
            element: <AppointmentPermission><AppointmentDetailPage /></AppointmentPermission>,
          },
          {
            path: APP_ROUTES.APPOINTMENT_EDIT,
            element: (
              <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL]} fallback="redirect">
                <AppointmentEditPage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.RECEPTION,
            element: (
              <ReceptionPermission>
                <ReceptionDashboardPage />
              </ReceptionPermission>
            ),
          },
          {
            path: APP_ROUTES.QUEUE,
            element: (
              <QueuePermission>
                <QueueDashboardPage />
              </QueuePermission>
            ),
          },
          {
            path: APP_ROUTES.CONSULTATIONS,
            element: (
              <ConsultationPermission>
                <ConsultationListPage />
              </ConsultationPermission>
            ),
          },
          {
            path: APP_ROUTES.CONSULTATION_WORKSPACE,
            element: (
              <ConsultationPermission>
                <ConsultationWorkspacePage />
              </ConsultationPermission>
            ),
          },
          {
            path: APP_ROUTES.PRESCRIPTIONS,
            element: (
              <PrescriptionPermission>
                <PrescriptionListPage />
              </PrescriptionPermission>
            ),
          },
          {
            path: APP_ROUTES.PRESCRIPTION_PRINT,
            element: (
              <PrescriptionPermission>
                <PrescriptionPrintPage />
              </PrescriptionPermission>
            ),
          },
          {
            path: APP_ROUTES.PRESCRIPTION_EDIT,
            element: (
              <PrescriptionPermission>
                <PrescriptionEditorPage />
              </PrescriptionPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_PLANS,
            element: (
              <TreatmentPlanPermission>
                <TreatmentPlanListPage />
              </TreatmentPlanPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_PROTOCOLS,
            element: (
              <TreatmentPlanPermission>
                <ProtocolLibraryPage />
              </TreatmentPlanPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_PACKAGES,
            element: (
              <TreatmentPlanPermission>
                <PackageBuilderPage />
              </TreatmentPlanPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_PLAN_PRINT,
            element: (
              <TreatmentPlanPermission>
                <TreatmentPlanPrintPage />
              </TreatmentPlanPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_PLAN_EDIT,
            element: (
              <TreatmentPlanPermission>
                <TreatmentPlanBuilderPage />
              </TreatmentPlanPermission>
            ),
          },
          {
            path: APP_ROUTES.BILLING,
            element: (
              <BillingPermission>
                <InvoiceListPage />
              </BillingPermission>
            ),
          },
          {
            path: APP_ROUTES.INVOICE_PRINT,
            element: (
              <BillingPermission>
                <InvoicePrintPage />
              </BillingPermission>
            ),
          },
          {
            path: APP_ROUTES.INVOICE_DETAIL,
            element: (
              <BillingPermission>
                <InvoiceDetailPage />
              </BillingPermission>
            ),
          },
          {
            path: APP_ROUTES.BILLING_CASH_CLOSE,
            element: (
              <BillingPermission>
                <CashClosePage />
              </BillingPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_DASHBOARD,
            element: (
              <TreatmentSessionPermission>
                <TreatmentDashboardPage />
              </TreatmentSessionPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_SAFETY,
            element: (
              <TreatmentSessionPermission>
                <TreatmentSafetyPage />
              </TreatmentSessionPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_SESSIONS,
            element: (
              <TreatmentSessionPermission>
                <SessionListPage />
              </TreatmentSessionPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_SESSION_PRINT,
            element: (
              <TreatmentSessionPermission>
                <SessionPrintPage />
              </TreatmentSessionPermission>
            ),
          },
          {
            path: APP_ROUTES.TREATMENT_SESSION_DETAIL,
            element: (
              <TreatmentSessionPermission>
                <SessionExecutionPage />
              </TreatmentSessionPermission>
            ),
          },
          {
            path: APP_ROUTES.PHARMACY,
            element: (
              <PharmacyPermission>
                <PharmacyDashboardPage />
              </PharmacyPermission>
            ),
          },
          {
            path: APP_ROUTES.PHARMACY_QUEUE,
            element: (
              <PharmacyPermission>
                <PrescriptionQueuePage />
              </PharmacyPermission>
            ),
          },
          {
            path: APP_ROUTES.PHARMACY_DISPENSE,
            element: (
              <PharmacyPermission>
                <DispenseScreenPage />
              </PharmacyPermission>
            ),
          },
          {
            path: APP_ROUTES.INVENTORY,
            element: (
              <InventoryPermission>
                <InventoryDashboardPage />
              </InventoryPermission>
            ),
          },
          {
            path: APP_ROUTES.INVENTORY_LEDGER,
            element: (
              <InventoryPermission>
                <StockLedgerPage />
              </InventoryPermission>
            ),
          },
          {
            path: APP_ROUTES.PURCHASE_ORDERS,
            element: (
              <InventoryPermission>
                <PurchaseOrdersPage />
              </InventoryPermission>
            ),
          },
          {
            path: APP_ROUTES.SUPPLIERS,
            element: (
              <InventoryPermission>
                <SuppliersPage />
              </InventoryPermission>
            ),
          },
          {
            path: APP_ROUTES.INVENTORY_TRANSFERS,
            element: (
              <InventoryPermission>
                <InventoryTransfersPage />
              </InventoryPermission>
            ),
          },
          {
            path: APP_ROUTES.CRM,
            element: (
              <CrmPermission>
                <CrmDashboardPage />
              </CrmPermission>
            ),
          },
          {
            path: APP_ROUTES.CRM_OFFERS,
            element: (
              <CrmPermission>
                <OfferBoardPage />
              </CrmPermission>
            ),
          },
          {
            path: APP_ROUTES.CRM_RECALL,
            element: (
              <CrmPermission>
                <RecallWorklistPage />
              </CrmPermission>
            ),
          },
          {
            path: APP_ROUTES.CRM_LEADS,
            element: (
              <CrmPermission>
                <LeadListPage />
              </CrmPermission>
            ),
          },
          {
            path: APP_ROUTES.CRM_PIPELINE,
            element: (
              <CrmPermission>
                <KanbanPipelinePage />
              </CrmPermission>
            ),
          },
          {
            path: APP_ROUTES.CRM_TASKS,
            element: (
              <CrmPermission>
                <TaskBoardPage />
              </CrmPermission>
            ),
          },
          {
            path: APP_ROUTES.CRM_LEAD_DETAIL,
            element: (
              <CrmPermission>
                <LeadDetailPage />
              </CrmPermission>
            ),
          },
          {
            path: APP_ROUTES.LOYALTY,
            element: (
              <PermissionGuard
                permissions={[PERMISSIONS.LOYALTY_SETTINGS_VIEW, PERMISSIONS.LOYALTY_RULES_VIEW, PERMISSIONS.LOYALTY_REPORTS_VIEW, PERMISSIONS.LOYALTY_ALL]}
                fallback="redirect"
              >
                <LoyaltyDashboardPage />
              </PermissionGuard>
            ),
          },
          {
            path: APP_ROUTES.LOYALTY_SETTINGS,
            element: <LoyaltySettingsPermission><LoyaltySettingsPage /></LoyaltySettingsPermission>,
          },
          {
            path: APP_ROUTES.LOYALTY_RULES,
            element: <LoyaltyRulesPermission><LoyaltyRulesPage /></LoyaltyRulesPermission>,
          },
          {
            path: APP_ROUTES.LOYALTY_TIERS,
            element: <LoyaltySettingsPermission><LoyaltyTiersPage /></LoyaltySettingsPermission>,
          },
          {
            path: APP_ROUTES.LOYALTY_CAMPAIGNS,
            element: <LoyaltyCampaignsPermission><LoyaltyCampaignsPage /></LoyaltyCampaignsPermission>,
          },
          {
            path: APP_ROUTES.LOYALTY_ADJUSTMENTS,
            element: <LoyaltyAdjustApprovePermission><LoyaltyAdjustmentQueuePage /></LoyaltyAdjustApprovePermission>,
          },
          {
            path: APP_ROUTES.NOTIFICATIONS,
            element: (
              <NotificationsPermission>
                <NotificationCenterPage />
              </NotificationsPermission>
            ),
          },
          {
            path: APP_ROUTES.NOTIFICATION_LOG,
            element: (
              <NotificationsPermission>
                <DeliveryLogPage />
              </NotificationsPermission>
            ),
          },
          {
            path: APP_ROUTES.NOTIFICATION_TEMPLATES,
            element: (
              <NotificationsPermission>
                <TemplateManagerPage />
              </NotificationsPermission>
            ),
          },
          {
            path: APP_ROUTES.ANALYTICS,
            element: (
              <AnalyticsPermission>
                <AnalyticsHomePage />
              </AnalyticsPermission>
            ),
          },
          {
            path: APP_ROUTES.ANALYTICS_EXECUTIVE,
            element: (
              <AnalyticsPermission>
                <ExecutiveDashboardPage />
              </AnalyticsPermission>
            ),
          },
          {
            path: APP_ROUTES.ANALYTICS_CATEGORY,
            element: (
              <AnalyticsPermission>
                <CategoryReportPage />
              </AnalyticsPermission>
            ),
          },
          {
            path: APP_ROUTES.REPORTS,
            element: (
              <ReportsPermission>
                <ReportsHubPage />
              </ReportsPermission>
            ),
          },
          {
            path: APP_ROUTES.REPORTS_ANALYTICS,
            element: (
              <ReportsPermission>
                <AnalyticsDashboardPage />
              </ReportsPermission>
            ),
          },
          {
            path: APP_ROUTES.REPORTS_SCHEDULED,
            element: (
              <ReportsPermission>
                <ScheduledReportsPage />
              </ReportsPermission>
            ),
          },
          {
            path: APP_ROUTES.REPORTS_DASHBOARD,
            element: (
              <ReportsPermission>
                <RoleDashboardPage />
              </ReportsPermission>
            ),
          },
          {
            path: APP_ROUTES.REPORTS_VIEW,
            element: (
              <ReportsPermission>
                <ReportViewerPage />
              </ReportsPermission>
            ),
          },
          { path: APP_ROUTES.PROFILE, element: <ProfilePage /> },
          { path: APP_ROUTES.CHANGE_PASSWORD, element: <ChangePasswordPage /> },
          {
            path: '/settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to={APP_ROUTES.BRANCHES} replace /> },
              {
                path: 'branches',
                element: <BranchPermission><BranchListPage /></BranchPermission>,
              },
              {
                path: 'branches/new',
                element: (
                  <PermissionGuard permissions={[PERMISSIONS.BRANCHES_CREATE, PERMISSIONS.BRANCHES_ALL]} fallback="redirect">
                    <BranchCreatePage />
                  </PermissionGuard>
                ),
              },
              {
                path: 'branches/:id',
                element: <BranchPermission><BranchDetailPage /></BranchPermission>,
              },
              {
                path: 'branches/:id/edit',
                element: (
                  <PermissionGuard permissions={[PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_ALL]} fallback="redirect">
                    <BranchEditPage />
                  </PermissionGuard>
                ),
              },
              {
                path: 'branches/:id/settings',
                element: (
                  <PermissionGuard permissions={[PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_ALL]} fallback="redirect">
                    <BranchSettingsPage />
                  </PermissionGuard>
                ),
              },
              {
                path: 'resources',
                element: (
                  <PermissionGuard permissions={[PERMISSIONS.RESOURCES_VIEW, PERMISSIONS.RESOURCES_ALL]} fallback="redirect">
                    <ResourcesPage />
                  </PermissionGuard>
                ),
              },
              {
                path: 'privacy',
                element: (
                  <PermissionGuard
                    permissions={[PERMISSIONS.PRIVACY_REQUEST_VIEW, PERMISSIONS.PRIVACY_REQUEST_ALL, PERMISSIONS.BREAK_GLASS]}
                    fallback="redirect"
                  >
                    <PrivacyAdminPage />
                  </PermissionGuard>
                ),
              },
              {
                path: 'ai-governance',
                element: (
                  <PermissionGuard
                    permissions={[PERMISSIONS.AI_GOVERNANCE_VIEW, PERMISSIONS.AI_GOVERNANCE_MANAGE]}
                    fallback="redirect"
                  >
                    <AiGovernancePage />
                  </PermissionGuard>
                ),
              },
              {
                path: ':masterSlug',
                element: <MasterPermission><MasterPage /></MasterPermission>,
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '/home', element: <Navigate to={APP_ROUTES.DASHBOARD} replace /> },
  { path: APP_ROUTES.NOT_FOUND, element: <NotFoundPage /> },
]);

export default router;
