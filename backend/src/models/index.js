import User from './User.model.js';
import RefreshToken from './RefreshToken.model.js';
import Role from './Role.model.js';
import Permission from './Permission.model.js';
import AuditLog from './AuditLog.model.js';
import Branch from './Branch.model.js';
import Master from './Master.model.js';
import Doctor from './Doctor.model.js';
import DoctorSchedule from './DoctorSchedule.model.js';
import DoctorLeave from './DoctorLeave.model.js';
import Patient from './Patient.model.js';
import PatientDocument from './PatientDocument.model.js';
import PatientTimeline from './PatientTimeline.model.js';
import Sequence from './Sequence.model.js';
import BranchHoliday from './BranchHoliday.model.js';
import DoctorBlockedSlot from './DoctorBlockedSlot.model.js';
import DoctorSpecialSchedule from './DoctorSpecialSchedule.model.js';
import Appointment from './Appointment.model.js';
import QueueEntry from './QueueEntry.model.js';
import Consultation from './Consultation.model.js';
import ConsultationSoap from './ConsultationSoap.model.js';
import ConsultationVitals from './ConsultationVitals.model.js';
import ConsultationDiagnosis from './ConsultationDiagnosis.model.js';
import ConsultationExamination from './ConsultationExamination.model.js';
import ClinicalPhoto from './ClinicalPhoto.model.js';
import ConsultationTemplate from './ConsultationTemplate.model.js';
import Medicine from './Medicine.model.js';
import Prescription from './Prescription.model.js';
import PrescriptionTemplate from './PrescriptionTemplate.model.js';
import DrugInteractionRule from './DrugInteractionRule.model.js';
import TreatmentPlan from './TreatmentPlan.model.js';
import TreatmentProtocol from './TreatmentProtocol.model.js';
import TreatmentPackage from './TreatmentPackage.model.js';
import ConsentRecord from './ConsentRecord.model.js';
import Invoice from './Invoice.model.js';
import Payment from './Payment.model.js';
import TreatmentSession from './TreatmentSession.model.js';
import TreatmentSessionLog from './TreatmentSessionLog.model.js';
import InventoryItem from './InventoryItem.model.js';
import StockTransaction from './StockTransaction.model.js';
import Supplier from './Supplier.model.js';
import PurchaseOrder from './PurchaseOrder.model.js';
import GoodsReceipt from './GoodsReceipt.model.js';
import Dispense from './Dispense.model.js';
import Lead from './Lead.model.js';
import LeadFollowUp from './LeadFollowUp.model.js';
import LeadTask from './LeadTask.model.js';
import Notification from './Notification.model.js';
import NotificationTemplate from './NotificationTemplate.model.js';
import ScheduledReport from './ScheduledReport.model.js';
import SavedReportFilter from './SavedReportFilter.model.js';
import ReportRun from './ReportRun.model.js';
import PatientRefreshToken from './PatientRefreshToken.model.js';
import PatientFeedback from './PatientFeedback.model.js';
import Organization from './Organization.model.js';
import Room from './Room.model.js';
import Device from './Device.model.js';
import StaffSkill from './StaffSkill.model.js';
import ConsentDefinition from './ConsentDefinition.model.js';
import ConsentGrant from './ConsentGrant.model.js';
import HandoffNote from './HandoffNote.model.js';
import ImportBatch from './ImportBatch.model.js';
import AppointmentWaitlist from './AppointmentWaitlist.model.js';
import LabOrder from './LabOrder.model.js';
import PatchTest from './PatchTest.model.js';
import AdverseEvent from './AdverseEvent.model.js';
import CreditNote from './CreditNote.model.js';
import CashClose from './CashClose.model.js';
import FeeSchedule from './FeeSchedule.model.js';
import StockTransferRequest from './StockTransferRequest.model.js';
import RecallEntry from './RecallEntry.model.js';
import Offer from './Offer.model.js';
import AiRun from './AiRun.model.js';
import AiFeatureFlag from './AiFeatureFlag.model.js';
import BreakGlassAccess from './BreakGlassAccess.model.js';
import PrivacyRequest from './PrivacyRequest.model.js';
import OtpCode from './OtpCode.model.js';
/**
 * The loyalty models were absent from this barrel entirely. Anything that relies on the barrel to
 * register schemas therefore never saw them — `db:migrate` (Model.syncIndexes over the registered
 * models) reported "complete, 77 models" while silently skipping every loyalty collection, so the
 * redemption idempotency index kept its old, broken `unique + sparse` definition on a cluster the
 * migration claimed to have brought up to date.
 */
import LoyaltyProgramSettings from './LoyaltyProgramSettings.model.js';
import LoyaltyEarningRule from './LoyaltyEarningRule.model.js';
import LoyaltyLedgerEntry from './LoyaltyLedgerEntry.model.js';
import LoyaltyBalanceCache from './LoyaltyBalanceCache.model.js';
import LoyaltyTier from './LoyaltyTier.model.js';
import LoyaltyCampaign from './LoyaltyCampaign.model.js';
import LoyaltyAdjustmentRequest from './LoyaltyAdjustmentRequest.model.js';

export {
  OtpCode,
  LabOrder,
  PatchTest,
  AdverseEvent,
  CreditNote,
  CashClose,
  FeeSchedule,
  StockTransferRequest,
  RecallEntry,
  Offer,
  AiRun,
  AiFeatureFlag,
  BreakGlassAccess,
  PrivacyRequest,
  Organization,
  Room,
  Device,
  StaffSkill,
  ConsentDefinition,
  ConsentGrant,
  HandoffNote,
  ImportBatch,
  AppointmentWaitlist,
  User,
  RefreshToken,
  Role,
  Permission,
  AuditLog,
  Branch,
  Master,
  Doctor,
  DoctorSchedule,
  DoctorLeave,
  Patient,
  PatientDocument,
  PatientTimeline,
  Sequence,
  BranchHoliday,
  DoctorBlockedSlot,
  DoctorSpecialSchedule,
  Appointment,
  QueueEntry,
  Consultation,
  ConsultationSoap,
  ConsultationVitals,
  ConsultationDiagnosis,
  ConsultationExamination,
  ClinicalPhoto,
  ConsultationTemplate,
  Medicine,
  Prescription,
  PrescriptionTemplate,
  DrugInteractionRule,
  TreatmentPlan,
  TreatmentProtocol,
  TreatmentPackage,
  ConsentRecord,
  Invoice,
  Payment,
  TreatmentSession,
  TreatmentSessionLog,
  InventoryItem,
  StockTransaction,
  Supplier,
  PurchaseOrder,
  GoodsReceipt,
  Dispense,
  Lead,
  LeadFollowUp,
  LeadTask,
  Notification,
  NotificationTemplate,
  ScheduledReport,
  SavedReportFilter,
  ReportRun,
  PatientRefreshToken,
  PatientFeedback,
  LoyaltyProgramSettings,
  LoyaltyEarningRule,
  LoyaltyLedgerEntry,
  LoyaltyBalanceCache,
  LoyaltyTier,
  LoyaltyCampaign,
  LoyaltyAdjustmentRequest,
};
