import { lazy } from 'react';

/** Route-level code splitting (RC1) — keep heavy modules out of the initial bundle. */

export const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
export const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
export const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
export const StaffListPage = lazy(() => import('@/pages/users/StaffListPage'));
export const StaffCreatePage = lazy(() => import('@/pages/users/StaffCreatePage'));
export const StaffDetailPage = lazy(() => import('@/pages/users/StaffDetailPage'));
export const StaffEditPage = lazy(() => import('@/pages/users/StaffEditPage'));
export const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
export const ChangePasswordPage = lazy(() => import('@/pages/profile/ChangePasswordPage'));
export const BranchListPage = lazy(() => import('@/pages/settings/branches/BranchListPage'));
export const BranchCreatePage = lazy(() => import('@/pages/settings/branches/BranchCreatePage'));
export const BranchDetailPage = lazy(() => import('@/pages/settings/branches/BranchDetailPage'));
export const BranchEditPage = lazy(() => import('@/pages/settings/branches/BranchEditPage'));
export const BranchSettingsPage = lazy(() => import('@/pages/settings/branches/BranchSettingsPage'));
export const MasterPage = lazy(() => import('@/pages/settings/masters/MasterPage'));
export const ResourcesPage = lazy(() => import('@/pages/settings/ResourcesPage'));
export const PrivacyAdminPage = lazy(() => import('@/pages/settings/PrivacyAdminPage'));
export const AiGovernancePage = lazy(() => import('@/pages/settings/AiGovernancePage'));
export const DoctorListPage = lazy(() => import('@/pages/doctors/DoctorListPage'));
export const DoctorCreatePage = lazy(() => import('@/pages/doctors/DoctorCreatePage'));
export const DoctorDetailPage = lazy(() => import('@/pages/doctors/DoctorDetailPage'));
export const DoctorEditPage = lazy(() => import('@/pages/doctors/DoctorEditPage'));
export const DoctorSchedulePage = lazy(() => import('@/pages/doctors/DoctorSchedulePage'));
export const DoctorLeavePage = lazy(() => import('@/pages/doctors/DoctorLeavePage'));
export const PatientListPage = lazy(() => import('@/pages/patients/PatientListPage'));
export const PatientCreatePage = lazy(() => import('@/pages/patients/PatientCreatePage'));
export const PatientDetailPage = lazy(() => import('@/pages/patients/PatientDetailPage'));
export const PatientEditPage = lazy(() => import('@/pages/patients/PatientEditPage'));
export const ScheduleViewerPage = lazy(() => import('@/pages/scheduling/ScheduleViewerPage'));
export const BranchHolidaysPage = lazy(() => import('@/pages/scheduling/BranchHolidaysPage'));
export const DoctorBlockedSlotsPage = lazy(() => import('@/pages/scheduling/DoctorBlockedSlotsPage'));
export const AppointmentListPage = lazy(() => import('@/pages/appointments/AppointmentListPage'));
export const AppointmentBookPage = lazy(() => import('@/pages/appointments/AppointmentBookPage'));
export const AppointmentDetailPage = lazy(() => import('@/pages/appointments/AppointmentDetailPage'));
export const AppointmentEditPage = lazy(() => import('@/pages/appointments/AppointmentEditPage'));
export const AppointmentCalendarPage = lazy(() => import('@/pages/appointments/AppointmentCalendarPage'));
export const PatientAppointmentHistoryPage = lazy(
  () => import('@/pages/appointments/PatientAppointmentHistoryPage')
);
export const ReceptionDashboardPage = lazy(() => import('@/pages/reception/ReceptionDashboardPage'));
export const QueueDashboardPage = lazy(() => import('@/pages/reception/QueueDashboardPage'));
export const ConsultationListPage = lazy(() => import('@/pages/consultations/ConsultationListPage'));
export const ConsultationWorkspacePage = lazy(
  () => import('@/pages/consultations/ConsultationWorkspacePage')
);
export const PrescriptionListPage = lazy(() => import('@/pages/prescriptions/PrescriptionListPage'));
export const PrescriptionEditorPage = lazy(() => import('@/pages/prescriptions/PrescriptionEditorPage'));
export const PrescriptionPrintPage = lazy(() => import('@/pages/prescriptions/PrescriptionPrintPage'));
export const TreatmentPlanListPage = lazy(() => import('@/pages/treatmentPlans/TreatmentPlanListPage'));
export const TreatmentPlanBuilderPage = lazy(
  () => import('@/pages/treatmentPlans/TreatmentPlanBuilderPage')
);
export const TreatmentPlanPrintPage = lazy(() => import('@/pages/treatmentPlans/TreatmentPlanPrintPage'));
export const ProtocolLibraryPage = lazy(() => import('@/pages/treatmentPlans/ProtocolLibraryPage'));
export const PackageBuilderPage = lazy(() => import('@/pages/treatmentPlans/PackageBuilderPage'));
export const InvoiceListPage = lazy(() => import('@/pages/billing/InvoiceListPage'));
export const CashClosePage = lazy(() => import('@/pages/billing/CashClosePage'));
export const InvoiceDetailPage = lazy(() => import('@/pages/billing/InvoiceDetailPage'));
export const InvoicePrintPage = lazy(() => import('@/pages/billing/InvoicePrintPage'));
export const TreatmentSafetyPage = lazy(() => import('@/pages/treatments/TreatmentSafetyPage'));
export const TreatmentDashboardPage = lazy(
  () => import('@/pages/treatmentSessions/TreatmentDashboardPage')
);
export const SessionListPage = lazy(() => import('@/pages/treatmentSessions/SessionListPage'));
export const SessionExecutionPage = lazy(() => import('@/pages/treatmentSessions/SessionExecutionPage'));
export const SessionPrintPage = lazy(() => import('@/pages/treatmentSessions/SessionPrintPage'));
export const PharmacyDashboardPage = lazy(() => import('@/pages/pharmacy/PharmacyDashboardPage'));
export const PrescriptionQueuePage = lazy(() => import('@/pages/pharmacy/PrescriptionQueuePage'));
export const DispenseScreenPage = lazy(() => import('@/pages/pharmacy/DispenseScreenPage'));
export const InventoryDashboardPage = lazy(() => import('@/pages/inventory/InventoryDashboardPage'));
export const InventoryTransfersPage = lazy(() => import('@/pages/inventory/InventoryTransfersPage'));
export const StockLedgerPage = lazy(() => import('@/pages/inventory/StockLedgerPage'));
export const PurchaseOrdersPage = lazy(() => import('@/pages/inventory/PurchaseOrdersPage'));
export const SuppliersPage = lazy(() => import('@/pages/inventory/SuppliersPage'));
export const CrmDashboardPage = lazy(() => import('@/pages/crm/CrmDashboardPage'));
export const OfferBoardPage = lazy(() => import('@/pages/crm/OfferBoardPage'));
export const RecallWorklistPage = lazy(() => import('@/pages/crm/RecallWorklistPage'));
export const LeadListPage = lazy(() => import('@/pages/crm/LeadListPage'));
export const LeadDetailPage = lazy(() => import('@/pages/crm/LeadDetailPage'));
export const KanbanPipelinePage = lazy(() => import('@/pages/crm/KanbanPipelinePage'));
export const TaskBoardPage = lazy(() => import('@/pages/crm/TaskBoardPage'));
export const NotificationCenterPage = lazy(
  () => import('@/pages/notifications/NotificationCenterPage')
);
export const DeliveryLogPage = lazy(() => import('@/pages/notifications/DeliveryLogPage'));
export const TemplateManagerPage = lazy(() => import('@/pages/notifications/TemplateManagerPage'));
export const ReportsHubPage = lazy(() => import('@/pages/reports/ReportsHubPage'));
export const RoleDashboardPage = lazy(() => import('@/pages/reports/RoleDashboardPage'));
export const AnalyticsDashboardPage = lazy(() => import('@/pages/reports/AnalyticsDashboardPage'));
export const ReportViewerPage = lazy(() => import('@/pages/reports/ReportViewerPage'));
export const ScheduledReportsPage = lazy(() => import('@/pages/reports/ScheduledReportsPage'));
export const AnalyticsHomePage = lazy(() => import('@/pages/analytics/AnalyticsHomePage'));
export const ExecutiveDashboardPage = lazy(() => import('@/pages/analytics/ExecutiveDashboardPage'));
export const CategoryReportPage = lazy(() => import('@/pages/analytics/CategoryReportPage'));
export const PatientLoginPage = lazy(() => import('@/pages/portal/PatientLoginPage'));
export const PatientDashboardPage = lazy(() => import('@/pages/portal/PatientDashboardPage'));
export const PatientAppointmentsPage = lazy(() => import('@/pages/portal/PatientAppointmentsPage'));
export const PatientRecordsPage = lazy(() => import('@/pages/portal/PatientRecordsPage'));
export const PatientPrescriptionsPage = lazy(() => import('@/pages/portal/PatientPrescriptionsPage'));
export const PatientTreatmentsPage = lazy(() => import('@/pages/portal/PatientTreatmentsPage'));
export const PatientBillingPage = lazy(() => import('@/pages/portal/PatientBillingPage'));
export const PatientDocumentsPage = lazy(() => import('@/pages/portal/PatientDocumentsPage'));
export const PatientNotificationsPage = lazy(() => import('@/pages/portal/PatientNotificationsPage'));
export const PatientProfilePage = lazy(() => import('@/pages/portal/PatientProfilePage'));
export const PatientFeedbackPage = lazy(() => import('@/pages/portal/PatientFeedbackPage'));
export const LoyaltyDashboardPage = lazy(() => import('@/pages/loyalty/LoyaltyDashboardPage'));
export const LoyaltySettingsPage = lazy(() => import('@/pages/loyalty/LoyaltySettingsPage'));
export const LoyaltyRulesPage = lazy(() => import('@/pages/loyalty/LoyaltyRulesPage'));
export const LoyaltyTiersPage = lazy(() => import('@/pages/loyalty/LoyaltyTiersPage'));
export const LoyaltyCampaignsPage = lazy(() => import('@/pages/loyalty/LoyaltyCampaignsPage'));
export const LoyaltyAdjustmentQueuePage = lazy(
  () => import('@/pages/loyalty/LoyaltyAdjustmentQueuePage')
);
export const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
